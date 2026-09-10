import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Читаем .env — Playwright использует те же настройки, что и BFF
dotenv.config();

const BFF_URL = process.env.BFF_URL || 'http://localhost:3000';
const KEYCLOAK_URL = process.env.KEYCLOAK_PUBLIC_ISSUER || 'http://localhost:8080/realms/TestRealm';

export default defineConfig({
  testDir: './tests/e2e',

  // Тесты авторизации меняют состояние (сессии, CSRF) — нельзя параллелить
  fullyParallel: false,
  workers: 1,

  // В CI — падать сразу, если забыл test.only
  forbidOnly: !!process.env.CI,

  // Retry только в CI
  retries: process.env.CI ? 2 : 0,

  // Репортеры
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report' }], ['list'], ['github']]
    : [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Общие настройки для всех проектов
  use: {
    baseURL: BFF_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  // Таймауты
  timeout: 60000,
  expect: { timeout: 10000 },

  // Проекты
  projects: [
    // API-тесты — headless
    {
      name: 'api',
      testDir: './tests/e2e/api',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },

    // UI-тесты — headed (визуальный режим)
    {
      name: 'ui',
      testDir: './tests/e2e/ui',
      use: {
        ...devices['Desktop Chrome'],
        headless: process.env.CI ? true : false,  // в CI — headless, локально — headed
      },
    },
  ],

  // Глобальные переменные для тестов
  metadata: {
    bffUrl: BFF_URL,
    keycloakUrl: KEYCLOAK_URL,
  },
});
