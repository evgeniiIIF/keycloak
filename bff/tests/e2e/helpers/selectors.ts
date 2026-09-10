export const KEYCLOAK_SELECTORS = {
  usernameInput: '#username',
  passwordInput: '#password',
  submitButton: '.login-button',
  togglePasswordButton: '.toggle-password',
  errorMessage: '.login-error',
  forgotPasswordLink: '.login-links a:has-text("Forgot password?")',
  registerLink: '.login-links a:has-text("Create account")',
  rememberMeCheckbox: '.remember-me input[type="checkbox"]',
} as const;
