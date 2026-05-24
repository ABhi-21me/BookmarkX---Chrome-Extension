/**
 * Centralized Reactive State Manager
 * Proxies the state object and notifies listeners on property changes.
 */

class Store {
  constructor(initialState) {
    this.listeners = new Map();
    
    // Create a deep proxy handler to intercept changes
    const handler = {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        // If it's an object, proxy it recursively for deep reactivity
        if (typeof value === 'object' && value !== null) {
          return new Proxy(value, handler);
        }
        return value;
      },
      set: (target, property, value, receiver) => {
        const oldValue = Reflect.get(target, property, receiver);
        const success = Reflect.set(target, property, value, receiver);
        
        if (success && oldValue !== value) {
          this.notify(property, value, oldValue);
          // Also notify a wildcard listener for any change
          this.notify('*', { property, value, oldValue });
        }
        return success;
      }
    };

    this.state = new Proxy(initialState, handler);
  }

  // Subscribe to changes on a specific property, or '*' for all changes
  subscribe(property, callback) {
    if (!this.listeners.has(property)) {
      this.listeners.set(property, new Set());
    }
    this.listeners.get(property).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(property).delete(callback);
    };
  }

  notify(property, newValue, oldValue) {
    if (this.listeners.has(property)) {
      for (const callback of this.listeners.get(property)) {
        callback(newValue, oldValue);
      }
    }
  }
}

// Initial state definition
const initialState = {
  bookmarks: [],
  allFolders: [],
  isUIVisible: true,
  editingId: null,
  viewMode: 'grid', // grid, compact, category, workspace
  settings: {
    theme: 'terminal',
    accent: '#00ff88',
    bgType: 'solid',
    bgVal: '#080808',
    bgDarkness: 60,
    bgBlur: 0,
    meshColors: ['#ffb875', '#00e5ff', '#ffd4d9'],
    cardStyle: 'glass',
    gridCols: 4,
    showFavicons: true,
    showUrl: true,
    showClockWidget: true,
    // New Clock Settings
    clockPos: 'center',
    datePos: 'center',
    clockLayout: 'time-above-date',
    clockStyle: 'minimal',
    clockAnim: 'fade',
    clock24hr: false,
    clockShowSeconds: false,
    dateFormat: 'dd-mm-yyyy'
  }
};

window.appStore = new Store(initialState);
