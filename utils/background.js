const BG_MODES = {
  solid: { label: 'Solid Color', value: '#080808' },
  mesh: { label: 'Mesh Gradient' },
  image: { label: 'Custom Image' },
  video: { label: 'Custom Video' }
};

const VideoDB = {
  dbName: 'BookmarkX_VideoDB',
  storeName: 'videos',
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  },

  async saveVideo(file) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(file, 'bg_video_file');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async loadVideo() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get('bg_video_file');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};

const BackgroundUtils = {
  async init(layerId, overlayId) {
    this.layer = document.getElementById(layerId);
    this.overlay = document.getElementById(overlayId);
    
    return new Promise(resolve => {
      chrome.storage.local.get([
        'bx_bg_type', 
        'bx_bg_val', 
        'bx_bg_darkness', 
        'bx_bg_blur'
      ], items => {
        this.apply(items.bx_bg_type || 'solid', items.bx_bg_val || '#080808');
        this.applyOverlay(items.bx_bg_darkness !== undefined ? items.bx_bg_darkness : 60, items.bx_bg_blur || 0);
        resolve();
      });
    });
  },

  apply(type, value, meshColors) {
    if (!this.layer) return;
    
    this.layer.style.background = 'none';
    this.layer.style.backgroundImage = 'none';
    this.layer.style.backgroundColor = 'transparent';
    
    const videoEl = document.getElementById('bg-video');
    if (videoEl) {
      if (type === 'video') {
        videoEl.classList.add('active');
        this.layer.classList.add('video-active');
        
        // Load video blob from IndexedDB
        VideoDB.loadVideo().then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            if (videoEl.src !== url) {
              videoEl.src = url;
            }
          } else if (value && videoEl.src !== value) {
            // Fallback for previously saved dataURL
            videoEl.src = value;
          }
        }).catch(err => console.error("Error loading video from DB:", err));
      } else {
        videoEl.classList.remove('active');
        videoEl.src = '';
        this.layer.classList.remove('video-active');
      }
    }

    if (type === 'solid') {
      this.layer.style.backgroundColor = value || '#080808';
    } else if (type === 'mesh') {
      const c1 = meshColors && meshColors[0] ? meshColors[0] : '#ffb875';
      const c2 = meshColors && meshColors[1] ? meshColors[1] : '#00e5ff';
      const c3 = meshColors && meshColors[2] ? meshColors[2] : '#ffd4d9';
      this.layer.style.backgroundImage = `radial-gradient(at 40% 20%, ${c1} 0px, transparent 50%), radial-gradient(at 80% 0%, ${c2} 0px, transparent 50%), radial-gradient(at 0% 50%, ${c3} 0px, transparent 50%)`;
      this.layer.style.backgroundColor = '#0a0a0a';
    } else if (type === 'image') {
      if (value) {
        this.layer.style.backgroundImage = `url("${value}")`;
        this.layer.style.backgroundSize = 'cover';
        this.layer.style.backgroundPosition = 'center';
      }
    }
  },

  applyOverlay(darkness, blur) {
    if (!this.overlay) return;
    this.overlay.style.backgroundColor = `rgba(0,0,0,${darkness / 100})`;
    this.overlay.style.backdropFilter = `blur(${blur}px)`;
    this.overlay.style.webkitBackdropFilter = `blur(${blur}px)`;
  }
};
