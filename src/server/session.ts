import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from './config';

/** Signs a value as `value.signature` so the browser cannot forge cookies. */
export function sign(value: string): string {
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
  return `${value}.${sig}`;
}

export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signed);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual) ? value : null;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function setCookie(res: Response, name: string, value: string, maxAgeMs: number): void {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: maxAgeMs,
    path: '/',
  });
}

export function clearCookie(res: Response, name: string): void {
  res.clearCookie(name, { path: '/' });
}

/**
 * Minimal in-memory session store. Profiles are small and only needed to
 * pre-fill the form, so losing them on restart just means signing in again.
 */
export class MemoryStore<T> {
  private readonly items = new Map<string, { value: T; expires: number }>();

  constructor(private readonly ttlMs: number) {
    setInterval(() => this.sweep(), 10 * 60 * 1000).unref();
  }

  create(value: T): string {
    const id = crypto.randomBytes(24).toString('base64url');
    this.items.set(id, { value, expires: Date.now() + this.ttlMs });
    return id;
  }

  get(id: string | null): T | null {
    if (!id) return null;
    const item = this.items.get(id);
    if (!item || item.expires < Date.now()) {
      this.items.delete(id);
      return null;
    }
    return item.value;
  }

  delete(id: string | null): void {
    if (id) this.items.delete(id);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, item] of this.items) if (item.expires < now) this.items.delete(id);
  }
}
