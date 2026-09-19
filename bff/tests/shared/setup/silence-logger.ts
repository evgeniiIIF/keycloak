import { Logger } from '@/shared/logger/logger';

// Глушим логгер на уровне модуля — до того, как его вызовут сервисы в тестах.
// setupFilesAfterEnv исполняется после загрузки Jest-фреймворка,
// но до запуска тестовых файлов.
jest.spyOn(Logger, 'info').mockImplementation(() => undefined);
jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
