# Code Style: Stepdown Rule + Declarative Storytelling

## Основная цель
Каждая функция — **карта логики**, читается сверху вниз как сценарий.
Читатель видит **общий план** сразу и опускается в детали только осознанно.

## Главные правила

### 1. Верхний уровень функции — чистый сюжет
Тело состоит только из:
- вызовов методов с говорящими именами,
- управляющих конструкций (`try/catch`, `if/else if`), которые показывают **ветвление сценария**.

Внутри `try`, `catch`, `if` — **только вызовы методов**, никакой реализации, вычислений, мутаций.

### 2. Каждый метод — один шаг на одном уровне абстракции
Имя метода: `глагол + объект` (`validateRetry`, `getSession`, `markRetry`, `applyToken`).
Метод либо содержит **следующий уровень сюжета**, либо является **примитивом**.

### 3. Декомпозиция до примитивов
Функция декомпозируется до тех пор, пока не останется:
- простой `return`,
- одна проверка,
- один вызов внешнего API/сервиса.

**Критерий примитива**: если метод делает ровно одну проверку, один вызов, или один return — он примитив. Не разбивай дальше.

**Не декомпозируй**: простые CRUD-операции, геттеры,单一 вызовы API, однострочные хелперы. Декомпозиция нужна когда функция рассказывает историю, а не когда она делает одну вещь.

### 4. Имена заменяют комментарии
Имя метода должно точно выражать намерение:
- `validateRetry(error)` — проверяет и бросает ошибку, если ретрай невозможен.
- `getSession()` — возвращает сессию или бросает ошибку, если её нет.
- `markRetry(config)` — помечает конфиг как повторный запрос.
- `applyToken(session, config)` — записывает access-токен в заголовки.

Комментарии только для неочевидных бизнес-правил, предупреждений о побочных эффектах, TODO.

### 5. Guard clauses без else
Проверки с немедленным выходом (`throw`/`return`) в начале метода.
Основной сценарий не проваливается в `else`.

### 6. Комментарии: описание + дерево + инлайны
Над функцией — **описание** что делает (одно предложение).
Внутри — **дерево** ветвлений (если их много) + **инлайны** у каждой строки.

**Описание сверху:**
```typescript
// Обновляем токен и повторяем запрос или кидаем ошибку
private async handleResponseError(error: AxiosError) {
```

**Инлайны** — поясняют каждую строку, включая "или кидает ошибку":
```typescript
  try {
    await this.refreshTokens(error);        // обновляем токен или кидает ошибку
    return this.client(error.config);       // повторяем запрос или кидает ошибку
  } catch (err) {
    await this.handleRefreshError(err);     // обрабатываем ошибку
    throw err;                              // пробрасываем
  }
```

**If/else ветвление:**
```typescript
// Обрабатываем ошибку обновления токена
// invalid_grant → уничтожаем сессию и бросаем, иное → логируем
private async handleRefreshError(err: unknown) {
  if (this.isInvalidGrant(err)) {
    await this.destroySession();            // уничтожаем сессию
    throw new UnauthorizedException('Session expired');  // бросаем
  }
  Logger.error('HttpClient', `Refresh failed: ${errorMessage(err)}`);  // логируем
}
```

**Try/finally:**
```typescript
// Обновляем токен с блокировкой от параллельных обновлений
private async performRefresh(session: BffSession, config: RetryableConfig) {
  const acquired = await this.refreshLock.acquire(session.id);  // пытаемся забрать lock
  if (!acquired) {
    await this.waitForConcurrentRefresh(session, config);      // ждём параллельное
    return;
  }
  try {
    await this.executeTokenRefresh(session, config);           // обновляем токен или кидает ошибку
  } finally {
    await this.refreshLock.release(session.id);                // освобождаем lock в любом случае
  }
}
```

### 7. Антипаттерны

```typescript
// ❌ Антипаттерн: логика внутри try
async handleRequest() {
  try {
    const session = await this.getSession();
    const token = session.accessToken;                        // мутация
    const headers = { Authorization: `Bearer ${token}` };     // вычисление
    return this.client.get(url, { headers });                 // реализация
  } catch (err) { ... }
}

// ✅ Правильно:
async handleRequest() {
  try {
    const session = await this.getSession();
    const config = this.buildAuthConfig(session);             // один шаг
    return this.client.get(url, config);                      // один шаг
  } catch (err) { ... }
}

// ❌ Антипаттерн: результат вызова передаётся напрямую в другой метод
async login(@Req() req: Request, @Res() res: Response) {
  res.redirect(this.authService.buildAuthorizationUrl(req.session));
}

// ✅ Правильно: сначала сохраняем в переменную, потом передаём
// Результат метода → переменная → использование
async login(@Req() req: Request, @Res() res: Response) {
  const authorizationUrl = this.authService.buildAuthorizationUrl(req.session);
  res.redirect(authorizationUrl);
}
```

### 8. Типизация: явные типы вместо Record<string, any>

Все типы должны быть явными. `Record<string, any>`, `Record<string, string>`, `any` — антипаттерны.

```typescript
// ❌ Антипаттерн: тип не описывает контракт
async handleCallback(query: Record<string, string>, session: BffSession) {
  if (query.error) { ... }
  if (!query.code || !query.state) { ... }
}

// ✅ Правильно: явный интерфейс описывает ожидаемые параметры
export interface OAuthCallbackQuery {
  error?: string;   // ошибка от OAuth провайдера
  code?: string;    // authorization code
  state?: string;   // CSRF параметр
}

async handleCallback(query: OAuthCallbackQuery, session: BffSession) {
  if (query.error) { ... }
  if (!query.code || !query.state) { ... }
}
```

**Правила:**
- Определяй interface/type для DTO, query params, configs — там где `Record` не описывает реальную структуру
- Используй `unknown` вместо `any` когда тип неизвестен, но старайся избегать, все должно быть типизированно типами и интерфейсами
- Экспортируй интерфейсы если они используются в нескольких местах

## SOLID, KISS, DRY
- **S** — класс и каждый метод отвечают за одну задачу.
- **O** — класс открыт для расширения через композицию (новые стратегии), закрыт для модификации.
- **L** — подклассы не ломают контракт родителя.
- **I** — зависимости узкие, ничего лишнего. Импортируй только то, что используешь.
- **D** — зависимости внедряются через конструктор (инверсия контроля).
- **KISS** — простота ради понимания: верхний уровень читается как рассказ.
- **DRY** — дублирование логики устранено, но без фанатизма: примитивы не дублируются, лишние абстракции не создаются.

## Ключевой приём: карта логики через try/catch
Если в функции есть альтернативные сценарии, они оформляются как `try/catch` с **ясно видимыми ветками**:

```typescript
// Обновляем токен и повторяем запрос или кидаем ошибку
private async handleResponseError(error: AxiosError) {
  try {
    await this.refreshTokens(error);        // обновляем токен или кидает ошибку
    return this.client(error.config);       // повторяем запрос или кидает ошибку
  } catch (err) {
    await this.handleRefreshError(err);     // обрабатываем ошибку
    throw err;                              // пробрасываем
  }
}
```

## Эталонный пример: AxiosHttpClient

5 уровней абстракции, каждый чистый:

| Level | Что | Пример |
|-------|-----|--------|
| 1 | Карта логики | `handleResponseError` — try/catch |
| 2 | Оглавление | `refreshTokens` — 4 вызова, ничего больше |
| 3 | Шаги с деталями | `validateRetry`, `getSession`, `markRetry`, `performRefresh` |
| 4 | Атомарные действия | `executeTokenRefresh`, `handleRefreshError` |
| 5 | Примитивы | `canRetry`, `isInvalidGrant`, `applyToken` |

```typescript
export class AxiosHttpClient {
  // ... constructor, interceptors ...

  // Обновляем токен и повторяем запрос или кидаем ошибку
  private async handleResponseError(error: AxiosError) {
    try {
      await this.refreshTokens(error);        // обновляем токен или кидает ошибку
      return this.client(error.config);       // повторяем запрос или кидает ошибку
    } catch (err) {
      await this.handleRefreshError(err);     // обрабатываем ошибку
      throw err;                              // пробрасываем
    }
  }

  // Обновляем access token через refresh token или кидаем ошибку
  private async refreshTokens(error: AxiosError) {
    this.validateRetry(error);                                   // проверяем можно ли повторить или кидает ошибку
    const session = this.getSession();                           // берём сессию или кидает ошибку
    const config = this.markRetry(error.config);                 // помечаем как повтор
    await this.performRefresh(session, config);                  // обновляем токен или кидает ошибку
  }

  private validateRetry(error: AxiosError) {
    if (!this.canRetry(error)) throw error;
  }

  private getSession(): BffSession {
    const session = this.sessions.get();
    if (!session?.id) throw new Error('No session for token refresh');
    return session;
  }

  private markRetry(config: InternalAxiosRequestConfig): RetryableConfig {
    return { ...config, _retry: true };
  }

  // Обновляем токен с блокировкой от параллельных обновлений
  private async performRefresh(session: BffSession, config: RetryableConfig) {
    const acquired = await this.refreshLock.acquire(session.id);  // пытаемся забрать lock
    if (!acquired) {
      await this.waitForConcurrentRefresh(session, config);      // ждём параллельное
      return;
    }
    try {
      await this.executeTokenRefresh(session, config);           // обновляем токен или кидает ошибку
    } finally {
      await this.refreshLock.release(session.id);                // освобождаем lock в любом случае
    }
  }

  // Ждём пока другой поток обновит токен → перезагружаем сессию → применяем новый токен
  private async waitForConcurrentRefresh(session: BffSession, config: RetryableConfig) {
    Logger.warn('HttpClient', 'Waiting for concurrent refresh', { url: config.url });
    await this.refreshLock.waitAndRetry(session.id);
    await this.sessions.reload(session);
    this.applyToken(session, config);
  }

  // Обновляем токен через auth сервис → сохраняем сессию → применяем новый токен
  private async executeTokenRefresh(session: BffSession, config: RetryableConfig) {
    Logger.warn('HttpClient', 'Refreshing token', { url: config.url });
    await this.authService.refreshTokens(session);
    await this.sessions.save(session);
    this.applyToken(session, config);
    Logger.info('HttpClient', 'Token refreshed', { url: config.url });
  }

  // Обрабатываем ошибку обновления токена
  // invalid_grant → уничтожаем сессию и бросаем, иное → логируем
  private async handleRefreshError(err: unknown) {
    if (this.isInvalidGrant(err)) {
      await this.destroySession();            // уничтожаем сессию
      throw new UnauthorizedException('Session expired');  // бросаем
    }
    Logger.error('HttpClient', `Refresh failed: ${errorMessage(err)}`);  // логируем
  }

  private async destroySession() {
    Logger.error('HttpClient', 'invalid_grant — destroying session');
    const session = this.sessions.get();
    if (session) await this.sessions.destroy(session);
  }

  private canRetry(error: AxiosError): boolean {
    const config = error.config as RetryableConfig | undefined;
    const session = this.sessions.get();
    return (
      error.response?.status === 401 &&
      !!config &&
      !config._retry &&
      !!session?.refreshToken &&
      !!session?.id
    );
  }

  private isInvalidGrant(error: any): boolean {
    return error?.response?.status === 400 && error?.response?.data?.error === 'invalid_grant';
  }

  private applyToken(session: BffSession, config: RetryableConfig) {
    if (session.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
  }
}
```

Ключевые принципы примера:
- **Level 2 чистый** — `refreshTokens` это 4 вызова, ничего больше. Ни мутаций, ни кастов, ни guard-ов.
- **`markRetry` — чистая функция** — возвращает новый объект, не мутирует `config`.
- **Каждый Level вызывает только следующий ниже** — Level 1 не трогает Level 3-5.
