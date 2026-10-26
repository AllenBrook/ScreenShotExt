import './style.css';
import { openShortcutSettings } from '../shared/settings-navigation';

const t = (key: string, subs?: string[]) => chrome.i18n.getMessage(key, subs) || key;

document.documentElement.lang = chrome.i18n.getUILanguage();
const title = t('installedSuccess');
document.title = title;
document.querySelector('#status')!.textContent = title;
document.querySelector('#hint')!.textContent = t('installedCloseHint');
document.querySelector('#ctrlG')!.textContent = t('installedCtrlGNote');

const setBtn = document.querySelector('#setShortcut') as HTMLButtonElement;
setBtn.textContent = t('installedSetShortcut');
setBtn.addEventListener('click', () => {
  void openShortcutSettings().catch(() => {
    setBtn.disabled = true;
  });
});

void chrome.commands.getAll().then((commands) => {
  const full = commands.find((c) => c.name === 'capture-full-page');
  const shortcut = full?.shortcut?.trim() ?? '';
  const line = document.querySelector('#shortcut')!;
  line.textContent = shortcut
    ? t('installedShortcutAssigned', [shortcut])
    : t('installedShortcutMissing');
});
