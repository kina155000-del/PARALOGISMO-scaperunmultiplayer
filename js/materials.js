/**
 * Mazmorra — Materiales y texturas
 *   assets/textures/wall.png  → paredes
 *   assets/textures/floor.png → suelo
 *   assets/textures/hide.png  → escondites (hoyos)
 * Techo: negro, sin textura
 */
const Materials = {
  texturePath: 'assets/textures/',

  _loadOne(loader, file, setupFn, done) {
    const url = this.texturePath + file;
    loader.load(
      url,
      (tex) => {
        try { setupFn(tex); } catch (e) { console.warn(e); }
        if (tex.encoding !== undefined && THREE.sRGBEncoding !== undefined) {
          tex.encoding = THREE.sRGBEncoding;
        }
        tex.needsUpdate = true;
        console.info('[materials] OK', url);
        done(tex);
      },
      undefined,
      (err) => {
        console.warn('[materials] FALLO al cargar', url, err);
        done(null);
      }
    );
  },

  loadAll(onDone) {
    if (typeof THREE === 'undefined') {
      if (onDone) onDone({ wall: null, floor: null, hide: null });
      return;
    }
    const loader = new THREE.TextureLoader();
    // Evitar caché agresiva del navegador al probar
    loader.setCrossOrigin('anonymous');

    const result = { wall: null, floor: null, hide: null };
    let pending = 3;
    const tick = () => {
      pending--;
      if (pending <= 0 && onDone) onDone(result);
    };

    this._loadOne(loader, 'wall.png', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 2);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
    }, (tex) => { result.wall = tex; tick(); });

    this._loadOne(loader, 'floor.png', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
    }, (tex) => { result.floor = tex; tick(); });

    this._loadOne(loader, 'hide.png', (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(1, 1);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    }, (tex) => { result.hide = tex; tick(); });
  },

  /**
   * Aplica texturas a materiales. Llamar también DESPUÉS de generar el mundo.
   */
  applyTo(wallMaterial, floorMaterial, hideSpotMaterial, textures, mapCols, mapRows) {
    if (!textures) return;

    if (textures.wall && wallMaterial) {
      wallMaterial.map = textures.wall;
      wallMaterial.color.setHex(0xffffff);
      wallMaterial.needsUpdate = true;
    }

    if (textures.floor && floorMaterial) {
      const ft = textures.floor;
      const cols = mapCols || 180;
      const rows = mapRows || 180;
      // Repetición moderada: se ve el empedrado cerca del jugador
      ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
      ft.repeat.set(Math.max(cols / 4, 30), Math.max(rows / 4, 30));
      ft.needsUpdate = true;
      floorMaterial.map = ft;
      floorMaterial.color.setHex(0xffffff);
      if (floorMaterial.emissive) floorMaterial.emissive.setHex(0x000000);
      floorMaterial.side = THREE.DoubleSide;
      floorMaterial.needsUpdate = true;
    }

    if (textures.hide && hideSpotMaterial) {
      const ht = textures.hide;
      ht.wrapS = THREE.ClampToEdgeWrapping;
      ht.wrapT = THREE.ClampToEdgeWrapping;
      ht.repeat.set(1, 1);
      ht.needsUpdate = true;
      hideSpotMaterial.map = ht;
      hideSpotMaterial.color.setHex(0xffffff);
      hideSpotMaterial.emissive.setHex(0x111111);
      hideSpotMaterial.emissiveIntensity = 0.15;
      hideSpotMaterial.transparent = false;
      hideSpotMaterial.opacity = 1;
      hideSpotMaterial.side = THREE.DoubleSide;
      hideSpotMaterial.depthWrite = true;
      hideSpotMaterial.polygonOffset = true;
      hideSpotMaterial.polygonOffsetFactor = -2;
      hideSpotMaterial.polygonOffsetUnits = -2;
      hideSpotMaterial.needsUpdate = true;
    }
  }
};
