// ============================================================================
// OAuth Utility Library — Google, Facebook, Apple
// ============================================================================

export const OAUTH_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerId: string; // unique ID from the provider
  email: string;
  name: string;
  avatar?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/auth/social-callback`;
}

export function getProviderConfig(provider: OAuthProvider): OAuthConfig | null {
  const envPrefix = provider.toUpperCase();
  const clientId = process.env[`${envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) return null;

  const redirectUri = getRedirectUri();

  switch (provider) {
    case 'google':
      return {
        clientId,
        clientSecret,
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
      };
    case 'facebook':
      return {
        clientId,
        clientSecret,
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
        userInfoUrl: 'https://graph.facebook.com/v18.0/me?fields=id,name,email,picture',
        scopes: ['email', 'public_profile'],
      };
    case 'apple':
      return {
        clientId,
        clientSecret,
        authUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        userInfoUrl: '', // Apple returns user info in the token response + ID token
        scopes: ['name', 'email'],
      };
  }
}

export function getAuthorizationUrl(provider: OAuthProvider, state: string): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const redirectUri = getRedirectUri();
  const scopeParam = config.scopes.join(' ');

  switch (provider) {
    case 'google':
      return `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopeParam)}&access_type=offline&prompt=select_account&state=${state}`;
    case 'facebook':
      return `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeParam)}&state=${state}`;
    case 'apple':
      return `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=${encodeURIComponent(scopeParam)}&response_mode=form_post&state=${state}`;
  }
}

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
): Promise<{ accessToken: string; idToken?: string; refreshToken?: string } | null> {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const redirectUri = getRedirectUri();

  const params: Record<string, string> = {
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[oauth/${provider}] token exchange failed:`, errBody);
      return null;
    }

    const data = (await tokenRes.json()) as Record<string, string>;

    return {
      accessToken: data.access_token || '',
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  } catch (e) {
    console.error(`[oauth/${provider}] token exchange error:`, e);
    return null;
  }
}

export async function getUserInfo(
  provider: OAuthProvider,
  accessToken: string,
  idToken?: string,
): Promise<OAuthUserInfo | null> {
  const config = getProviderConfig(provider);
  if (!config) return null;

  try {
    switch (provider) {
      case 'google': {
        const res = await fetch(config.userInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, string>;
        return {
          provider: 'google',
          providerId: data.id || data.sub || '',
          email: data.email || '',
          name: data.name || 'Player',
          avatar: data.picture,
        };
      }
      case 'facebook': {
        const res = await fetch(config.userInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        const pic = data.picture as Record<string, unknown> | undefined;
        const picData = pic?.data as Record<string, string> | undefined;
        return {
          provider: 'facebook',
          providerId: String(data.id || ''),
          email: String(data.email || ''),
          name: String(data.name || 'Player'),
          avatar: picData?.url,
        };
      }
      case 'apple': {
        // Apple returns user info in the ID token (JWT)
        if (!idToken) return null;
        // Decode the JWT payload without verification (Apple verifies server-side)
        const parts = idToken.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
        const email = String(payload.email || '');
        // Apple only sends name on FIRST authorization via POST body, not in ID token
        // For subsequent logins, we need to use the email/sub to find the existing account
        return {
          provider: 'apple',
          providerId: String(payload.sub || ''),
          email,
          name: email ? email.split('@')[0] : 'Player',
        };
      }
    }
  } catch (e) {
    console.error(`[oauth/${provider}] getUserInfo error:`, e);
    return null;
  }
}

export function getSetupGuide(provider: OAuthProvider): string {
  switch (provider) {
    case 'google':
      return 'Go to https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth 2.0 Client ID. Add redirect URI: ' + getRedirectUri();
    case 'facebook':
      return 'Go to https://developers.facebook.com → My Apps → Create App → Add Facebook Login. Set redirect URI: ' + getRedirectUri();
    case 'apple':
      return 'Go to https://developer.apple.com → Certificates → Register an App ID with Sign in with Apple. Set redirect URI: ' + getRedirectUri();
  }
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return getProviderConfig(provider) !== null;
}
