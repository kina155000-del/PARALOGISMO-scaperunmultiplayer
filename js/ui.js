/**
 * Mazmorra — Imágenes de UI / menús
 * Coloca PNGs en: assets/ui/
 *
 * Nombres sugeridos:
 *   logo.png
 *   btn-play.png
 *   btn-revive.png
 *   btn-restart.png
 *   hud-frame.png
 *   icon-key.png
 *   icon-coal.png
 *   icon-bread.png
 *   menu-bg.png
 */
const UIAssets = {
  path: 'assets/ui/',
  images: {},
  ready: false,

  files: {
    // Añade aquí cuando tengas las imágenes:
    // logo: 'logo.png',
    // menuBg: 'menu-bg.png',
    // iconKey: 'icon-key.png',
    // iconCoal: 'icon-coal.png',
    // iconBread: 'icon-bread.png',
  },

  loadAll(onDone) {
    const entries = Object.entries(this.files);
    if (!entries.length) {
      this.ready = true;
      if (onDone) onDone();
      return;
    }
    let pending = entries.length;
    const finish = () => {
      if (pending > 0) return;
      this.ready = true;
      console.info('[ui] imágenes cargadas', Object.keys(this.images));
      if (onDone) onDone();
    };
    entries.forEach(([key, file]) => {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        pending--;
        finish();
      };
      img.onerror = () => {
        console.warn('[ui] no se pudo cargar', this.path + file);
        this.images[key] = null;
        pending--;
        finish();
      };
      img.src = this.path + file;
    });
  },

  /** Aplica una imagen como fondo de un elemento DOM */
  applyBackground(el, key) {
    const img = this.images[key];
    if (!el || !img) return;
    el.style.backgroundImage = `url(${img.src})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  },

  /** Cambia el src de un <img id="..."> */
  applyImg(elementId, key) {
    const el = document.getElementById(elementId);
    const img = this.images[key];
    if (!el || !img) return;
    el.src = img.src;
  }
};
