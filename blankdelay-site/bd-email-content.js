/* BlankDelay - shared purchase email copy */
const BD_EMAIL_CONTENT = {
    securityTitle: 'Windows may show a security warning - your download is safe',
    securityNotice: 'When you download BlankDelay-Setup.exe, Windows or your browser may warn that the file is unsafe, a virus, or from an unknown publisher. This is a normal false positive for new indie software. BlankDelay is not a virus - we are a new publisher and the app is not code-signed yet.',
    downloadHelp: 'IF YOUR BROWSER BLOCKS THE DOWNLOAD:\n- Chrome/Edge: click the download arrow, then Keep or Download anyway\n- Or right-click the download link and Save link as\n\nIF WINDOWS SAYS "Windows protected your PC":\n- Click More info\n- Click Run anyway\n\nIF WINDOWS DEFENDER BLOCKS IT:\n- Open Windows Security > Virus and threat protection > Protection history\n- Find BlankDelay-Setup.exe > Actions > Allow on device\n\nBlankDelay does not inject into games or steal data. 14-day money-back guarantee.'
};
function bdEmailTemplateExtras() {
    return {
        security_title: BD_EMAIL_CONTENT.securityTitle,
        security_notice: BD_EMAIL_CONTENT.securityNotice,
        download_help: BD_EMAIL_CONTENT.downloadHelp
    };
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BD_EMAIL_CONTENT, bdEmailTemplateExtras };
}
