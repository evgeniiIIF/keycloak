
const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();
const port = process.env.PORT || 8080;
const JWKS_URL = process.env.JWKS_URL;

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

function log(level, msg) {
  const ts = GRAY + new Date().toLocaleTimeString('en-GB', { hour12: false }) + RESET;
  const svc = GREEN + '[ProtectedService]' + RESET;
  const lvl = level === 'INFO' ? GREEN + '[INFO]' + RESET
            : level === 'WARN' ? YELLOW + '[WARN]' + RESET
            : RED + '[ERROR]' + RESET;
  console.log(`${ts} ${svc} ${lvl} ${msg}`);
}

app.get('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log('WARN', 'Missing Bearer Token');
    return res.status(401).send('Unauthorized: Missing Bearer Token');
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    log('INFO', `JWT verification OK (user=${payload.preferred_username || payload.email || payload.sub})`);

    res.json({
      service: 'Protected Service',
      user: payload,
      message: 'Access granted to the protected resource'
    });
  } catch (e) {
    log('ERROR', `JWT verification failed: ${e.message}`);
    res.status(401).send('Unauthorized: Invalid Token');
  }
});

app.listen(port, () => {
  log('INFO', `Protected Service listening at http://localhost:${port}`);
});
