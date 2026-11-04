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

/**
 * Reads the employee's position via the directory API.
 * Needs scope directory:employee.work.positions:read. Uses the app identity first
 * and falls back to the user's own token, whichever the tenant admin approved.
 */
async function fetchPositionTitle(creds: FeishuCredentials, openId: string, userToken: string): Promise<string> {
  const body = JSON.stringify({ employee_ids: [openId], required_fields: ['work_info.positions'] });
  const path = '/directory/v1/employees/mget?employee_id_type=open_id';
  for (const getToken of [() => getTenantAccessToken(creds), async () => userToken]) {
    try {
      const data = await feishuFetch<{ employees?: unknown[]; items?: unknown[] }>(path, {
        method: 'POST',
        body,
        token: await getToken(),
      });
      const employee = (data.employees ?? data.items ?? [])[0] as { work_info?: { positions?: Position[] } } | undefined;
      const positions = employee?.work_info?.positions ?? [];
      const main = positions.find((p) => p.is_main_position) ?? positions[0];
      return main ? textOf(main.position_name) : '';
    } catch (err) {
      console.warn('[feishu] position lookup failed:', (err as Error).message);
    }
  }
  return '';
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
  const [title, avatarDataUrl] = await Promise.all([
    fetchPositionTitle(creds, info.open_id, userToken),
    fetchAvatarDataUrl(info.avatar_big || info.avatar_url),
  ]);
  return {
    openId: info.open_id,
    name: info.name ?? '',
    enName: info.en_name ?? '',
    email: info.enterprise_email || info.email || '',
    mobile: info.mobile ?? '',
    title,
    avatarDataUrl,
  };
}
