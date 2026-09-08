"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idPayload = exports.refreshedTokenSet = exports.validTokenSet = void 0;
exports.initFixtures = initFixtures;
const jose_1 = require("jose");
const secret = new TextEncoder().encode('test-secret-key-for-jwt-signing');
async function createTestIdToken() {
    return new jose_1.SignJWT({
        email: 'test@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
        realm_access: { roles: ['user'] },
        resource_access: {},
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('6a1e0d1a-2461-403f-bd11-d79c7efb3ebd')
        .setIssuer('http://localhost:8080/realms/TestRealm')
        .setAudience('bff-client')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}
exports.validTokenSet = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    id_token: '',
};
exports.refreshedTokenSet = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    id_token: 'new-id-token',
};
exports.idPayload = {
    sub: '6a1e0d1a-2461-403f-bd11-d79c7efb3ebd',
    email: 'test@example.com',
    preferred_username: 'testuser',
    name: 'Test User',
    realm_access: { roles: ['user'] },
    resource_access: {},
};
async function initFixtures() {
    exports.validTokenSet.id_token = await createTestIdToken();
}
//# sourceMappingURL=tokens.fixture.js.map