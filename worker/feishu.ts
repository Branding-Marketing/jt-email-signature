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
  /** 别名 from the directory, empty when unavailable */
  alias: string;
  email: string;
  mobile: string;
  /** Main position name from the directory, empty when unavailable */
  title: string;
  /** Why the position is empty (Feishu error codes only, no personal data) */
  titleIssue?: string;
  /** Avatar as a data: URL so the browser can draw it on a canvas without CORS issues */
  avatarDataUrl: string;
  /** Unmodified Feishu responses, logged in the browser console for debugging */
  raw: { user_info: unknown; directory_mget: Record<string, unknown> };
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

interface MgetEmployee {
  base_info?: { name?: { another_name?: string } };
  work_info?: { positions?: Position[] };
}

interface MgetResponse {
  employees?: MgetEmployee[];
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

const POSITIONS_FIELD = 'work_info.positions';
const ALIAS_FIELD = 'base_info.name.another_name';

interface DirectoryInfo {
  title: string;
  titleIssue?: string;
  /** 别名 in the Feishu directory */
  alias: string;
  /** Raw mget response (or error) per identity tried */
  raw: Record<string, unknown>;
}

/**
 * Reads the employee's main position and alias via the directory API (POST employees/mget).
 * App identity needs directory:employee:read, directory:employee.work.positions:read and,
 * for the alias, directory:employee.base.name.another_name:read; the user must be inside
 * the app's contact permission range. A missing field scope only blanks that field.
 * The user token is a fallback only: Feishu checks it against the user's admin scope.
 */
async function fetchDirectoryInfo(creds: FeishuCredentials, openId: string, userToken: string): Promise<DirectoryInfo> {
  const body = JSON.stringify({ employee_ids: [openId], required_fields: [POSITIONS_FIELD, ALIAS_FIELD] });
  const path = '/directory/v1/employees/mget?employee_id_type=open_id';
  const titleIssues: string[] = [];
  let alias = '';
  const raw: Record<string, unknown> = {};
  const attempts: [string, () => Promise<string>][] = [
    ['app', () => getTenantAccessToken(creds)],
    ['user', async () => userToken],
  ];
  for (const [identity, getToken] of attempts) {
    try {
      const data = await feishuFetch<MgetResponse>(path, { method: 'POST', body, token: await getToken() });
      raw[identity] = data;
      const abnormal = data.abnormals?.[0];
      const fieldErrors = abnormal?.field_errors ?? {};
      if (abnormal?.row_error) {
        titleIssues.push(`${identity} identity: ${FIELD_ERRORS[abnormal.row_error] ?? abnormal.row_error}`);
        continue;
      }
      const employee = data.employees?.[0];
      alias ||= (employee?.base_info?.name?.another_name ?? '').trim();
      if (fieldErrors[ALIAS_FIELD]) {
        console.warn(`[feishu] alias unavailable (${identity} identity): ${FIELD_ERRORS[fieldErrors[ALIAS_FIELD]] ?? fieldErrors[ALIAS_FIELD]}`);
      }
      const positions = employee?.work_info?.positions ?? [];
      const main = positions.find((p) => p.is_main_position) ?? positions[0];
      const title = main ? textOf(main.position_name) : '';
      if (title) return { title, alias, raw };
      const code = fieldErrors[POSITIONS_FIELD];
      titleIssues.push(`${identity} identity: ${code ? FIELD_ERRORS[code] ?? code : 'no position set in Feishu'}`);
    } catch (err) {
      raw[identity] = { error: (err as Error).message };
      titleIssues.push(`${identity} identity: ${(err as Error).message}`);
    }
  }
  const titleIssue = titleIssues.join('; ');
  console.warn('[feishu] position lookup failed:', titleIssue);
  return { title: '', titleIssue, alias, raw };
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
  const [directory, avatarDataUrl] = await Promise.all([
    fetchDirectoryInfo(creds, info.open_id, userToken),
    fetchAvatarDataUrl(info.avatar_big || info.avatar_url),
  ]);
  return {
    openId: info.open_id,
    name: info.name ?? '',
    enName: info.en_name ?? '',
    alias: directory.alias,
    email: info.enterprise_email || info.email || '',
    mobile: info.mobile ?? '',
    title: directory.title,
    titleIssue: directory.titleIssue,
    avatarDataUrl,
    raw: { user_info: info, directory_mget: directory.raw },
  };
}
