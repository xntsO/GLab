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
  document.querySelector('meta[name="theme-color"]').content = light ? '#eef2f7' : '#10151f';
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

// The hidden library can resize the editor independently of the browser viewport.
const observer = new ResizeObserver(refreshEditor);
observer.observe(document.getElementById('editorHost'));
