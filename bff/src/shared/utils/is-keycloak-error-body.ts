import type { KeycloakErrorBody } from '../../types/keycloak';

export function isKeycloakErrorBody(data: unknown): data is KeycloakErrorBody {
  return typeof data === 'object' && data !== null;
}
