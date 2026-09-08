#  Экспорт реалма с пользователями в один файл
docker exec keycloak_server /opt/keycloak/bin/kc.sh export \
  --realm TestRealm \
  --users same_file \
  --file /tmp/realm-export.json

# Скопировать файл из контейнера
docker cp keycloak_server:/tmp/realm-export.json bff/realm-export.json

# Проверить, что пользователи попали
grep -A5 '"users"' bff/realm-export.json | head -20