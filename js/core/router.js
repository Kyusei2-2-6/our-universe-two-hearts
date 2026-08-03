import { ROUTES } from '../config.js';
import { state } from './state.js';
import { events } from './event-bus.js';

function normalize(hash) {
  const route = String(hash || '').replace(/^#\/?/, '').split('?')[0] || 'home';
  return ROUTES.has(route) ? route : 'home';
}

class Router {
  start() {
    addEventListener('hashchange', () => this.sync());
    this.sync();
  }
  navigate(route, replace = false) {
    const safe = ROUTES.has(route) ? route : 'home';
    const target = `#${safe}`;
    if (replace) history.replaceState(null, '', target);
    else if (location.hash !== target) location.hash = safe;
    this.sync();
  }
  sync() {
    const route = normalize(location.hash);
    state.set('route', route);
    events.emit('route:change', { route });
  }
}
export const router = new Router();
