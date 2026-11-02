import { events } from './event-bus.js';

const initialState = {
  route: 'home',
  routeParams: {},
  introComplete: false,
  soundEnabled: true,
  session: null,
  user: null,
  profile: null,
  universe: null,
  membership: null,
  members: [],
  presence: {},
  performanceMode: 'auto',
  searchQuery: ''
};

class AppState {
  #state = { ...initialState };
  get snapshot() { return { ...this.#state }; }
  get(key) { return this.#state[key]; }
  set(key, value) {
    const previous = this.#state[key];
    if (Object.is(previous, value)) return;
    this.#state[key] = value;
    events.emit('state:change', { key, value, previous, state: this.snapshot });
  }
  patch(values) { Object.entries(values).forEach(([key, value]) => this.set(key, value)); }
  reset() { this.#state = { ...initialState }; events.emit('state:reset', { state:this.snapshot }); }
}
export const state = new AppState();
