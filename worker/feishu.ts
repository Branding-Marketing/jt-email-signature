import { toBase64 } from './crypto';

const OPEN_API = 'https://open.feishu.cn/open-apis';
const AUTHORIZE_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';

export interface FeishuCredentials {
  appId: string;
  appSecret: string;
  /** User-identity scopes requested at login (space separated) */
  scope: string;
}

export interface FeishuProfile {
  openId: string;
  name: string;
  enName: string;
  email: string;
  mobile: string;
  /** Main position name from the directory, empty when unavailable */
  title: string;
  /** Why the position is empty (Feishu error codes only, no personal data) */
  titleIssue?: string;
  /** Avatar as a data: URL so the browser can draw it on a canvas without CORS issues */
  avatarDataUrl: string;
}

interface FeishuEnvelope<T> {
  code: number;
  msg?: string;
  error_description?: string;
  data?: T;
}

async function feishuFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${OPEN_API}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as FeishuEnvelope<T>;
  if (!res.ok || body.code !== 0) {
    throw new Error(`Feishu ${path} failed: HTTP ${res.status}, code ${body.code}, ${body.msg ?? body.error_description ?? ''}`);
  }
  // Some endpoints (tokens) return their fields at the top level rather than under `data`
  return (body.data ?? body) as T;
}

export function buildAuthorizeUrl(creds: FeishuCredentials, state: string, redirectUri: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', creds.appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  // OAuth v2 only grants user-identity scopes that are requested explicitly here
  if (creds.scope) url.searchParams.set('scope', creds.scope);
  return url.toString();
}

/** Exchanges the OAuth code for a user_access_token (OAuth v2 endpoint). */
export async function exchangeCode(creds: FeishuCredentials, code: string, redirectUri: string) {
  return feishuFetch<{ access_token: string; expires_in: number }>('/authen/v2/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: creds.appId,
      client_secret: creds.appSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
}

// Cached per Worker isolate; refreshed five minutes before expiry
let tenantToken: { value: string; expires: number } | null = null;

async function getTenantAccessToken(creds: FeishuCredentials): Promise<string> {
  if (tenantToken && tenantToken.expires > Date.now()) return tenantToken.value;
  const data = await feishuFetch<{ tenant_access_token: string; expire: number }>('/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  });
  tenantToken = { value: data.tenant_access_token, expires: Date.now() + (data.expire - 300) * 1000 };
  return tenantToken.value;
}

interface UserInfo {
  open_id: string;
  name?: string;
  en_name?: string;
  avatar_big?: string;
  avatar_url?: string;
  email?: string;
  enterprise_email?: string;
  mobile?: string;
}

/** Feishu returns some names as plain strings and others as i18n objects. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as { default_value?: string; i18n_value?: Record<string, string> };
    return v.i18n_value?.en_us || v.default_value || Object.values(v.i18n_value ?? {})[0] || '';
  }
  return '';
}

interface Position {
  position_name?: unknown;
  is_main_position?: boolean;
}

interface MgetResponse {
  employees?: { work_info?: { positions?: Position[] } }[];
  /** Per-row / per-field failures; the call itself still returns code 0 */
  abnormals?: { id?: string; row_error?: number; field_errors?: Record<string, number> }[];
}

// Codes from the directory API docs
const FIELD_ERRORS: Record<number, string> = {
  1000: 'no permission',
  2000: 'service error',
  2002: 'user does not exist',
  2003: 'field does not exist',
};

/**
 * Reads the employee's main position via the directory API (POST employees/mget).
 * Requires directory:employee:read plus directory:employee.work.positions:read on the
 * app identity, and the user must be inside the app's contact permission range.
 * The user token is only tried as a fallback: Feishu checks it against admin scope.
 */
async function fetchPositionTitle(
  creds: FeishuCredentials,
  openId: string,
  userToken: string,
): Promise<{ title: string; issue?: string }> {
  const body = JSON.stringify({ employee_ids: [openId], required_fields: ['work_info.positions'] });
  const path = '/directory/v1/employees/mget?employee_id_type=open_id';
  const issues: string[] = [];
  const attempts: [string, () => Promise<string>][] = [
    ['app', () => getTenantAccessToken(creds)],
    ['user', async () => userToken],
  ];
  for (const [identity, getToken] of attempts) {
    try {
      const data = await feishuFetch<MgetResponse>(path, { method: 'POST', body, token: await getToken() });
      const abnormal = data.abnormals?.[0];
      if (abnormal) {
        const fields = Object.entries(abnormal.field_errors ?? {})
          .map(([f, c]) => `${f}: ${FIELD_ERRORS[c] ?? c}`)
          .join(', ');
        const row = abnormal.row_error ? `row: ${FIELD_ERRORS[abnormal.row_error] ?? abnormal.row_error}` : '';
        issues.push(`${identity} identity: ${[row, fields].filter(Boolean).join(', ') || 'unknown'}`);
        continue;
      }
      const positions = data.employees?.[0]?.work_info?.positions ?? [];
      const main = positions.find((p) => p.is_main_position) ?? positions[0];
      const title = main ? textOf(main.position_name) : '';
      if (title) return { title };
      issues.push(`${identity} identity: no position set in Feishu`);
    } catch (err) {
      issues.push(`${identity} identity: ${(err as Error).message}`);
    }
  }
  const issue = issues.join('; ');
  console.warn('[feishu] position lookup failed:', issue);
  return { title: '', issue };
}

async function fetchAvatarDataUrl(url: string | undefined): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${type};base64,${toBase64(await res.arrayBuffer())}`;
  } catch (err) {
    console.warn('[feishu] avatar download failed:', (err as Error).message);
    return '';
  }
}

export async function loadProfile(creds: FeishuCredentials, userToken: string): Promise<FeishuProfile> {
  const info = await feishuFetch<UserInfo>('/authen/v1/user_info', { token: userToken });
  const [position, avatarDataUrl] = await Promise.all([
    fetchPositionTitle(creds, info.open_id, userToken),
    fetchAvatarDataUrl(info.avatar_big || info.avatar_url),
  ]);
  return {
    openId: info.open_id,
    name: info.name ?? '',
    enName: info.en_name ?? '',
    email: info.enterprise_email || info.email || '',
    mobile: info.mobile ?? '',
    title: position.title,
    titleIssue: position.issue,
    avatarDataUrl,
  };
}
