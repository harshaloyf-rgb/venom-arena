import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  signSession,
  setSessionCookie,
  generateUniqueUserTag,
} from '@/lib/auth';
import {
  OAUTH_PROVIDERS,
  exchangeCodeForTokens,
  getUserInfo,
  type OAuthProvider,
} from '@/lib/oauth';
import { encodeSkins, generateReferralCode } from '@/lib/player-helpers';
import { DEFAULT_UNLOCKED_SKINS } from '@/lib/constants';
import { REGISTERED_TOTAL_CHIPS, regionOf } from '@/lib/game-config';
import { detectCountry } from '@/lib/geoip';

/**
 * GET /api/auth/social-callback?provider=google&code=xxx&state=xxx
 *
 * Handles the OAuth callback from Google and Facebook (query-string based).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const provider = url.searchParams.get('provider')?.toLowerCase() || 'google';
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?oauth_error=no_code', url.origin));
  }

  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.redirect(new URL('/?oauth_error=invalid_provider', url.origin));
  }

  const p = provider as OAuthProvider;

  // Verify state for CSRF protection
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const savedState = cookieStore.get(`oauth_state_${p}`)?.value;
  const receivedState = url.searchParams.get('state');
  if (!savedState || !receivedState || savedState !== receivedState) {
    console.error(`[oauth/${p}] CSRF state missing or mismatch`);
    return NextResponse.redirect(new URL('/?oauth_error=csrf_mismatch', url.origin));
  }
  cookieStore.delete(`oauth_state_${p}`);

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(p, code);
  if (!tokens || !tokens.accessToken) {
    console.error(`[oauth/${p}] Failed to exchange code for tokens`);
    return NextResponse.redirect(new URL('/?oauth_error=token_exchange_failed', url.origin));
  }

  // Get user info from provider
  const userInfo = await getUserInfo(p, tokens.accessToken, tokens.idToken);
  if (!userInfo || !userInfo.email) {
    console.error(`[oauth/${p}] Failed to get user info`);
    return NextResponse.redirect(new URL('/?oauth_error=no_user_info', url.origin));
  }

  // Get IP for GeoIP detection
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return await handleOAuthLogin(p, userInfo, url.origin, ip, req.headers);
}

/**
 * POST /api/auth/social-callback
 *
 * Handles Apple OAuth callback (form_post mode sends POST).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const provider = 'apple' as OAuthProvider;
    const code = formData.get('code') as string | null;

    if (!code) {
      return NextResponse.redirect(new URL('/?oauth_error=no_code', req.nextUrl.origin));
    }

    // Verify state
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const savedState = cookieStore.get('oauth_state_apple')?.value;
    const receivedState = (formData.get('state') as string | null) || '';
    if (!savedState || !receivedState || savedState !== receivedState) {
      return NextResponse.redirect(new URL('/?oauth_error=csrf_mismatch', req.nextUrl.origin));
    }
    cookieStore.delete('oauth_state_apple');

    // Apple user info is in the POST body on first authorization only
    const appleName = formData.get('name') as string | null;

    const tokens = await exchangeCodeForTokens(provider, code);
    if (!tokens || !tokens.accessToken) {
      return NextResponse.redirect(new URL('/?oauth_error=token_exchange_failed', req.nextUrl.origin));
    }

    const userInfo = await getUserInfo(provider, tokens.accessToken, tokens.idToken);
    if (!userInfo) {
      return NextResponse.redirect(new URL('/?oauth_error=no_user_info', req.nextUrl.origin));
    }

    // Apple only sends name on first authorization; use it if available
    if (appleName) {
      userInfo.name = appleName;
    }

    // Get IP for GeoIP detection
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    return await handleOAuthLogin(provider, userInfo, req.nextUrl.origin, ip, req.headers);
  } catch (e) {
    console.error('[oauth/apple] callback error:', e);
    return NextResponse.redirect(new URL('/?oauth_error=account_error', req.nextUrl.origin));
  }
}

// ============================================================================
// Shared helper: create / link / login
// ============================================================================

import type { OAuthUserInfo } from '@/lib/oauth';

async function handleOAuthLogin(provider: OAuthProvider, userInfo: OAuthUserInfo, origin: string, ip: string, headers: Headers) {
  try {
    // 1. Check if an account with this OAuth provider+ID already exists
    const existingByOauth = await db.player.findFirst({
      where: {
        oauthProvider: provider,
        oauthProviderId: userInfo.providerId,
      },
    });

    if (existingByOauth) {
      if (existingByOauth.banned) {
        return NextResponse.redirect(new URL('/?oauth_error=account_banned', origin));
      }
      const token = await signSession({
        playerId: existingByOauth.id,
        userTag: existingByOauth.userTag,
        role: existingByOauth.role as 'player' | 'admin',
      });
      await setSessionCookie(token);

      if (userInfo.avatar && !existingByOauth.avatar) {
        await db.player.update({
          where: { id: existingByOauth.id },
          data: { avatar: userInfo.avatar },
        });
      }

      return NextResponse.redirect(new URL('/?oauth=success', origin));
    }

    // 2. Check if an account with this email already exists (merge/link)
    // Audit A4: never auto-link by an email the provider hasn't verified —
    // otherwise an attacker creates a social account with a victim's email and
    // takes over the game account on first OAuth login.
    if (userInfo.email && userInfo.emailVerified === false) {
      return NextResponse.redirect(new URL('/?oauth_error=email_unverified', origin));
    }
    if (userInfo.email) {
      const existingByEmail = await db.player.findUnique({
        where: { email: userInfo.email },
      });

      if (existingByEmail) {
        if (existingByEmail.banned) {
          return NextResponse.redirect(new URL('/?oauth_error=account_banned', origin));
        }
        // If the account already has a different OAuth provider linked, reject
        if (existingByEmail.oauthProvider && existingByEmail.oauthProvider !== provider) {
          return NextResponse.redirect(new URL('/?oauth_error=account_already_linked', origin));
        }
        const linked = await db.player.update({
          where: { id: existingByEmail.id },
          data: {
            oauthProvider: provider,
            oauthProviderId: userInfo.providerId,
            avatar: userInfo.avatar || existingByEmail.avatar,
          },
        });
        const token = await signSession({
          playerId: linked.id,
          userTag: linked.userTag,
          role: linked.role as 'player' | 'admin',
        });
        await setSessionCookie(token);
        return NextResponse.redirect(new URL('/?oauth=linked', origin));
      }
    }

    // 3. Create a brand new account
    // Auto-detect country from IP (best-effort)
    let country = await detectCountry(ip, headers);
    if (!country) country = 'US'; // fallback for social login (no way to prompt)
    const region = regionOf(country);

    const userTag = await generateUniqueUserTag();
    const displayName = userInfo.name || userInfo.email?.split('@')[0] || 'Player';
    const referralCode = generateReferralCode();

    const player = await db.player.create({
      data: {
        email: userInfo.email,
        passwordHash: null, // OAuth accounts have no password
        userTag,
        name: displayName.slice(0, 20),
        country,
        region,
        avatar: userInfo.avatar,
        unlockedSkins: encodeSkins(DEFAULT_UNLOCKED_SKINS),
        bankedChips: REGISTERED_TOTAL_CHIPS,
        totalEarned: REGISTERED_TOTAL_CHIPS,
        emailVerified: true, // OAuth providers verify email
        oauthProvider: provider,
        oauthProviderId: userInfo.providerId,
        referralCode,
      },
    });

    const token = await signSession({
      playerId: player.id,
      userTag: player.userTag,
      role: 'player',
    });
    await setSessionCookie(token);

    return NextResponse.redirect(new URL('/?oauth=registered', origin));
  } catch (e) {
    console.error(`[oauth/${provider}] account creation/linking error:`, e);
    return NextResponse.redirect(new URL('/?oauth_error=account_error', origin));
  }
}
