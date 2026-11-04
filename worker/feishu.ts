import { toBase64 } from './crypto';

const OPEN_API = 'https://open.feishu.cn/open-apis';
const AUTHORIZE_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';

export interface FeishuCredentials {
  appId: string;
  appSecret: string;
  /** Optional user-identity scopes requested at login (space separated) */
  scope: string;
}

/**
 * Profile used to pre-fill the signature. Only fields the login itself returns are used;
 * the directory API (position, alias) needs directory:employee:read, which requires
 * tenant admin review and is not available for this app.
 */
export interface FeishuProfile {
  openId: string;
  name: string;
  enName: string;
  /** Present only when the matching contact scope is granted and requested at login */
  email: string;
  mobile: string;
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
  // The token endpoint returns its fields at the top level rather than under `data`
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

export async function loadProfile(userToken: string): Promise<FeishuProfile> {
  const info = await feishuFetch<UserInfo>('/authen/v1/user_info', { token: userToken });
  return {
    openId: info.open_id,
    name: info.name ?? '',
    enName: info.en_name ?? '',
    email: info.enterprise_email || info.email || '',
    mobile: info.mobile ?? '',
    avatarDataUrl: await fetchAvatarDataUrl(info.avatar_big || info.avatar_url),
  };
}
