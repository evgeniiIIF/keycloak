import { TokenSet, KeycloakJwtPayload } from '../../types/keycloak';
export declare const validTokenSet: TokenSet;
export declare const refreshedTokenSet: TokenSet;
export declare const idTokenPayload: KeycloakJwtPayload;
export declare function initFixtures(): Promise<void>;
