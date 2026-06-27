<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title!}</title>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>
<body>
    <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
        <#if message.type == 'error'>
            <div class="login-alert login-alert--error">
                <span>${message.summary}</span>
            </div>
        <#elseif message.type == 'success'>
            <div class="login-alert login-alert--info">
                <span>${message.summary}</span>
            </div>
        <#elseif message.type == 'warning'>
            <div class="login-alert login-alert--info">
                <span>${message.summary}</span>
            </div>
        <#else>
            <div class="login-alert login-alert--info">
                <span>${message.summary}</span>
            </div>
        </#if>
    </#if>

    <#nested "form">

    <#if displayInfo>
        <#nested "info">
    </#if>
</body>
</html>
</#macro>
