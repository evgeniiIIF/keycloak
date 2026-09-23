import { AppLogger } from '@/shared/logger/app-logger.service';

// Глушим AppLogger в unit-тестах: тесты проверяют поведение, а не логи.
// setupFilesAfterEnv исполняется после загрузки Jest-фреймворка,
// но до запуска тестовых файлов.
jest.spyOn(AppLogger.prototype, 'info').mockImplementation(() => undefined);
jest.spyOn(AppLogger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(AppLogger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(AppLogger.prototype, 'debug').mockImplementation(() => undefined);
jest.spyOn(AppLogger.prototype, 'setContext').mockImplementation(() => undefined);
