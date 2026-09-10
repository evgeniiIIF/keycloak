export const KEYCLOAK_SELECTORS = {
  usernameInput: '#username',
  passwordInput: '#password',
  submitButton: '.login-button',
  togglePasswordButton: '.login-password-toggle',
  errorMessage: '.login-field-error',
  forgotPasswordLink: '.login-footer-links a:has-text("Forgot password?")',
  registerLink: '.login-footer-links a:has-text("Create account")',
  rememberMeCheckbox: '#rememberMe',
} as const;
