const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();
const port = process.env.PORT || 8080;
const JWKS_URL = process.env.JWKS_URL;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;

if (!JWKS_URL) {
  console.error('JWKS_URL environment variable is required');
  process.exit(1);
}
if (!KEYCLOAK_ISSUER) {
  console.error('KEYCLOAK_ISSUER environment variable is required');
  process.exit(1);
}
if (!KEYCLOAK_CLIENT_ID) {
  console.error('KEYCLOAK_CLIENT_ID environment variable is required');
  process.exit(1);
}

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const CYAN = '\x1b[36m';
const FIELD = '\x1b[38;5;250m';
const RESET = '\x1b[0m';

function timestamp() {
  const now = new Date();
  return now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString('en-GB', { hour12: false });
}

function formatFields(fields) {
  if (!fields) return '';
  return ' ' + Object.entries(fields)
    .map(([k, v]) => `${FIELD}${k}=${v}${RESET}`)
    .join(' ');
}

function log(level, msg, fields) {
  const ts = GRAY + timestamp() + RESET;
  const svc = GREEN + '[ProtectedService]' + RESET;
  const lvl = level === 'INFO' ? GREEN + '[INFO]' + RESET
            : level === 'WARN' ? YELLOW + '[WARN]' + RESET
            : level === 'DEBUG' ? GRAY + '[DEBUG]' + RESET
            : RED + '[ERROR]' + RESET;
  console.log(`${ts} ${svc} ${lvl} ${msg}${formatFields(fields)}`);
}

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch {
    return null;
  }
}

app.get('/', async (req, res) => {
  log('DEBUG', `${req.method} ${req.path}`);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log('WARN', 'Missing Bearer Token', { method: req.method, path: req.path });
    return res.status(401).send('Unauthorized: Missing Bearer Token');
  }

  const token = authHeader.split(' ')[1];
  const claims = decodeToken(token);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: KEYCLOAK_ISSUER,
      audience: KEYCLOAK_CLIENT_ID,
    });
    log('INFO', `JWT verification OK`, {
      user: payload.preferred_username || payload.email || payload.sub,
      exp: new Date(payload.exp * 1000).toLocaleTimeString('en-GB', { hour12: false }),
      iss: payload.iss || '-',
      aud: Array.isArray(payload.aud) ? payload.aud.join(',') : (payload.aud || '-'),
      method: req.method,
      path: req.path,
    });

    res.json({
      service: 'Protected Service',
      user: payload,
      message: 'Access granted to the protected resource'
    });
  } catch (e) {
    const reason = e.message.includes('"exp"')
      ? 'Token expired (exp claim failed)'
      : e.message.includes('"iss"')
      ? 'Issuer mismatch'
      : e.message.includes('"aud"')
      ? 'Audience mismatch'
      : e.message.includes('signature')
      ? 'Signature verification failed'
      : e.message;

    log('ERROR', `JWT verification failed: ${reason}`, {
      user: claims?.preferred_username || claims?.email || claims?.sub || '?',
      kid: '(see JWKS)',
      alg: claims?.alg || '?',
      method: req.method,
      path: req.path,
    });
    res.status(401).send('Unauthorized: Invalid Token');
  }
});

app.listen(port, () => {
  log('INFO', `Protected Service listening at http://localhost:${port}`, { port: String(port), jwks: JWKS_URL });
});
