<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=realm.password && realm.registrationAllowed; section>
    <#if section = "title">
        ${msg("loginTitle",(realm.displayName)!"")}
    <#elseif section = "header">
        <#if realm.displayName?has_content>
            <h1>${realm.displayName}</h1>
        <#else>
            <h1>${msg("loginTitleHtml",(realm.displayNameHtml)!"")}</h1>
        </#if>
    <#elseif section = "form">
        <div class="login-container">
            <div class="login-card">
                <#if realm.logoUri?has_content>
                    <div class="login-logo">
                        <img src="${url.resourcesPath}${realm.logoUri}" alt="${realm.displayName!}" />
                    </div>
                <#else>
                    <div class="login-logo login-logo--icon">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="50" cy="50" r="48" fill="none" stroke="#646cff" stroke-width="2"/>
                            <path d="M50 25 C35 25 25 35 25 45 C25 55 35 60 50 70 C65 60 75 55 75 45 C75 35 65 25 50 25Z" fill="#646cff" opacity="0.15" stroke="#646cff" stroke-width="1.5"/>
                            <circle cx="50" cy="42" r="8" fill="none" stroke="#646cff" stroke-width="1.5"/>
                            <path d="M38 62 C38 54 44 50 50 50 C56 50 62 54 62 62" fill="none" stroke="#646cff" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                </#if>

                <#if message?has_content && message.type == 'error'>
                    <div class="login-alert login-alert--error" role="alert">
                        <span>${message.summary}</span>
                    </div>
                </#if>

                <form id="kc-form-login" onsubmit="return true;" action="${url.loginAction}" method="post">

                    <div class="login-field">
                        <label for="username" class="login-label">
                            <#if !realm.loginWithEmailAllowed>
                                ${msg("username")}
                            <#elseif realm.registrationEmailAsUsername>
                                ${msg("email")}
                            <#else>
                                ${msg("usernameOrEmail")}
                            </#if>
                        </label>
                        <input tabindex="1" id="username"
                               class="login-input <#if messagesPerField.existsError('username','password')>login-input--error</#if>"
                               name="username"
                               value="${(login.username!'')}"
                               autocomplete="username"
                               autofocus
                               type="text"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                        />
                    </div>

                    <div class="login-field">
                        <label for="password" class="login-label">${msg("password")}</label>
                        <div class="login-password-wrapper">
                            <input tabindex="2" id="password"
                                   class="login-input <#if messagesPerField.existsError('username','password')>login-input--error</#if>"
                                   name="password"
                                   type="password"
                                   autocomplete="current-password"
                                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                            />
                            <button type="button" class="login-password-toggle" onclick="togglePassword()" aria-label="${msg('showPassword')}">
                                <svg id="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <svg id="eye-closed" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            </button>
                        </div>
                    </div>

                    <#if realm.rememberMe?has_content && realm.rememberMe>
                        <div class="login-checkbox-row">
                            <label class="login-checkbox-label">
                                <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>>
                                <span class="login-checkbox-custom"></span>
                                ${msg("rememberMe")}
                            </label>
                        </div>
                    </#if>

                    <div class="login-actions">
                        <input type="hidden" id="kc-login" name="login" value="Log in"/>
                        <input tabindex="4" class="login-button" name="submit" type="submit" value="${msg("doLogIn")}" aria-label="${msg("doLogIn")}"/>
                    </div>
                </form>

                <#if realm.resetPasswordAllowed || realm.registrationAllowed>
                    <div class="login-footer-links">
                        <#if realm.resetPasswordAllowed>
                            <a tabindex="5" href="${url.loginRestartFlowUrl}" class="login-link">${msg("doForgotPassword")}</a>
                        </#if>
                        <#if realm.registrationAllowed>
                            <a tabindex="6" href="${url.registrationUrl}" class="login-link">${msg("doRegister")}</a>
                        </#if>
                    </div>
                </#if>
            </div>
        </div>

        <script>
            function togglePassword() {
                var input = document.getElementById('password');
                var eyeOpen = document.getElementById('eye-open');
                var eyeClosed = document.getElementById('eye-closed');
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                } else {
                    input.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                }
            }
        </script>
    <#elseif section = "info">
        <#if displayInfo>
            <div id="kc-info">
                <div id="kc-info-wrapper">
                    ${msg("loginInfoHtml")}
                </div>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
