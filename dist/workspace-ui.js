const root = document.documentElement;
const themeButton = document.getElementById('themeToggle');
const mobile = window.matchMedia('(max-width: 760px)');
const viewButtons = Array.from(document.querySelectorAll('[data-workspace-view]'));

function updateThemeButton() {
  const light = root.dataset.theme === 'light';
  const label = `Switch to ${light ? 'dark' : 'light'} theme`;
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  themeButton.setAttribute('aria-pressed', String(light));
  document.querySelector('meta[name="theme-color"]').content = light ? '#ffffff' : '#222731';
}

themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('gllab:theme', root.dataset.theme); } catch {}
  updateThemeButton();
  window.dispatchEvent(new CustomEvent('gllab:theme', { detail: { theme: root.dataset.theme } }));
});
updateThemeButton();

function refreshEditor() {
  requestAnimationFrame(() => {
    document.querySelector('.CodeMirror')?.CodeMirror?.refresh();
  });
}

function selectView(view, { focus = false } = {}) {
  const button = viewButtons.find(item => item.dataset.workspaceView === view);
  if (!button) return;
  document.body.dataset.view = view;
  for (const item of viewButtons) {
    const selected = item === button;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  if (focus) button.focus();
  if (view === 'editor') refreshEditor();
}

for (const button of viewButtons) {
  button.addEventListener('click', () => selectView(button.dataset.workspaceView));
  button.addEventListener('keydown', event => {
    const index = viewButtons.indexOf(button);
    let next;
    if (event.key === 'ArrowRight') next = viewButtons[(index + 1) % viewButtons.length];
    if (event.key === 'ArrowLeft') next = viewButtons[(index + viewButtons.length - 1) % viewButtons.length];
    if (event.key === 'Home') next = viewButtons[0];
    if (event.key === 'End') next = viewButtons[viewButtons.length - 1];
    if (next) {
      event.preventDefault();
      selectView(next.dataset.workspaceView, { focus: true });
    }
  });
}

// Compiler actions may select the useful mobile view without taking keyboard focus.
window.addEventListener('gllab:view', event => {
  if (mobile.matches) selectView(event.detail?.view);
});
mobile.addEventListener('change', refreshEditor);
window.addEventListener('resize', refreshEditor);
window.addEventListener('pageshow', refreshEditor);

// Every new program opens in the editor, including a lab selected from the drawer.
for (const id of ['newBtn', 'confirmReplace', 'confirmReset']) {
  document.getElementById(id).addEventListener('click', () => selectView('editor'));
}
document.getElementById('labList').addEventListener('click', event => {
  if (event.target.closest('.lab-button')) selectView('editor');
});

// On narrower screens the file actions live in a File menu. It is a disclosure of the same buttons.
const fileMenu = document.getElementById('fileMenu');
const fileMenuButton = document.getElementById('fileMenuBtn');
const fileActions = document.getElementById('fileActions');
const menuMode = window.matchMedia('(max-width: 1180px)');

function setFileMenu(open, { focus = false } = {}) {
  fileMenu.classList.toggle('open', open);
  fileMenuButton.setAttribute('aria-expanded', String(open));
  if (open && focus) fileActions.querySelector('button')?.focus();
}

fileMenuButton.addEventListener('click', () => {
  setFileMenu(!fileMenu.classList.contains('open'), { focus: true });
});
// Capture phase: close first so dialogs opened by an action return focus to the visible File button.
fileActions.addEventListener('click', event => {
  if (!menuMode.matches || !event.target.closest('button')) return;
  setFileMenu(false);
  fileMenuButton.focus();
}, true);
fileActions.addEventListener('keydown', event => {
  if (!menuMode.matches || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(fileActions.querySelectorAll('button'));
  const index = items.indexOf(document.activeElement);
  const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
  event.preventDefault();
  items[(next + items.length) % items.length].focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && fileMenu.classList.contains('open')) {
    setFileMenu(false);
    fileMenuButton.focus();
  }
});
document.addEventListener('pointerdown', event => {
  if (fileMenu.classList.contains('open') && !fileMenu.contains(event.target)) setFileMenu(false);
});
fileMenu.addEventListener('focusout', event => {
  if (menuMode.matches && event.relatedTarget && !fileMenu.contains(event.relatedTarget)) setFileMenu(false);
});
menuMode.addEventListener('change', () => setFileMenu(false));

// Show the shortcut that matches the visitor's keyboard.
if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  document.getElementById('runShortcut').textContent = '⌘ ↵';
}

// The hidden library can resize the editor independently of the browser viewport.
const observer = new ResizeObserver(refreshEditor);
observer.observe(document.getElementById('editorHost'));
