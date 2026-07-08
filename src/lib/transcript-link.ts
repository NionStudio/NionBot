import { createHmac } from 'node:crypto';
import { env } from './env.js';

const LINK_TTL_MS = 60 * 60 * 1000;

export function isTranscriptLinkConfigured(): boolean {
  return Boolean(env.TRANSCRIPT_APP_URL && env.TRANSCRIPT_SECRET);
}

export function buildDirectLink(cdnUrl: string): string | null {
  if (!env.TRANSCRIPT_APP_URL || !env.TRANSCRIPT_SECRET) return null;

  const d = Buffer.from(cdnUrl, 'utf8').toString('base64url');
  const e = String(Date.now() + LINK_TTL_MS);
  const s = createHmac('sha256', env.TRANSCRIPT_SECRET)
    .update(`${d}.${e}`)
    .digest('base64url');

  const base = env.TRANSCRIPT_APP_URL.replace(/\/+$/, '');
  return `${base}/t?d=${d}&e=${e}&s=${s}`;
}
