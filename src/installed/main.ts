import './style.css';

document.documentElement.lang = chrome.i18n.getUILanguage();
const title = chrome.i18n.getMessage('installedSuccess');
document.title = title;
document.querySelector('#status')!.textContent = title;
document.querySelector('#hint')!.textContent = chrome.i18n.getMessage('installedCloseHint');
