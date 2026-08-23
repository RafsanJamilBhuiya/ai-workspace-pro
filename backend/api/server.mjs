import http from 'node:http';
import crypto from 'node:crypto';

const config = Object.freeze({
  port: Number(process.env.PORT || 8080),
  origin: process.env.CORS_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX || 60),
  bodyLimit: Number(process.env.BODY_LIMIT_BYTES || 1_048_576)
});

const rateBuckets = new Map();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(body);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', config.origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Webhook-Signature');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function clientKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res) {
  const now = Date.now();
  const key = clientKey(req);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.started >= config.windowMs) {
    rateBuckets.set(key, { started: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  if (bucket.count > config.maxRequests) {
    res.setHeader('Retry-After', Math.ceil((config.windowMs - (now - bucket.started)) / 1000));
    json(res, 429, { ok: false, error: 'rate_limit_exceeded' });
    return false;
  }
  return true;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyWebhook(rawBody, signature) {
  if (!config.webhookSecret || !signature) return false;
  const supplied = String(signature).replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
  return timingSafeEqual(supplied, expected);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function verifyJwt(token) {
  if (!config.jwtSecret) throw new Error('JWT_SECRET is not configured.');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT.');
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest('base64url');
  if (!timingSafeEqual(signature, expected)) throw new Error('Invalid JWT signature.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (data.exp && Date.now() >= Number(data.exp) * 1000) throw new Error('JWT expired.');
  return data;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > config.bodyLimit) throw Object.assign(new Error('Payload too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function requireBearer(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Bearer token required.'), { status: 401 });
  return verifyJwt(header.slice(7));
}

function safeLog(event, meta = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...meta
  }));
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!rateLimit(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'ai-workspace-pro-api', time: new Date().toISOString() });
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/me') {
      const claims = requireBearer(req);
      return json(res, 200, { ok: true, user: { sub: claims.sub, email: claims.email || null } });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/webhooks/events') {
      const rawBody = await readBody(req);
      if (!verifyWebhook(rawBody, req.headers['x-webhook-signature'])) {
        safeLog('WEBHOOK_REJECTED', { ip: clientKey(req) });
        return json(res, 401, { ok: false, error: 'invalid_webhook_signature' });
      }
      let payload;
      try { payload = JSON.parse(rawBody); } catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }
      if (!payload || typeof payload.event !== 'string' || payload.event.length > 120) {
        return json(res, 422, { ok: false, error: 'invalid_event' });
      }
      safeLog('WEBHOOK_ACCEPTED', { event: payload.event });
      return json(res, 202, { ok: true, accepted: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/tasks') {
      const claims = requireBearer(req);
      const rawBody = await readBody(req);
      let payload;
      try { payload = JSON.parse(rawBody); } catch { return json(res, 400, { ok: false, error: 'invalid_json' }); }
      if (!payload || typeof payload.type !== 'string' || payload.type.length > 100) {
        return json(res, 422, { ok: false, error: 'invalid_task_type' });
      }
      const taskId = crypto.randomUUID();
      safeLog('TASK_ACCEPTED', { taskId, type: payload.type, sub: claims.sub });
      return json(res, 202, { ok: true, taskId, status: 'accepted' });
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    const status = Number(error.status) || 500;
    safeLog('REQUEST_ERROR', { status, message: error.message });
    return json(res, status, { ok: false, error: status >= 500 ? 'internal_error' : error.message });
  }
});

server.listen(config.port, () => {
  console.log(`AI Workspace Pro API listening on :${config.port}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
