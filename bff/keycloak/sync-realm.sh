#!/usr/bin/env bash
set -euo pipefail

REALM="${KEYCLOAK_REALM:-TestRealm}"
CONTAINER="keycloak_server"
KEYCLOAK_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_FILE="$KEYCLOAK_DIR/realm-export.json"
TMP_FILE="/tmp/realm-export-$$.json"

echo "📤 Экспорт realm '$REALM' из '$CONTAINER'..."

docker compose exec -T keycloak \
  /opt/keycloak/bin/kc.sh export \
  --realm "$REALM" \
  --users same_file \
  --file "$TMP_FILE"

docker cp "$CONTAINER:$TMP_FILE" "$BACKUP_FILE"
docker compose exec -T keycloak rm "$TMP_FILE"

echo "✅ $BACKUP_FILE"
