
const express = require('express');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();
const port = process.env.PORT || 8080;
const JWKS_URL = process.env.JWKS_URL; // e.g., http://keycloak:8080/realms/master/protocol/openid-connect/certs

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

app.get('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: Missing Bearer Token');
  }

  const token = authHeader.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    res.json({
      service: 'Protected Service',
      user: payload,
      message: 'Access granted to the protected resource'
    });
  } catch (e) {
    console.error('JWT Verification failed:', e.message);
    res.status(403).send('Forbidden: Invalid Token');
  }
});

app.listen(port, () => {
  console.log(`Protected Service stub listening at http://localhost:${port}`);
});
