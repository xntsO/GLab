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

// Layout state affects visibility only: mounted editors and running graphics survive.
const workbench = document.querySelector('.workbench');
const layoutKey = 'gllab:layout:v1';
const defaultLayout = { output: true, console: true, editorWidth: 50, consoleHeight: 32 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let layout = { ...defaultLayout };
let beforeFocus = null;
try {
  const saved = JSON.parse(localStorage.getItem(layoutKey));
  if (saved && typeof saved === 'object') {
    for (const key of ['output', 'console']) if (typeof saved[key] === 'boolean') layout[key] = saved[key];
    if (Number.isFinite(saved.editorWidth)) layout.editorWidth = clamp(saved.editorWidth, 25, 75);
    if (Number.isFinite(saved.consoleHeight)) layout.consoleHeight = clamp(saved.consoleHeight, 15, 65);
  }
} catch {}

function applyLayout(persist = true) {
  workbench.dataset.outputHidden = String(!layout.output);
  workbench.dataset.consoleHidden = String(!layout.console);
  workbench.style.setProperty('--editor-width', `${layout.editorWidth}%`);
  workbench.style.setProperty('--console-height', `${layout.consoleHeight}%`);
  for (const panel of ['output', 'console']) {
    const button = document.getElementById(panel === 'output' ? 'toggleOutput' : 'toggleConsole');
    button.setAttribute('aria-pressed', String(layout[panel]));
    button.title = `${layout[panel] ? 'Hide' : 'Show'} ${panel}`;
  }
  const focused = !layout.output && !layout.console;
  document.getElementById('focusCode').setAttribute('aria-pressed', String(focused));
  document.getElementById('focusCode').textContent = focused ? 'Restore panels' : 'Focus code';
  document.getElementById('outputResize').setAttribute('aria-valuenow', String(Math.round(layout.editorWidth)));
  document.getElementById('outputResize').setAttribute('aria-valuetext', `${Math.round(layout.editorWidth)} percent code width`);
  document.getElementById('consoleResize').setAttribute('aria-valuenow', String(Math.round(layout.consoleHeight)));
  document.getElementById('consoleResize').setAttribute('aria-valuetext', `${Math.round(layout.consoleHeight)} percent console height`);
  if (persist) try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch {}
  refreshEditor();
}
for (const panel of ['output', 'console']) {
  const toggle = document.getElementById(panel === 'output' ? 'toggleOutput' : 'toggleConsole');
  const hide = document.getElementById(panel === 'output' ? 'hideOutput' : 'hideConsole');
  toggle.addEventListener('click', () => { layout[panel] = !layout[panel]; beforeFocus = null; applyLayout(); });
  hide.addEventListener('click', () => {
    if (mobile.matches) { selectView('editor', { focus: true }); return; }
    layout[panel] = false;
    beforeFocus = null;
    applyLayout();
    toggle.focus();
  });
}
document.getElementById('focusCode').addEventListener('click', () => {
  if (!layout.output && !layout.console) {
    Object.assign(layout, beforeFocus || { output: true, console: true });
    beforeFocus = null;
  } else {
    beforeFocus = { output: layout.output, console: layout.console };
    layout.output = layout.console = false;
  }
  applyLayout();
});
document.getElementById('resetLayout').addEventListener('click', () => {
  layout = { ...defaultLayout };
  beforeFocus = null;
  applyLayout();
});

for (const [id, key, min, max, initial] of [
  ['outputResize', 'editorWidth', 25, 75, 50],
  ['consoleResize', 'consoleHeight', 15, 65, 32],
]) {
  const divider = document.getElementById(id);
  const horizontal = key === 'editorWidth';
  let drag = null;
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mobile.matches) return;
    event.preventDefault();
    divider.focus();
    const rect = workbench.getBoundingClientRect();
    drag = { pointer: event.pointerId, start: horizontal ? event.clientX : event.clientY, value: layout[key], size: horizontal ? rect.width : rect.height };
    divider.setPointerCapture(event.pointerId);
    divider.classList.add('dragging');
    document.body.classList.add('resizing-panels');
  });
  divider.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer || !drag.size) return;
    const distance = (horizontal ? event.clientX : event.clientY) - drag.start;
    layout[key] = clamp(drag.value + (horizontal ? 1 : -1) * distance / drag.size * 100, min, max);
    applyLayout(false);
  });
  const finish = event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag = null;
    divider.classList.remove('dragging');
    document.body.classList.remove('resizing-panels');
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
    applyLayout();
  };
  divider.addEventListener('pointerup', finish);
  divider.addEventListener('pointercancel', finish);
  divider.addEventListener('lostpointercapture', finish);
  divider.addEventListener('dblclick', () => { layout[key] = initial; applyLayout(); });
  divider.addEventListener('keydown', event => {
    const directions = horizontal ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: 1, ArrowDown: -1 };
    if (event.key in directions) layout[key] = clamp(layout[key] + directions[event.key] * (event.shiftKey ? 10 : 2), min, max);
    else if (event.key === 'Home') layout[key] = min;
    else if (event.key === 'End') layout[key] = max;
    else return;
    event.preventDefault();
    applyLayout();
  });
}
applyLayout(false);
