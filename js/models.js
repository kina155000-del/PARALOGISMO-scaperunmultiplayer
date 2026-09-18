/**
 * Mazmorra — Carga y colocación de modelos GLB
 * Carpeta: assets/models/
 */
const ModelLibrary = {
  path: 'assets/models/',
  templates: {},
  animations: {},
  ready: false,

  files: {
    key: 'key.glb',
    pan: 'pan.glb',
    coal: 'coal.glb',
    escondite: 'escondite.glb',
    escudo: 'escudo.glb',
    escudo1: 'escudo1.glb',
    flecha: 'flecha.glb',
    hacha: 'hacha.glb',
    pocion: 'pocion.glb',
    skull2: 'Skull2.glb',
    sword: 'Sword.glb',
    barril: 'Barril.glb',
    caja: 'caja.glb',
    cubo: 'cubo.glb',
    mesita: 'mesita.glb',
    metales: 'metales.glb',
    skull: 'Skull.glb',
    telarana: 'telaña.glb',
    portal: 'portal.glb',
    monster: 'monster.glb'
  },

  decorKeys: [
    'escudo', 'escudo1', 'flecha', 'hacha', 'pocion',
    'skull2', 'sword', 'barril', 'caja', 'cubo',
    'mesita', 'metales', 'skull', 'telarana'
  ],

  // Armas de pie → acostadas (rotar en X para tumbarlas)
  layFlat: {
    sword: true,
    hacha: true,
    flecha: true,
    escudo: true,
    escudo1: true
  },

  loadAll(onDone) {
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
      console.warn('[models] GLTFLoader no disponible');
      this.ready = true;
      if (onDone) onDone();
      return;
    }

    const loader = new THREE.GLTFLoader();
    const entries = Object.entries(this.files);
    let pending = entries.length;

    const finish = () => {
      if (pending > 0) return;
      this.ready = true;
      const ok = Object.keys(this.templates).filter(k => this.templates[k]);
      console.info('[models] cargados', ok.length, ok);
      if (onDone) onDone();
    };

    entries.forEach(([key, file]) => {
      loader.load(
        this.path + file,
        (gltf) => {
          const root = gltf.scene || gltf.scenes[0];
          root.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = false;
              c.receiveShadow = false;
              if (c.material) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach((m) => {
                  if (m.map && THREE.sRGBEncoding !== undefined) {
                    m.map.encoding = THREE.sRGBEncoding;
                  }
                  m.needsUpdate = true;
                });
              }
            }
          });
          this.templates[key] = root;
          this.animations[key] = gltf.animations ? gltf.animations.slice() : [];
          pending--;
          finish();
        },
        undefined,
        (err) => {
          console.warn('[models] no se pudo cargar', this.path + file);
          this.templates[key] = null;
          this.animations[key] = [];
          pending--;
          finish();
        }
      );
    });
  },

  /**
   * Coloca el modelo con la base exactamente sobre floorY.
   * targetSize = tamaño máximo deseado en unidades del mundo (~0.4–0.9).
   */
  spawn(key, x, z, opts) {
    opts = opts || {};
    const targetSize = opts.targetSize != null ? opts.targetSize : 0.55;
    const rotY = opts.rotY != null ? opts.rotY : 0;
    const floorY = opts.floorY != null ? opts.floorY : -0.5;

    const tpl = this.templates[key];
    if (!tpl) return null;

    const obj = tpl.clone(true);

    // 1) Centrar en origen
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(obj);
    let size = new THREE.Vector3();
    let center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Centrar geometría en el origen
    obj.position.set(-center.x, -center.y, -center.z);

    // 2) Acostar armas (después de centrar)
    if (this.layFlat[key]) {
      obj.rotation.x = -Math.PI / 2;
    }

    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
    box.getSize(size);
    box.getCenter(center);

    // 3) Escalar al tamaño objetivo
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = targetSize / maxDim;
    obj.scale.setScalar(s);

    // 4) Rotación Y aleatoria / fija
    obj.rotation.y = rotY;

    // 5) Recalcular caja y apoyar base en floorY
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
    // Tras scale, position aún tiene el offset de centrado * scale implícito via matrix
    // Mejor: reset position y levantar por -min.y
    const minY = box.min.y;
    obj.position.y += (floorY - minY);

    // Posición mundo XZ
    obj.position.x += x;
    obj.position.z += z;

    // Ajuste fino: asegurar que nada quede bajo el suelo
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj);
    if (box.min.y < floorY - 0.001) {
      obj.position.y += (floorY - box.min.y);
    }

    // Enterrar un poco (p.ej. calaveras)
    const buryY = opts.buryY != null ? opts.buryY : 0;
    if (buryY > 0) {
      obj.position.y -= buryY;
    }

    return obj;
  },

  fallbackMesh(kind) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    if (kind === 'key') {
      return new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0x2ecc71 }));
    }
    if (kind === 'coal') {
      return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
    }
    if (kind === 'pan') {
      return new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.25),
        new THREE.MeshLambertMaterial({ color: 0xc4a574 }));
    }
    if (kind === 'escondite') {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.4),
        new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.DoubleSide })
      );
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }
    return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
  }
};
