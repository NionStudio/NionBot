import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const secret = process.env.TRANSCRIPT_SECRET;
  if (!secret) {
    page(res, 500, 'Servidor no configurado', 'Falta TRANSCRIPT_SECRET.');
    return;
  }

  const d = str(req.query.d);
  const e = str(req.query.e);
  const s = str(req.query.s);
  if (!d || !e || !s) {
    page(res, 400, 'Enlace inválido', 'Faltan parámetros en el enlace.');
    return;
  }

  const expected = createHmac('sha256', secret).update(`${d}.${e}`).digest('base64url');
  if (!safeEqual(s, expected)) {
    page(res, 403, 'Enlace inválido', 'La firma del enlace no es válida.');
    return;
  }

  const exp = Number(e);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    page(res, 410, 'Enlace caducado', 'Este enlace ha expirado. Vuelve a pulsar «Obtener enlace directo» en Discord.');
    return;
  }

  let target: URL;
  try {
    target = new URL(Buffer.from(d, 'base64url').toString('utf8'));
  } catch {
    page(res, 400, 'Enlace inválido', 'La URL del enlace no es válida.');
    return;
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    page(res, 400, 'Origen no permitido', 'La transcripción no procede de un origen permitido.');
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString());
  } catch {
    page(res, 502, 'No disponible', 'No se pudo obtener la transcripción.');
    return;
  }
  if (!upstream.ok) {

    page(res, 502, 'No disponible', 'La transcripción ya no está disponible. Vuelve a pulsar «Obtener enlace directo» en Discord.');
    return;
  }

  const html = await upstream.text();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

function safeEqual(a: string, b: string): boolean {
  const ab = new Uint8Array(Buffer.from(a));
  const bb = new Uint8Array(Buffer.from(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function page(res: VercelResponse, status: number, title: string, msg: string): void {
  const esc = (t: string): string =>
    t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1e1f22;color:#dbdee1;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#949ba4;margin:0}</style>
</head><body><main><h1>${esc(title)}</h1><p>${esc(msg)}</p></main></body></html>`,
  );
}
