<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${msg("loginTitle",(realm.displayName)!'')}</title>
    <link href="${url.resourcesPath}/js/login.css" rel="stylesheet" />
</head>
<body class="${bodyClass}">
    <div id="root"></div>
    <#nested>
    <script type="module" src="${url.resourcesPath}/js/login-bundle.js"></script>
</body>
</html>
</#macro>
