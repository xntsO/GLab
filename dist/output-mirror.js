const channel = 'gllab-output-v1';
function validInput(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.type === 'menu') return Number.isInteger(event.menu) && Number.isInteger(event.value);
  if (event.type === 'menuOpen') return Number.isInteger(event.menu) && Number.isFinite(event.x) && Number.isFinite(event.y);
  if (!['mouse', 'motion', 'passive', 'keydown', 'keyup', 'wheel', 'entry'].includes(event.type)) return false;
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || !Number.isInteger(event.modifiers) || event.modifiers < 0 || event.modifiers > 15) return false;
  if (event.type === 'entry') return [0,1].includes(event.state);
  if (event.type === 'wheel') return Number.isFinite(event.deltaY) && (event.deltaX === undefined || Number.isFinite(event.deltaX)) && (event.deltaMode === undefined || [0,1,2].includes(event.deltaMode));
  if (event.buttons !== undefined && (!Number.isInteger(event.buttons) || event.buttons < 0 || event.buttons > 31)) return false;
  if (event.type === 'mouse') return Number.isInteger(event.button) && event.button >= 0 && event.button <= 4 && [0, 1].includes(event.state);
  if (event.type === 'keydown' || event.type === 'keyup') return typeof event.key === 'string' && event.key.length <= 100 && (event.code === undefined || typeof event.code === 'string' && event.code.length <= 100) && (event.repeat === undefined || typeof event.repeat === 'boolean');
  return true;
}
export class OutputMirror {
  constructor({state, capture, input, stop, blocked}) {
    Object.assign(this, {state, capture, input, stop, blocked});
    this.popup = null; this.ready = false; this.session = ''; this.capturing = false;
    window.addEventListener('message', event => this.receive(event));
    window.addEventListener('pagehide', event => {
      this.send('disconnected', {message: event.persisted ? 'Editor suspended. Return to the editor to continue.' : 'Editor closed. Open the workspace to run again.'});
    });
    window.addEventListener('pageshow', () => this.update());
  }
  open() {
    if (this.popup && !this.popup.closed) {this.popup.focus(); this.update(); return;}
    this.session = crypto.randomUUID(); this.ready = false;
    const url = new URL('./output.html?v=8', import.meta.url); url.hash = new URLSearchParams({session: this.session});
    this.popup = window.open(url.href, '_blank');
    if (!this.popup) this.blocked();
  }
  send(type, extra = {}) {
    if (!this.popup || this.popup.closed) {this.ready = false; return;}
    this.popup.postMessage({channel, session: this.session, type, ...extra}, location.origin);
  }
  update() {if (this.ready) this.send('state', {state: this.state()});}
  menu(menu) {if (this.ready) this.send('menu', {menu});}
  async frame() {
    if (this.capturing || !this.ready) return;
    const popup = this.popup, session = this.session, generation = this.state().generation;
    this.capturing = true;
    try {
      const blob = await this.capture();
      if (popup === this.popup && session === this.session && this.ready && generation === this.state().generation)
        this.send(blob ? 'frame' : 'no-frame', {blob, generation});
      else this.send('no-frame');
    } catch {this.send('no-frame');}
    finally {this.capturing = false;}
  }
  receive({origin, source, data}) {
    if (origin !== location.origin || source !== this.popup || !data || data.channel !== channel || data.session !== this.session) return;
    if (data.type === 'ready') {this.ready = true; this.update();}
    else if (data.type === 'request-frame') {this.update(); this.frame();}
    else if (data.type === 'heartbeat') this.update();
    else if (data.type === 'input' && validInput(data.event)) this.input(data.event);
    else if (data.type === 'stop') {this.stop(); this.update();}
    else if (data.type === 'closed') {this.ready = false; this.popup = null;}
  }
}
