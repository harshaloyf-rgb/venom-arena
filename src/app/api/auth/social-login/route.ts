import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/social-login?provider=google
 *
 * Redirects the user to the OAuth provider's authorization page.
 * After authentication, the provider redirects back to /api/auth/social-callback.
 */
import {
  OAUTH_PROVIDERS,
  getAuthorizationUrl,
  getSetupGuide,
  isProviderConfigured,
  type OAuthProvider,
} from '@/lib/oauth';

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider')?.toLowerCase();

  if (!provider || !OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { error: `Unsupported or missing provider. Supported: ${OAUTH_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const p = provider as OAuthProvider;

  // Check if credentials are configured
  if (!isProviderConfigured(p)) {
    return NextResponse.json(
      {
        error: `${p.charAt(0).toUpperCase() + p.slice(1)} login is not configured.`,
        notConfigured: true,
        provider: p,
        setupGuide: getSetupGuide(p),
      },
      { status: 200 },
    );
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();

  const authUrl = getAuthorizationUrl(p, state);
  if (!authUrl) {
    return NextResponse.json(
      { error: 'Failed to generate authorization URL.' },
      { status: 500 },
    );
  }

  // Set state in a short-lived cookie for CSRF verification
  const cookieStore = await import('next/headers').then((m) => m.cookies());
  cookieStore.set(`oauth_state_${p}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  });

  // 302 redirect to the OAuth provider
  return NextResponse.redirect(authUrl);
}
