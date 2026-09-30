const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const FROM_ADDRESS = 'noreply@sinexio.fr';
const MAX_BODY_BYTES = 4096;
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...RESPONSE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function getHeader(event, name) {
  const key = name.toLowerCase();
  return event.headers?.[name] || event.headers?.[key] || '';
}

function stripHeaderBreaks(value) {
  return value.replace(/(?:\r|\n|%0a|%0d)/gi, '');
}

function cleanField(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = stripHeaderBreaks(value).trim();
  if (!cleaned || cleaned.length > maxLength || /[\u0000-\u001f\u007f]/.test(cleaned)) return null;
  return cleaned;
}

function parseBody(event) {
  const contentType = getHeader(event, 'content-type').toLowerCase();
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';

  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { tooLarge: true };
  if (contentType.startsWith('application/json')) return { data: JSON.parse(raw) };
  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    return { data: Object.fromEntries(new URLSearchParams(raw)) };
  }
  return { unsupported: true };
}

function sameOrigin(event) {
  const host = getHeader(event, 'host').toLowerCase();
  const origin = getHeader(event, 'origin');
  const fetchSite = getHeader(event, 'sec-fetch-site').toLowerCase();
  if (!host || !origin || fetchSite === 'cross-site') return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Requête non autorisée.' }, { Allow: 'POST' });
  }
  if (!sameOrigin(event)) return response(403, { error: 'Requête refusée.' });

  const declaredLength = Number(getHeader(event, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return response(413, { error: 'Requête invalide.' });
  }

  let parsed;
  try {
    parsed = parseBody(event);
  } catch {
    return response(400, { error: 'Formulaire invalide.' });
  }
  if (parsed.tooLarge) return response(413, { error: 'Requête invalide.' });
  if (parsed.unsupported) return response(415, { error: 'Format invalide.' });

  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return response(400, { error: 'Formulaire invalide.' });
  }

  // Honeypot matches the native Netlify form field name.
  if (typeof data['bot-field'] === 'string' && data['bot-field'].trim()) {
    return response(200, { ok: true });
  }

  const fullName = cleanField(data.fullName, 100);
  const email = cleanField(data.email, 254);
  const company = cleanField(data.company, 150);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!fullName || !email || !company || !emailPattern.test(email)) {
    return response(400, { error: 'Vérifiez les champs du formulaire.' });
  }

  const {
    SMTP_HOST: host,
    SMTP_PORT: portValue,
    SMTP_USER: user,
    SMTP_PASS: pass,
    DEMO_EMAIL_TO: to,
    UPSTASH_REDIS_REST_URL: redisUrl,
    UPSTASH_REDIS_REST_TOKEN: redisToken
  } = process.env;
  const port = Number(portValue);

  if (!host || ![465, 587].includes(port) || !user || !pass || !to || !redisUrl || !redisToken) {
    return response(503, { error: 'Service momentanément indisponible.' });
  }

  const clientIp = getHeader(event, 'x-nf-client-connection-ip') || getHeader(event, 'client-ip');
  if (!clientIp) return response(403, { error: 'Requête refusée.' });

  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'sinexio:demo-email'
    });
    const ipKey = crypto.createHmac('sha256', redisToken).update(clientIp).digest('hex');
    const result = await limiter.limit(ipKey);
    if (!result.success) return response(429, { error: 'Trop de demandes. Réessayez plus tard.' });
  } catch {
    return response(503, { error: 'Service momentanément indisponible.' });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      replyTo: { name: fullName, address: email },
      subject: 'Nouvelle demande de démonstration Sinexio',
      text: `Nouvelle demande de démonstration\n\nNom : ${fullName}\nEmail : ${email}\nEntreprise : ${company}`
    });
    return response(200, { ok: true });
  } catch {
    return response(500, { error: 'Envoi impossible. Réessayez plus tard.' });
  }
};
