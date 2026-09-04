const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Environment variable ${name} is required`);
    process.exit(1);
  }
  return value;
}

const port = getEnv('PORT');
const JWKS_URL = getEnv('JWKS_URL');
const KEYCLOAK_ISSUER = getEnv('KEYCLOAK_ISSUER');
const KEYCLOAK_CLIENT_ID = getEnv('KEYCLOAK_CLIENT_ID');

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
    const now = new Date();
    const tokenExp = claims?.exp ? new Date(claims.exp * 1000) : null;
    const tokenIat = claims?.iat ? new Date(claims.iat * 1000) : null;
    const tokenAud = Array.isArray(claims?.aud) ? claims.aud.join(',') : (claims?.aud || '-');
    const tokenIss = claims?.iss || '-';

    log('ERROR', `JWT verification failed`, {
      reason: e.message,
      token_iss: tokenIss,
      expected_iss: KEYCLOAK_ISSUER,
      iss_match: tokenIss === KEYCLOAK_ISSUER ? 'YES' : 'NO',
      token_aud: tokenAud,
      expected_aud: KEYCLOAK_CLIENT_ID,
      aud_match: tokenAud === KEYCLOAK_CLIENT_ID ? 'YES' : 'NO',
      token_exp: tokenExp ? tokenExp.toISOString() : '?',
      token_iat: tokenIat ? tokenIat.toISOString() : '?',
      now: now.toISOString(),
      expired: tokenExp ? (now > tokenExp ? 'YES' : 'NO') : '?',
      token_age_sec: tokenIat ? Math.round((now - tokenIat) / 1000) : '?',
      user: claims?.preferred_username || claims?.email || claims?.sub || '?',
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
