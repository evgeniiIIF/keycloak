<#import "template.ftl" as layout>
<@layout.registrationLayout>
    <div id="kc-config"
         data-url="${url.loginAction}"
         data-forgot-password="${url.loginForgotPasswordAction!''}"
         data-register="${url.registrationAction!''}">
    </div>
    <form id="kc-form-login" style="display:none" action="${url.loginAction}" method="post">
        <input type="text" name="username" autocomplete="username" />
        <input type="password" name="password" autocomplete="current-password" />
        <input type="hidden" name="login" value="Log in" />
    </form>
</@layout.registrationLayout>
