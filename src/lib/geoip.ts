// GeoIP country detection utility for auto-detecting player country on signup

/** In-memory cache: ip → countryCode (TTL = 1 hour) */
const cache = new Map<string, { code: string; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/** Valid ISO-3166-1 alpha-2 country codes from our COUNTRIES list */
const VALID_CODES = new Set([
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB',
  'BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI','CV','KH',
  'CM','CA','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY',
  'CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI',
  'FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU',
  'IS','IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','XK',
  'KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MG','MW','MY','MV',
  'ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA',
  'NR','NP','NL','NZ','NI','NE','NG','KP','MK','NO','OM','PK','PW','PS','PA',
  'PG','PY','PE','PH','PL','PT','QA','RO','RU','RW','KN','LC','VC','WS','SM',
  'ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','KR','SS','ES',
  'LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN',
  'TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE',
  'ZM','ZW',
]);

/**
 * Detect country from IP address using ip-api.com (free, no API key needed).
 * Returns empty string '' if IP is private/localhost or detection fails.
 * Caller should prompt user to manually select their country when this returns ''.
 */
export async function detectCountryFromIP(ip: string): Promise<string> {
  // Skip private/local/unknown IPs — return empty to signal "unknown"
  if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return '';
  }

  // Check cache
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.code;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json() as { status: string; countryCode: string };

    if (data.status === 'success' && data.countryCode && VALID_CODES.has(data.countryCode)) {
      const code = data.countryCode;
      cache.set(ip, { code, ts: Date.now() });
      if (cache.size > 500) {
        const now = Date.now();
        for (const [key, val] of cache) {
          if (now - val.ts > CACHE_TTL) cache.delete(key);
        }
      }
      return code;
    }
  } catch (err) {
    console.warn(`[geoip] Failed to detect country for IP ${ip}:`, err instanceof Error ? err.message : String(err));
  }

  return '';
}

/**
 * Detect country from Cloudflare CF-IPCountry header if available.
 * Returns null if the header is not present or invalid.
 */
export function detectCountryFromCFHeader(headers: Headers): string | null {
  const cfCountry = headers.get('cf-ipcountry');
  if (cfCountry && VALID_CODES.has(cfCountry)) {
    return cfCountry;
  }
  return null;
}

/**
 * Best-effort country detection: checks CF header first, then GeoIP API.
 * Returns empty string '' if detection is not possible (private IP, no CF, API failure).
 */
export async function detectCountry(ip: string, headers: Headers): Promise<string> {
  const cf = detectCountryFromCFHeader(headers);
  if (cf) return cf;
  return detectCountryFromIP(ip);
}
