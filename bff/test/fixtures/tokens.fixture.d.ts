import { TokenSet, KeycloakJwtPayload } from '../../src/types/keycloak';
export declare const validTokenSet: TokenSet;
export declare const refreshedTokenSet: TokenSet;
export declare const idPayload: KeycloakJwtPayload;
export declare function initFixtures(): Promise<void>;
