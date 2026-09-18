<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=realm.password && realm.registrationAllowed; section>
    <#if section = "title">
        ${msg("loginTitle",(realm.displayName)!"")}
    <#elseif section = "header">
        <h1>${msg("loginTitleHtml",(realm.displayNameHtml)!"")}</h1>
    <#elseif section = "form">
        <div class="login-page">
            <div class="login-card" data-testid="login-card">
                <#if realm.logoUri?has_content>
                    <div class="login-card__logo">
                        <img src="${url.resourcesPath}${realm.logoUri}" alt="${realm.displayName!}" />
                    </div>
                <#else>
                    <div class="login-card__logo login-card__logo--icon">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="50" cy="50" r="48" fill="none" stroke="#646cff" stroke-width="2"/>
                            <path d="M50 25 C35 25 25 35 25 45 C25 55 35 60 50 70 C65 60 75 55 75 45 C75 35 65 25 50 25Z" fill="#646cff" opacity="0.15" stroke="#646cff" stroke-width="1.5"/>
                            <circle cx="50" cy="42" r="8" fill="none" stroke="#646cff" stroke-width="1.5"/>
                            <path d="M38 62 C38 54 44 50 50 50 C56 50 62 54 62 62" fill="none" stroke="#646cff" stroke-linecap="round"/>
                        </svg>
                    </div>
                </#if>
                <h1 class="login-card__title">${msg("loginAccountTitle")}</h1>
                <#if message?has_content && message.type == 'error'>
                    <div id="login-error-alert"
                         class="login-alert login-alert--error"
                         role="alert"
                         aria-live="polite"
                         data-testid="error-alert">
                        <span>${message.summary}</span>
                    </div>
                </#if>
                <form id="kc-form-login"
                      class="login-form"
                      action="${url.loginAction}"
                      method="post">
                    <div class="login-form__field">
                        <label for="username" class="login-form__label">
                            <#if !realm.loginWithEmailAllowed>
                                ${msg("username")}
                            <#elseif realm.registrationEmailAsUsername>
                                ${msg("email")}
                            <#else>
                                ${msg("usernameOrEmail")}
                            </#if>
                        </label>
                        <input id="username"
                               class="login-form__input <#if messagesPerField.existsError('username','password')>login-form__input--error</#if>"
                               name="username"
                               value="${(login.username!'')}"
                               autocomplete="username"
                               autofocus
                               type="text"
                               required
                               aria-required="true"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true<#else>false</#if>"
                               <#if message?has_content && message.type == 'error'>aria-describedby="login-error-alert"</#if>
                               data-testid="username-input"
                        />
                    </div>
                    <div class="login-form__field">
                        <label for="password" class="login-form__label">${msg("password")}</label>
                        <div class="login-form__password-wrapper">
                            <input id="password"
                                   class="login-form__input <#if messagesPerField.existsError('username','password')>login-form__input--error</#if>"
                                   name="password"
                                   type="password"
                                   autocomplete="current-password"
                                   required
                                   aria-required="true"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true<#else>false</#if>"
                                   <#if message?has_content && message.type == 'error'>aria-describedby="login-error-alert"</#if>
                                   data-testid="password-input"
                            />
                            <button type="button"
                                    class="login-form__toggle"
                                    onclick="togglePassword()"
                                    aria-label="${msg('showPassword')}"
                                    aria-pressed="false"
                                    data-testid="toggle-password">
                                <svg id="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                <svg id="eye-closed" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 4.24 0 0112 4.24a9.12 9.12 0 012.1.15M12 12h.01"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="login-form__checkbox-row">
                        <label class="login-form__checkbox-label">
                            <input type="checkbox" name="rememberMe" id="rememberMe" data-testid="remember-me-checkbox">
                            <span class="login-form__checkbox-custom"></span>
                            ${msg("rememberMe")}
                        </label>
                    </div>
                    <div class="login-form__actions">
                        <button type="submit" class="login-form__button" data-testid="submit-button">
                            ${msg("doLogIn")}
                        </button>
                    </div>
                </form>
                <div class="login-footer">
                    <#if url.forgotPasswordUrl??>
                        <a href="${url.forgotPasswordUrl}" class="login-footer__link" data-testid="forgot-password-link">${msg("doForgotPassword")}</a>
                    </#if>
                    <#if url.registrationUrl??>
                        <a href="${url.registrationUrl}" class="login-footer__link" data-testid="register-link">${msg("doRegister")}</a>
                    </#if>
                </div>
            </div>
        </div>

        <script>
            function togglePassword() {
                const passwordInput = document.getElementById('password');
                const eyeOpen = document.getElementById('eye-open');
                const eyeClosed = document.getElementById('eye-closed');
                const btn = document.querySelector('.login-form__toggle');

                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                    btn.setAttribute('aria-pressed', 'true');
                    btn.setAttribute('aria-label', '${msg("hidePassword")}');
                } else {
                    passwordInput.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                    btn.setAttribute('aria-pressed', 'false');
                    btn.setAttribute('aria-label', '${msg("showPassword")}');
                }
            }
        </script>
    </#if>
</@layout.registrationLayout>
