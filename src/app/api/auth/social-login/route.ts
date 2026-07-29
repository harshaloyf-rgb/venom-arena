import { NextRequest, NextResponse } from 'next/server';

/**
 * Social Login API — architecture for Google, Facebook, Apple OAuth.
 *
 * In production, this would:
 *   1. Validate the provider is enabled
 *   2. Redirect to the OAuth provider's authorization URL
 *   3. Handle the callback, exchange code for tokens
 *   4. Create/link a Player account
 *   5. Set session cookie
 *
 * Currently returns a "not configured" message since OAuth credentials
 * (Client ID, Client Secret) require a real domain and developer console setup.
 */

const PROVIDERS = ['google', 'facebook', 'apple'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider || '').toLowerCase();

    if (!PROVIDERS.includes(provider as typeof PROVIDERS[number])) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    // Check if OAuth credentials are configured
    const envKey = `${provider.toUpperCase()}_CLIENT_ID`;
    const clientId = process.env[envKey];

    if (!clientId) {
      return NextResponse.json({
        error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} login is not configured yet. Please use email/password or play as guest.`,
        notConfigured: true,
        provider,
        setupGuide: getSetupGuide(provider as typeof PROVIDERS[number]),
      }, { status: 200 });
    }

    // When configured, redirect to OAuth authorization URL
    // For now, return a placeholder
    const authUrl = getAuthUrl(provider as typeof PROVIDERS[number], clientId);
    return NextResponse.json({ url: authUrl, provider });
  } catch (e) {
    console.error('[auth/social-login] error', e);
    return NextResponse.json({ error: 'Social login failed.' }, { status: 500 });
  }
}

function getAuthUrl(provider: typeof PROVIDERS[number], clientId: string): string {
  const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/social-callback`;

  switch (provider) {
    case 'google':
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
    case 'facebook':
      return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile`;
    case 'apple':
      return `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=name%20email&response_mode=form_post`;
  }
}

function getSetupGuide(provider: typeof PROVIDERS[number]): string {
  switch (provider) {
    case 'google':
      return 'Go to https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth 2.0 Client ID. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env';
    case 'facebook':
      return 'Go to https://developers.facebook.com → My Apps → Create App → Add Facebook Login. Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env';
    case 'apple':
      return 'Go to https://developer.apple.com → Certificates → Register an App ID with Sign in with Apple. Set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET in .env';
  }
}
