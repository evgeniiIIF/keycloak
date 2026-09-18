/**
 * Селекторы для кастомной формы Keycloak (themes/custom-login).
 *
 * Используем data-testid — стабильные селекторы, не зависящие от CSS-классов
 * и языка интерфейса. При изменении формы менять только здесь.
 */
export const KEYCLOAK_SELECTORS = {
  // Форма и карточка
  loginCard: '[data-testid="login-card"]',
  loginForm: '#kc-form-login',

  // Поля ввода
  usernameInput: '[data-testid="username-input"]',
  passwordInput: '[data-testid="password-input"]',

  // Кнопки
  submitButton: '[data-testid="submit-button"]',
  togglePasswordButton: '[data-testid="toggle-password"]',

  // Ошибка аутентификации (глобальный алерт над формой)
  errorMessage: '[data-testid="error-alert"]',

  // Ссылка регистрации
  registerLink: '[data-testid="register-link"]',

  // Опциональные элементы
  rememberMeCheckbox: '[data-testid="remember-me-checkbox"]',
} as const;
