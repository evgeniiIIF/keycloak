# Keycloak BFF Architecture Verification

## Description

Verify that the current project implementation matches the CSRF-protected BFF + Keycloak architecture spec. Compare each component against the canonical flow and report gaps.

## When to Use

- After major refactoring sessions
- When onboarding to the project and need to verify completeness
- After adding/removing services or endpoints
- When user asks "does the project match the architecture?"

## Architecture Spec (Source of Truth)

### Components

| Component | Role |
|-----------|------|
| **Keycloak** | Users, private key, publishes JWKS |
| **BFF** | Knows client_id, client_secret from env. Manages sessions in Redis. Never exposes tokens to browser. |
| **React** | UI only. No token storage. Communicates via SESSION_ID cookie + X-CSRF-Token header. |
| **Protected Service** | Validates JWT locally using JWKS. Returns 401 on expired token. |
| **Redis** | Session store: refresh_token, access_token, user_info, csrf_token |

### Flow Checklist

#### 1. Unauthenticated Request → Keycloak Login

- [ ] GET /api/files (or protected endpoint) with no SESSION_ID → 401
- [ ] React redirects to /login
- [ ] BFF generates PKCE: code_verifier (stored in session), code_challenge = SHA256(verifier)
- [ ] BFF returns 302 to Keycloak with: response_type=code, client_id, redirect_uri, scope, code_challenge, code_challenge_method=S256
- [ ] Browser shows Keycloak login form

#### 2. Authentication & Code Exchange

- [ ] User enters credentials on Keycloak
- [ ] Keycloak returns 302 to /callback?code=...
- [ ] BFF exchanges code for tokens via server-to-server POST:
  - grant_type=authorization_code, code, client_id, client_secret, code_verifier, redirect_uri
- [ ] Keycloak validates PKCE, returns access_token, refresh_token, id_token

#### 3. Session Creation & Cookie/CSRF Setup

- [ ] BFF generates SESSION_ID (UUID)
- [ ] BFF creates Redis record: refresh_token, access_token, user_info, csrf_token
- [ ] BFF sets cookie: SESSION_ID=...; HttpOnly; Secure; SameSite=Strict; Path=/
- [ ] BFF returns user info + csrf_token to React (via /api/me or response body)

#### 4. Protected Requests

- [ ] GET requests: no CSRF token required
- [ ] POST/PUT/DELETE: React sends X-CSRF-Token header
- [ ] BFF validates X-CSRF-Token against session's csrf_token → 403 if mismatch
- [ ] BFF uses access_token from session to call protected service
- [ ] Protected service validates JWT locally (JWKS): signature, expiry, roles

#### 5. Reactive Token Refresh

- [ ] If protected service returns 401 (expired token):
  - [ ] BFF uses refresh_token to get new tokens from Keycloak
  - [ ] Keycloak invalidates old refresh_token (rotation)
  - [ ] BFF updates Redis session with new tokens
  - [ ] BFF retries request with new access_token
- [ ] If refresh_token is invalid → BFF destroys session, resets cookie, returns 401
- [ ] React redirects to /login on 401

#### 6. Logout

- [ ] POST /logout with X-CSRF-Token header
- [ ] BFF validates CSRF, deletes session from Redis, resets SESSION_ID cookie
- [ ] BFF redirects to Keycloak logout endpoint (with id_token_hint + post_logout_redirect_uri)

## Verification Script

Run these checks against the running project:

```bash
# 1. Check BFF source for key files
ls bff/src/auth/          # auth module
ls bff/src/redis/         # redis service
ls bff/src/session/       # session management
ls bff/src/config/        # configuration

# 2. Check env variables in docker-compose.yml
grep -E 'KEYCLOAK|REDIS|SESSION' docker-compose.yml

# 3. Verify CSRF token flow in BFF
grep -r "X-CSRF-Token\|csrf" bff/src/ --include="*.ts"

# 4. Verify token refresh logic
grep -r "refresh_token\|refreshAccessToken\|handleRefreshError" bff/src/ --include="*.ts"

# 5. Verify cookie settings
grep -r "httpOnly\|sameSite\|Secure" bff/src/ --include="*.ts"

# 6. Verify protected service JWT validation
grep -r "jwtVerify\|jwks\|JWKS" protected-service/ --include="*.js" --include="*.ts"

# 7. Test the full flow (after docker compose up)
curl -v http://localhost:3000/api/me 2>&1 | grep -E "401|Set-Cookie|SESSION_ID"
```

## Common Gaps to Watch For

- Missing CSRF validation on mutating endpoints
- Tokens leaked to browser (stored in localStorage or React state)
- Missing refresh token rotation
- Hardcoded values that should be in env (client_id, issuer URLs, etc.)
- Cookie missing HttpOnly/Secure/SameSite flags
- Protected service not validating JWT locally
