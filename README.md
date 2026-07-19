docker compose up -d postgres keycloak redis
kill -9 $(lsof -t -i:3000)

# Удалить все ключи, начинающиеся с "sess:"
docker exec redis_session_store redis-cli KEYS "sess:*" | xargs docker exec redis_session_store redis-cli DEL

BFF (Backend-for-Frontend) - принимает запросы от браузера, общается с Keycloak, хранит токены в сессии, проксирует запросы к Protected Service.


Protected Service (защищенный-сервис) - при первой загрузке обращиется за JWKS к Keycloak (issuer-uri/JWKS), проверяет JWT локально по JWKS, без обращений к Keycloak.

Keycloak (Identity Provider) - выдает токены, хранит пользователей и роли. 