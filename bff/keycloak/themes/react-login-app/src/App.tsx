import { useState, useEffect, FormEvent } from 'react';

interface KeycloakConfig {
  forgotPasswordUrl: string;
  registerUrl: string;
}

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRememberMe, setUseRememberMe] = useState(false);
  const [config, setConfig] = useState<KeycloakConfig>({ forgotPasswordUrl: '#', registerUrl: '#' });

  // Инициализация конфигурации и состояния из DOM
  useEffect(() => {
    initializeKeycloakState();
  }, []);

  const initializeKeycloakState = () => {
    // 1. Читаем ссылки из kc-config
    const configEl = document.getElementById('kc-config');
    if (configEl) {
      setConfig({
        forgotPasswordUrl: configEl.dataset.forgotPassword || '#',
        registerUrl: configEl.dataset.register || '#',
      });
    }

    // 2. Проверяем поддержку rememberMe
    const form = document.getElementById('kc-form-login') as HTMLFormElement;
    if (form) {
      const rm = form.querySelector('input[name="rememberMe"]');
      if (rm) setUseRememberMe(true);
    }

    // 3. Обрабатываем ошибки
    const msgEl = document.getElementById('keycloak-message');
    if (msgEl) {
      const summary = msgEl.dataset.summary;
      if (summary) setError(summary);
    }

    const params = new URLSearchParams(window.location.search);
    const urlErr = params.get('error_description') || params.get('error');
    if (urlErr) setError(decodeURIComponent(urlErr));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');

    const form = document.getElementById('kc-form-login') as HTMLFormElement;
    if (!form) return;

    syncStateToHiddenForm(form);
    form.submit();
  };

  const syncStateToHiddenForm = (form: HTMLFormElement) => {
    (form.querySelector('input[name="username"]') as HTMLInputElement).value = username;
    (form.querySelector('input[name="password"]') as HTMLInputElement).value = password;

    if (useRememberMe) {
      const rmInput = form.querySelector('input[name="rememberMe"]') as HTMLInputElement;
      if (rmInput) rmInput.value = rememberMe ? 'on' : '';
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h1>Sign in</h1>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Username or email</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                disabled={loading}
                required
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {useRememberMe && (
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                Remember me
              </label>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="login-links">
            <a href={config.forgotPasswordUrl}>Forgot password?</a>
            <a href={config.registerUrl}>Create account</a>
          </div>
        </div>
      </div>
    </div>
  );
}
