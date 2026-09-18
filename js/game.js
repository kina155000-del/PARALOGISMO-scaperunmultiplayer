/* =========================================================
   VARIABLES PRINCIPALES
========================================================= */

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(0x000000);


/*
 * NIEBLA REAL
 *
 * No se pinta una capa negra.
 * Three.js calcula la profundidad.
 */

const FOG_NORMAL = CONFIG.fogNormal;
const FOG_FLY = CONFIG.fogFly;

scene.fog =
    new THREE.FogExp2(
        0x000000,
        FOG_NORMAL
    );


const camera =
    new THREE.PerspectiveCamera(
        75,
        window.innerWidth /
        window.innerHeight,
        0.05,
        1000
    );


const renderer =
    new THREE.WebGLRenderer({
        antialias:true
    });


renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.outputEncoding =
    THREE.sRGBEncoding;

document.body.appendChild(
    renderer.domElement
);


/* =========================================================
   PLAYER
========================================================= */

const yawObject =
    new THREE.Object3D();

const pitchObject =
    new THREE.Object3D();

pitchObject.add(camera);
yawObject.add(pitchObject);

scene.add(
    yawObject
);


/* =========================================================
   LUCES
========================================================= */

const ambientLight =
    new THREE.AmbientLight(
        0x404040,
        0.16
    );

scene.add(
    ambientLight
);


/*
 * Luz de emergencia muy débil.
 * Permite distinguir mínimamente el mundo,
 * pero la linterna es la fuente principal.
 */

const playerLight =
    new THREE.PointLight(
        0xffffff,
        0.18,
        4,
        2
    );

camera.add(
    playerLight
);


/* =========================================================
   LINTERNA
========================================================= */

const flashlight =
    new THREE.SpotLight(
        0xffffff,
        0,
        13,
        Math.PI / 6,
        0.55,
        2
    );

flashlight.position.set(
    0,
    0,
    0
);

camera.add(
    flashlight
);

const flashlightTarget =
    new THREE.Object3D();

flashlightTarget.position.set(
    0,
    0,
    -10
);

camera.add(
    flashlightTarget
);

flashlight.target =
    flashlightTarget;



/* =========================================================
   MÚSICA DE FONDO (assets/music/fondo.mp3)
========================================================= */
const GameMusic = {
  path: 'assets/music/',
  fondo: null,
  palpito: null,
  resp: null,
  scream: null,
  help: null,
  child: null,
  woman: null,
  started: false,
  muted: false,
  _dangerNear: false,   // radio latidos (cerca)
  _helpNear: false,     // radio aviso help (más lejos)
  _hidden: false,
  _scareTimer: 0,
  _nextScareIn: 12,
  _scareClip: null,
  _scareLeft: 0,

  _make(file, loop, vol) {
    try {
      const a = new Audio(this.path + file);
      a.loop = !!loop;
      a.preload = 'auto';
      a.volume = vol;
      return a;
    } catch (e) {
      console.warn('[music] error', file, e);
      return null;
    }
  },

  init() {
    if (!this.fondo) this.fondo = this._make('fondo.mp3', true, 0.45);
    if (!this.palpito) this.palpito = this._make('palpito.mp3', true, 0.7);
    if (!this.resp) this.resp = this._make('resp.mp3', true, 0.55);
    if (!this.scream) this.scream = this._make('scream.mp3', false, 1.0);
    if (!this.help) this.help = this._make('help.mp3', true, 0.9);
    if (!this.child) this.child = this._make('child.mp3', false, 0.65);
    if (!this.woman) this.woman = this._make('woman.mp3', false, 0.65);
    try {
      if (sessionStorage.getItem('mazmorra_muted') === '1') this.setMuted(true, true);
    } catch (e) {}
  },

  _levelFactor() {
    const lvl = (typeof currentLevel === 'number' && currentLevel > 0) ? currentLevel : 1;
    // nivel 1 = 1, sube hasta ~2.2
    return Math.min(2.2, 0.85 + lvl * 0.22);
  },

  play() {
    this.init();
    if (this.muted) return;
    if (!this.fondo) return;
    const p = this.fondo.play();
    if (p && p.then) {
      p.then(() => { this.started = true; }).catch(() => {});
    } else {
      this.started = true;
    }
  },

  setMuted(mute, skipStore) {
    this.muted = !!mute;
    if (!skipStore) {
      try { sessionStorage.setItem('mazmorra_muted', mute ? '1' : '0'); } catch (e) {}
    }
    const list = [this.fondo, this.palpito, this.resp, this.scream, this.help, this.child, this.woman];
    list.forEach((a) => {
      if (!a) return;
      a.muted = this.muted;
      if (this.muted) a.pause();
    });
    if (!this.muted) {
      this.play();
      this.setDangerNear(this._dangerNear);
      this.setHelpNear(this._helpNear);
      this.setHidden(this._hidden);
    }
    const btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = this.muted ? 'Sonido: OFF' : 'Sonido: ON';
  },

  toggleMute() {
    this.setMuted(!this.muted);
  },

  setDangerNear(near) {
    this._dangerNear = !!near;
    this.init();
    if (!this.palpito) return;
    if (this.muted || !near) {
      this.palpito.pause();
      try { this.palpito.currentTime = 0; } catch (e) {}
      return;
    }
    // Más volumen a mayor nivel
    this.palpito.volume = Math.min(1, 0.55 + this._levelFactor() * 0.2);
    if (this.palpito.paused) this.palpito.play().catch(() => {});
  },

  setHelpNear(near) {
    this._helpNear = !!near;
    this.init();
    if (!this.help) return;
    // help solo si está en zona media (no en latido cercano)
    if (this.muted || !near || this._dangerNear) {
      this.help.pause();
      try { this.help.currentTime = 0; } catch (e) {}
      return;
    }
    // help bien audible
    this.help.volume = Math.min(1, 0.82 + this._levelFactor() * 0.12);
    if (this.help.paused) this.help.play().catch(() => {});
  },

  setHidden(hidden) {
    this._hidden = !!hidden;
    this.init();
    if (!this.resp) return;
    if (this.muted || !hidden) {
      this.resp.pause();
      try { this.resp.currentTime = 0; } catch (e) {}
      return;
    }
    if (this.resp.paused) this.resp.play().catch(() => {});
  },

  playScream() {
    this.init();
    if (this.muted || !this.scream) return;
    try {
      this.scream.currentTime = 0;
      this.scream.volume = Math.min(1, 0.85 + this._levelFactor() * 0.1);
      this.scream.play().catch(() => {});
    } catch (e) {}
    if (this.fondo) this.fondo.volume = 0.12;
    this.setHelpNear(false);
    this.setDangerNear(false);
  },

  restoreBgmVolume() {
    if (this.fondo) this.fondo.volume = this.muted ? 0 : 0.45;
  },

  /** child.mp3 / woman.mp3 al azar; máx. 5 s; más nivel = más fuertes y frecuentes */
  updateAmbientScares(delta) {
    if (typeof isDead !== 'undefined' && isDead) return;
    if (typeof deathSequenceActive !== 'undefined' && deathSequenceActive) return;
    this.init();

    // Cortar si ya superó 5 segundos
    if (this._scareClip && this._scareLeft != null) {
      this._scareLeft -= delta;
      if (this._scareLeft <= 0 || this.muted) {
        try {
          this._scareClip.pause();
          this._scareClip.currentTime = 0;
        } catch (e) {}
        this._scareClip = null;
        this._scareLeft = 0;
      }
    }

    if (this.muted) return;

    const lf = this._levelFactor();
    const minGap = Math.max(5.5, 18 - lf * 5.5);
    const maxGap = minGap + Math.max(4, 14 - lf * 3);

    this._scareTimer += delta;
    if (this._scareTimer < this._nextScareIn) return;
    // No solapar con otro scare activo
    if (this._scareClip) return;

    this._scareTimer = 0;
    this._nextScareIn = minGap + Math.random() * (maxGap - minGap);

    const useChild = Math.random() < 0.5;
    const clip = useChild ? this.child : this.woman;
    if (!clip) return;

    try {
      clip.pause();
      clip.currentTime = 0;
      clip.volume = Math.min(1, 0.45 + lf * 0.3 + Math.random() * 0.15);
      // Duración aleatoria hasta 5 s
      const dur = 1.2 + Math.random() * 3.8; // 1.2–5.0 s
      this._scareClip = clip;
      this._scareLeft = Math.min(5, dur);
      clip.play().catch(() => {});
    } catch (e) {}
  }
};

/* =========================================================
   GEOMETRÍA
========================================================= */

const blockSize =
    CONFIG.blockSize;

const boxGeometry =
    new THREE.BoxGeometry(
        blockSize,
        CONFIG.wallHeight,
        blockSize
    );

const sphereGeometry =
    new THREE.SphereGeometry(
        0.22,
        12,
        12
    );

const batteryGeometry =
    new THREE.BoxGeometry(
        0.28,
        0.5,
        0.28
    );

const chocolateGeometry =
    new THREE.BoxGeometry(
        0.32,
        0.18,
        0.22
    );

const hideSpotGeometry =
    new THREE.PlaneGeometry(
        1.6,
        1.6
    );

const monsterGeometry =
    new THREE.BoxGeometry(
        0.65,
        1.4,
        0.65
    );


/* =========================================================
   MATERIALES
========================================================= */

const wallMaterial =
    new THREE.MeshLambertMaterial({
        color:0xffffff  // blanco para que la textura se vea real
    });


const floorMaterial =
    new THREE.MeshLambertMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
    });

// Texturas (wall.png / floor.png) — se aplican al cargar
let gameTextures = { wall: null, floor: null, hide: null };


const exitMaterialLocked =
    new THREE.MeshBasicMaterial({
        color:0x22222b
    });


const exitMaterialUnlocked =
    new THREE.MeshBasicMaterial({
        color:0xe55039
    });


const itemMaterial =
    new THREE.MeshBasicMaterial({
        color:0x2ecc71
    });


const batteryMaterial =
    new THREE.MeshBasicMaterial({
        color:0xffff00
    });


const chocolateMaterial =
    new THREE.MeshBasicMaterial({
        color:0x6b3a2a
    });


const hideSpotMaterial =
    new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 0,
        transparent: true,
        side: THREE.DoubleSide
    });


const monsterMaterial =
    new THREE.MeshLambertMaterial({
        color:0xff5500,
        emissive:0x220000
    });


/* =========================================================
   MAPA
========================================================= */

const mapRows =
    CONFIG.mapRows;

const mapCols =
    CONFIG.mapCols;

let layoutGrid;

let exitCoord;

let startCoord;

let collidableBoxes = [];

let collectibleObjects = [];

let batteryObjects = [];

let hideSpots = [];
let decorObjects = [];

let worldMeshes = [];

let floorMesh = null;
let ceilingMesh = null;

let exitMeshRef = null;
let portalMesh = null;
let portalMixer = null;
let portalSpawned = false;

let monsterAIs = [];

let score = 0;

let totalItemsCount = 0;

// Semilla determinista: todos los jugadores de una misma sala construyen
// exactamente el mismo mapa, llaves, escondites, carbón, pan y monstruos.
let worldSeed = 0;
function hashWorldSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(text).length; i++) {
        h ^= String(text).charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}
function getWorldSeed(level) {
    // En cooperativo el mapa queda FIJO durante todo el nivel.
    // Reiniciar/reaparecer no cambia el mapa; únicamente avanzar de nivel
    // genera otra semilla. La semilla depende exclusivamente de sala + nivel.
    try {
        const code = sessionStorage.getItem('paralogismo_mp_code');
        if (code) {
            return hashWorldSeed('PARALOGISMO|COOP|' + code.toUpperCase() + '|LEVEL|' + (Number(level) || 1));
        }
    } catch (e) {}
    return hashWorldSeed('PARALOGISMO|SOLO|' + level + '|' + Date.now());
}
function makeSeededRandom(seed) {
    let a = (seed >>> 0) || 0x6d2b79f5;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let currentLevel = 1;
(function initLevelFromSave() {
  try {
    const s = sessionStorage.getItem('paralogismo_start_level');
    if (s) {
      const n = parseInt(s, 10);
      if (n >= 1) currentLevel = n;
      sessionStorage.removeItem('paralogismo_start_level');
    }
  } catch (e) {}
})();

/** Guardado duro: solo el nivel → archivo en el PC + localStorage */
const SaveGame = {
  fileName: 'paralogismo-scaperun-save.json',
  lsKey: 'paralogismo_save_level',
  gameId: 'PARALOGISMO-scaperun',

  getPayload() {
    return {
      game: this.gameId,
      level: Math.max(1, currentLevel | 0),
      savedAt: new Date().toISOString()
    };
  },

  persistLocal() {
    try {
      localStorage.setItem(this.lsKey, String(Math.max(1, currentLevel | 0)));
    } catch (e) {}
  },

  /**
   * Guardado duro: el usuario elige carpeta y nombre (File System Access API).
   * Si el navegador no lo soporta, cae al diálogo de descarga del navegador.
   */
  async downloadFile() {
    this.persistLocal();
    const data = JSON.stringify(this.getPayload(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });

    // Chrome / Edge / Opera: elegir dónde guardar
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: this.fileName,
          types: [
            {
              description: 'Partida PARALOGISMO-scaperun',
              accept: { 'application/json': ['.json'] }
            }
          ],
          excludeAcceptAllOption: false
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        const name = (handle.name) ? handle.name : this.fileName;
        if (typeof showNotification === 'function') {
          showNotification('PARTIDA GUARDADA', 'Nivel ' + currentLevel + ' → ' + name);
        }
        return;
      } catch (err) {
        // Usuario canceló el diálogo
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          if (typeof showNotification === 'function') {
            showNotification('GUARDADO CANCELADO', 'No se escribió ningún archivo');
          }
          return;
        }
        console.warn('[save] showSaveFilePicker falló, usando descarga', err);
      }
    }

    // Fallback (Firefox, etc.): descarga con nombre sugerido
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    if (typeof showNotification === 'function') {
      showNotification(
        'PARTIDA GUARDADA',
        'Nivel ' + currentLevel + ' (elige la carpeta en el diálogo del navegador)'
      );
    }
  }
};

let isHidden = false;

let currentHideSpot = null;

let chocolateObjects = [];

let chocolateInventory = 0;


/* =========================================================
   carbón
========================================================= */

let batteryPhasesCount =
    5;

const MAX_BATTERY = CONFIG.maxBattery;

const FLASHLIGHT_DRAIN_TIME = CONFIG.flashlightDrainTime;

let flashlightOn =
    false;

let flashlightDrainTimer =
    0;


/* =========================================================
   ESTAMINA
========================================================= */

const MAX_STAMINA = CONFIG.maxStamina;
let stamina = MAX_STAMINA;
const STAMINA_DRAIN_RATE = CONFIG.staminaDrainRate;
const STAMINA_REGEN_RATE = CONFIG.staminaRegenRate;
const STAMINA_CHOCOLATE_BOOST = CONFIG.staminaChocolateBoost ?? CONFIG.staminaPanBoost ?? 35;


/* =========================================================
   RECOLECCIÓN
========================================================= */

let collectingItem =
    null;

let collectStartTime =
    0;

const ITEM_COLLECT_TIME = CONFIG.itemCollectTime;

let collectingPan = null;
let chocolateCollectStart = 0;
const CHOCOLATE_COLLECT_TIME = CONFIG.chocolateCollectTime;


/* =========================================================
   CONTROLES
========================================================= */

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let moveUp = false;
let velocityY = 0;
const JUMP_FORCE = 7.2;
const GRAVITY = 22;
let moveDown = false;

let isFlying = false;
let isDead = false;
let isRunning = false;


/* =========================================================
   HUD
========================================================= */

const progressPct =
    document.getElementById(
        'progress-pct'
    );

const levelNumSpan =
    document.getElementById(
        'level-num'
    );

const progressFill =
    document.getElementById(
        'progress-fill'
    );

const staminaFill =
    document.getElementById(
        'stamina-fill'
    );

const staminaText =
    document.getElementById(
        'stamina-text'
    );

const chocolateCountEl =
    document.getElementById(
        'chocolate-count'
    );

const exitBadge =
    document.getElementById(
        'exit-badge'
    );

const exitStatusIcon =
    document.getElementById(
        'exit-status-icon'
    );

const exitStatusText =
    document.getElementById(
        'exit-status-text'
    );

const ocultoText =
    document.getElementById(
        'oculto-text'
    );

const radarContainer =
    document.getElementById(
        'radar-container'
    );

const radarArrow =
    document.getElementById(
        'radar-arrow'
    );

const hideVision =
    document.getElementById(
        'hide-vision'
    );

const dangerPulse =
    document.getElementById(
        'danger-pulse'
    );

const deathOverlay =
    document.getElementById(
        'death-overlay'
    );

const btnRevive =
    document.getElementById(
        'btn-revive'
    );

const btnRestart =
    document.getElementById(
        'btn-restart'
    );

const modeText =
    document.getElementById(
        'mode-text'
    );

const notificationBanner =
    document.getElementById(
        'notification-banner'
    );

const notifTitle =
    document.getElementById(
        'notif-title'
    );

const notifSub =
    document.getElementById(
        'notif-sub'
    );

const interactionPrompt =
    document.getElementById(
        'interaction-prompt'
    );

const promptNameEl =
    document.getElementById(
        'prompt-name'
    );

const collectBarFill =
    document.getElementById(
        'collect-bar-fill'
    );


function createKeyParticles() {
    const count = 18;
    const positions = new Float32Array(count * 3);
    const speeds = [];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 0.35;
        positions[i * 3 + 1] = Math.random() * 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
        speeds.push(0.25 + Math.random() * 0.45);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xffd700,
        size: 0.05,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    points.userData.speeds = speeds;
    points.userData.baseY = [];
    for (let i = 0; i < count; i++) points.userData.baseY.push(positions[i * 3 + 1]);
    return points;
}

function showPrompt(name, collecting) {
    if (!interactionPrompt) return;
    if (promptNameEl) promptNameEl.textContent = name;
    if (collectBarFill) collectBarFill.style.width = '0%';
    interactionPrompt.className = collecting
        ? 'visible collecting'
        : 'visible';
}

function setCollectBarProgress(progress01) {
    if (!collectBarFill) return;
    const p = Math.max(0, Math.min(1, progress01));
    collectBarFill.style.width = `${(p * 100).toFixed(1)}%`;
}

function hidePrompt() {
    if (!interactionPrompt) return;
    interactionPrompt.className = '';
    if (collectBarFill) collectBarFill.style.width = '0%';
}

const batteryText =
    document.getElementById(
        'battery-text'
    );

const batteryPhases =
    document.querySelectorAll(
        '.battery-phase'
    );

const flashlightStatus =
    document.getElementById(
        'flashlight-status'
    );

const stunIndicator =
    document.getElementById(
        'stun-indicator'
    );


/* =========================================================
   NOTIFICACIONES
========================================================= */

function showNotification(
    title,
    sub,
    danger = false,
    duration = 2200
){

    notifTitle.textContent =
        title;

    notifSub.textContent =
        sub;

    notificationBanner.className =
        'show' +
        (
            danger
                ? ' danger'
                : ''
        );

    setTimeout(
        () => {

            notificationBanner.className =
                '';

        },
        duration
    );
}


/* =========================================================
   ROOM
========================================================= */

class Room{

    constructor(
        x,
        y,
        w,
        h
    ){

        this.x=x;
        this.y=y;
        this.w=w;
        this.h=h;
    }


    center(){

        return{

            x:
                Math.floor(
                    this.x+
                    this.w/2
                ),

            y:
                Math.floor(
                    this.y+
                    this.h/2
                )
        };
    }


    intersects(
        other
    ){

        return(
            this.x <=
                other.x+
                other.w+
                1 &&

            this.x+
                this.w+
                1 >=
                other.x &&

            this.y <=
                other.y+
                other.h+
                1 &&

            this.y+
                this.h+
                1 >=
                other.y
        );
    }
}


/* =========================================================
   TÚNELES
========================================================= */

function carveHorizontalTunnel(
    grid,
    x1,
    x2,
    y
){

    for(
        let x=
            Math.min(
                x1,
                x2
            );

        x<=
            Math.max(
                x1,
                x2
            );

        x++
    ){

        if(
            y>1 &&
            y<mapRows-2 &&
            x>1 &&
            x<mapCols-2
        ){

            grid[y][x]=0;

            grid[y+1][x]=0;

            if(x+1<mapCols)
                grid[y][x+1]=0;

            if(x+1<mapCols)
                grid[y+1][x+1]=0;
        }
    }
}


function carveVerticalTunnel(
    grid,
    y1,
    y2,
    x
){

    for(
        let y=
            Math.min(
                y1,
                y2
            );

        y<=
            Math.max(
                y1,
                y2
            );

        y++
    ){

        if(
            y>1 &&
            y<mapRows-2 &&
            x>1 &&
            x<mapCols-2
        ){

            grid[y][x]=0;

            if(y+1<mapRows)
                grid[y+1][x]=0;

            if(x+1<mapCols)
                grid[y][x+1]=0;

            if(
                y+1<mapRows &&
                x+1<mapCols
            ){

                grid[y+1][x+1]=0;
            }
        }
    }
}


/* =========================================================
   LIMPIAR MAPA
========================================================= */

function clearWorldMeshes(){

    worldMeshes.forEach(
        mesh =>
            scene.remove(mesh)
    );

    worldMeshes=[];


    collectibleObjects.forEach(o => {
        if (o.mesh) scene.remove(o.mesh);
        if (o.particles) scene.remove(o.particles);
    });

    collectibleObjects=[];


    batteryObjects.forEach(
        obj =>
            scene.remove(
                obj.mesh
            )
    );

    batteryObjects=[];


    chocolateObjects.forEach(
        obj =>
            scene.remove(
                obj.mesh
            )
    );

    chocolateObjects=[];

    decorObjects.forEach(o => {
        if (o.mesh) scene.remove(o.mesh);
    });
    decorObjects = [];



    hideSpots.forEach(
        obj =>
            scene.remove(
                obj.mesh
            )
    );

    hideSpots=[];


    collidableBoxes=[];


    if(exitMeshRef){

        scene.remove(
            exitMeshRef
        );

        exitMeshRef=null;
    }


    monsterAIs.forEach(
        ai => {

            if(ai.mesh){

                scene.remove(
                    ai.mesh
                );
            }
        }
    );

    monsterAIs=[];


    if(floorMesh){

        scene.remove(
            floorMesh
        );

        floorMesh.geometry.dispose();

        floorMesh=null;
    }

    if(ceilingMesh){

        scene.remove(
            ceilingMesh
        );

        ceilingMesh.geometry.dispose();

        ceilingMesh=null;
    }


    cancelCollecting();
}


/* =========================================================
   COLISIÓN
========================================================= */

function checkCollision(
    position
){

    const playerBox =
        new THREE.Box3(

            new THREE.Vector3(
                position.x-.35,
                position.y-.45,
                position.z-.35
            ),

            new THREE.Vector3(
                position.x+.35,
                position.y+.45,
                position.z+.35
            )
        );


    for(
        const item
        of collidableBoxes
    ){

        if(
            playerBox.intersectsBox(
                item.box
            )
        ){

            return true;
        }
    }


    return false;
}


/* =========================================================
   COLISIÓN MONSTRUO
========================================================= */

function checkMonsterCollision(
    position
){

    const monsterBox =
        new THREE.Box3(

            new THREE.Vector3(
                position.x-.27,
                -.5,
                position.z-.27
            ),

            new THREE.Vector3(
                position.x+.27,
                1.0,
                position.z+.27
            )
        );


    for(
        const item
        of collidableBoxes
    ){

        if(
            monsterBox.intersectsBox(
                item.box
            )
        ){

            return true;
        }
    }


    return false;
}


/* =========================================================
   WALKABLE
========================================================= */

function isWalkableCell(
    r,
    c
){

    if(
        r<0 ||
        c<0 ||
        r>=mapRows ||
        c>=mapCols
    ){

        return false;
    }


    return(
        layoutGrid[r][c] !== 1
    );
}



/* MonsterAI → js/monsters.js */

/* =========================================================
   ENCONTRAR SPAWN DE LOS 5 MONSTRUOS
   JUNTO AL PUNTO DE ESCAPE
========================================================= */

function findMonsterSpawnPoints(){

    const candidates = [];
    const cx = exitCoord.x;
    const cz = exitCoord.z;

    for (let radius = 1; radius <= 10; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
                const r = cz + dr;
                const c = cx + dc;
                if (isWalkableCell(r, c) && !(r === cz && c === cx)) {
                    candidates.push({ x: c, z: r });
                }
            }
        }
        if (candidates.length >= 12) break;
    }

    if (candidates.length < 5) {
        return [
            { x: cx - 1, z: cz },
            { x: cx + 1, z: cz },
            { x: cx, z: cz - 1 },
            { x: cx, z: cz + 1 },
            { x: cx - 1, z: cz - 1 }
        ];
    }

    const result = [candidates[0]];
    for (let i = 1; i < candidates.length && result.length < 5; i++) {
        const cand = candidates[i];
        let tooClose = false;
        for (const placed of result) {
            if (Math.hypot(cand.x - placed.x, cand.z - placed.z) < 1.4) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose) result.push(cand);
    }

    while (result.length < 5) {
        result.push(candidates[result.length % candidates.length]);
    }

    return result;
}


/* =========================================================
   GENERAR MAPA
========================================================= */



/* =========================================================
   MUERTE / SCREAMER
========================================================= */
let deathSequenceActive = false;
let deathKiller = null;
let deathSeqTimer = 0;
let deathSavedFov = 75;
const DEATH_MENU_DELAY = 3.6;
const jumpscareEl = document.getElementById('jumpscare');

function startDeathSequence(killerMonster) {
    if (deathSequenceActive || isDead) return;
    deathSequenceActive = true;
    isDead = true;
    deathKiller = killerMonster || null;
    deathSeqTimer = 0;

    isHidden = false;
    currentHideSpot = null;
    if (ocultoText) ocultoText.classList.remove('visible');
    if (hideVision) hideVision.classList.remove('visible');
    if (dangerPulse) {
        dangerPulse.classList.remove('active');
        dangerPulse.style.opacity = '0';
    }
    GameMusic.setDangerNear(false);
    GameMusic.setHelpNear(false);
    GameMusic.setHidden(false);
    GameMusic.playScream();

    // Overlay jumpscare a pantalla completa (cara)
    if (jumpscareEl) jumpscareEl.classList.add('active');

    // FOV más cerrado = más claustrofóbico
    if (camera) {
        deathSavedFov = camera.fov || 75;
        camera.fov = 42;
        camera.updateProjectionMatrix();
    }

    // Monstruo PEGADO a la cámara (cara en la pantalla 3D)
    if (deathKiller && deathKiller.mesh) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(yawObject.quaternion);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
        forward.normalize();

        // Muy cerca de la cara del jugador
        deathKiller.mesh.position.set(
            yawObject.position.x + forward.x * 0.85,
            (deathKiller.baseY != null ? deathKiller.baseY : 0) + 0.35,
            yawObject.position.z + forward.z * 0.85
        );
        deathKiller.mesh.lookAt(
            yawObject.position.x,
            yawObject.position.y + 0.2,
            yawObject.position.z
        );
        // Un poco más grande solo en el jumpscare
        if (!deathKiller._deathScaleSaved) {
            deathKiller._deathScaleSaved = deathKiller.mesh.scale.x;
            deathKiller.mesh.scale.multiplyScalar(1.35);
        }
        deathKiller.playAnim && (deathKiller.playAnim('attack') || deathKiller.playAnim('idle') || deathKiller.playAnim('run'));
        deathKiller.path = [];
    }

    // Luz roja intensa sobre el monstruo
    if (playerLight) {
        playerLight.color.setHex(0xff2200);
        playerLight.intensity = 2.2;
        playerLight.distance = 12;
    }

    try { document.exitPointerLock(); } catch (e) {}
}

function updateDeathSequence(delta) {
    if (!deathSequenceActive) return;

    deathSeqTimer += delta;

    // Mantener monstruo en la cara del jugador
    if (deathKiller && deathKiller.mesh) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(yawObject.quaternion);
        forward.y = 0;
        if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
        forward.normalize();

        const t = Math.min(1, deathSeqTimer / 0.35);
        const dist = 0.95 - t * 0.25; // se acerca aún más
        deathKiller.mesh.position.set(
            yawObject.position.x + forward.x * dist,
            (deathKiller.baseY != null ? deathKiller.baseY : 0) + 0.4,
            yawObject.position.z + forward.z * dist
        );
        deathKiller.mesh.lookAt(
            yawObject.position.x,
            yawObject.position.y + 0.15,
            yawObject.position.z
        );
        // Temblor de la malla
        deathKiller.mesh.position.x += (Math.random() - 0.5) * 0.04;
        deathKiller.mesh.position.y += (Math.random() - 0.5) * 0.03;
    }

    if (deathKiller && deathKiller.mixer) {
        deathKiller.mixer.update(delta);
    }

    // Tras el scream → menú
    if (deathSeqTimer >= DEATH_MENU_DELAY) {
        deathSequenceActive = false;
        if (jumpscareEl) jumpscareEl.classList.remove('active');
        if (dangerPulse) {
            dangerPulse.classList.remove('active');
            dangerPulse.style.opacity = '0';
        }
        if (camera) {
            camera.fov = deathSavedFov || 75;
            camera.updateProjectionMatrix();
        }
        if (playerLight) {
            playerLight.color.setHex(0xffffff);
            playerLight.intensity = CONFIG.playerLightIntensity || 0.18;
            playerLight.distance = 4;
        }
        if (deathKiller && deathKiller._deathScaleSaved) {
            const s = deathKiller._deathScaleSaved;
            deathKiller.mesh.scale.set(s, s, s);
            deathKiller._deathScaleSaved = null;
        }
        deathKiller = null;
        GameMusic.restoreBgmVolume();
        if (deathOverlay) deathOverlay.classList.add('visible');
    }
}


function revivePlayer(){
    isDead = false;
    deathSequenceActive = false;
    deathKiller = null;
    deathSeqTimer = 0;
    GameMusic.restoreBgmVolume();
    const js = document.getElementById('jumpscare');
    if (js) js.classList.remove('active');
    if (camera) {
        camera.fov = deathSavedFov || 75;
        camera.updateProjectionMatrix();
    }
    if (playerLight) {
        playerLight.color.setHex(0xffffff);
        playerLight.intensity = CONFIG.playerLightIntensity || 0.18;
        playerLight.distance = 4;
    }
    if (deathOverlay) deathOverlay.classList.remove('visible');

    // Alejar monstruos del jugador al revivir
    for (const monster of monsterAIs) {
        if (!monster.mesh) continue;
        monster.lastKnownPlayer = null;
        monster.lastSeenTimer = 0;
        monster.path = [];
        monster.pathIndex = 0;
        monster.pathTimer = 0;
        monster.dispersing = true;
        const safe = monster.findSafePoint(yawObject.position);
        monster.mesh.position.set(safe.x, monster.baseY != null ? monster.baseY : 0.7, safe.z);
        monster.targetPoint = monster.randomPoint();
    }

    // Pequeña invulnerabilidad: esconder lógica no; solo limpiar alerta
    if (dangerPulse) {
        dangerPulse.classList.remove('active');
        dangerPulse.style.opacity = '0';
    }

    enterGameLock();
}

function restartFromDeath(){
    isDead = false;
    if (deathOverlay) deathOverlay.classList.remove('visible');
    // En cooperativo el reinicio lo decide el HOST para que TODOS vuelvan
    // al mismo mapa base, con el portal bloqueado y recursos restaurados.
    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) {
        if (typeof Multiplayer.requestReset === 'function') Multiplayer.requestReset();
        return;
    }
    generateAndBuildWorld(false, false, true);
}

if (btnRevive) {
    btnRevive.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof FalaciaQuiz !== 'undefined' && FalaciaQuiz.enabled) {
            if (deathOverlay) deathOverlay.classList.remove('visible');
            FalaciaQuiz.ask('revive').then((ok) => {
                if (ok) {
                    revivePlayer();
                } else {
                    showNotification('FALLASTE', 'Responde bien para revivir');
                    if (deathOverlay) deathOverlay.classList.add('visible');
                }
            });
        } else {
            revivePlayer();
        }
    });
}
if (btnRestart) {
    btnRestart.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        restartFromDeath();
    });
}


function generateAndBuildWorld(
    incrementLevel=false,
    __forceBaseSnapshot=false,
    __resetCoop=false
){
    // COOP: el mapa se crea UNA sola vez por nivel en el HOST.
    // El snapshot BASE nunca cambia: los reinicios restauran ese mismo mundo
    // y vuelven a bloquear el portal, pero NO cambian el laberinto.
    let __mpSnapshot = null;
    const __isCoop = typeof Multiplayer !== 'undefined' && Multiplayer.enabled;
    const __isHostCoop = __isCoop && Multiplayer.isHost;
    if (__isCoop && !Multiplayer.isHost && typeof window !== 'undefined') {
        __mpSnapshot = window.__paralogismoWorldSnapshot || null;
    }

    if (typeof Multiplayer !== 'undefined' && !Multiplayer.isHost && typeof Multiplayer.resetMonsterSync === 'function') {
        Multiplayer.resetMonsterSync();
    }

    // En multijugador el código de sala + nivel es la semilla compartida.
    // Así host y cliente generan el mismo mundo sin mandar miles de datos.
    const __randomOriginal = Math.random;

    if(
        incrementLevel
    ){

        currentLevel++;
        if (typeof SaveGame !== 'undefined') {
            SaveGame.persistLocal();
        }
    }

    // En el HOST, si ya existe un snapshot para este nivel, ese ES el mapa.
    // Solo un cambio de nivel permite crear un snapshot nuevo.
    if (__isHostCoop && typeof window !== 'undefined') {
        window.__paralogismoCoopWorlds = window.__paralogismoCoopWorlds || {};
        window.__paralogismoCoopBaseWorlds = window.__paralogismoCoopBaseWorlds || {};
        if (!incrementLevel) {
            const __base = window.__paralogismoCoopBaseWorlds[currentLevel];
            const __live = window.__paralogismoCoopWorlds[currentLevel];
            if (__resetCoop || __forceBaseSnapshot) {
                __mpSnapshot = __base || __live || null;
            } else {
                __mpSnapshot = __live || __base || null;
            }
        }
    }

    worldSeed = (__mpSnapshot && Number(__mpSnapshot.seed)) ? (Number(__mpSnapshot.seed) >>> 0)
        : ((typeof window !== 'undefined' && window.__paralogismoAuthoritativeSeed && typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost)
            ? (Number(window.__paralogismoAuthoritativeSeed) >>> 0) : getWorldSeed(currentLevel || 1));
    if (typeof window !== 'undefined') window.__paralogismoAuthoritativeSeed = worldSeed;
    Math.random = makeSeededRandom(worldSeed);

    levelNumSpan.textContent =
        currentLevel;
    if (typeof SaveGame !== 'undefined') SaveGame.persistLocal();


    isHidden=false;
    isDead=false;
    currentHideSpot=null;

    if (ocultoText) ocultoText.classList.remove('visible');
    if (hideVision) hideVision.classList.remove('visible');
    if (deathOverlay) deathOverlay.classList.remove('visible');
    if (dangerPulse) {
        dangerPulse.classList.remove('active');
        dangerPulse.style.opacity = '0';
    }


    removePortal();
    clearWorldMeshes();


    layoutGrid = __mpSnapshot && Array.isArray(__mpSnapshot.layoutGrid)
        ? __mpSnapshot.layoutGrid.map(row => Array.isArray(row) ? row.slice() : Array(mapCols).fill(1))
        : Array(mapRows).fill(0).map(() => Array(mapCols).fill(1));

    const rooms=[];

    /* GENERACIÓN DE SALAS: solo el HOST. El cliente recibe el grid ya construido. */
    if (!__mpSnapshot) for(
        let i=0;
        i<110;
        i++
    ){

        const w =
            Math.floor(
                Math.random()*10
            )+6;


        const h =
            Math.floor(
                Math.random()*10
            )+6;


        const x =
            Math.floor(
                Math.random()*
                (
                    mapCols-
                    w-
                    6
                )
            )+3;


        const y =
            Math.floor(
                Math.random()*
                (
                    mapRows-
                    h-
                    6
                )
            )+3;


        const room =
            new Room(
                x,
                y,
                w,
                h
            );


        let failed=false;


        for(
            const other
            of rooms
        ){

            if(
                room.intersects(
                    other
                )
            ){

                failed=true;

                break;
            }
        }


        if(failed)
            continue;


        for(
            let r=room.y;
            r<
                room.y+
                room.h;
            r++
        ){

            for(
                let c=room.x;
                c<
                    room.x+
                    room.w;
                c++
            ){

                layoutGrid[r][c]=0;
            }
        }


        if(
            rooms.length
        ){

            const previous =
                rooms[
                    rooms.length-1
                ]
                .center();


            const current =
                room.center();


            if(
                Math.random()<.5
            ){

                carveHorizontalTunnel(
                    layoutGrid,
                    previous.x,
                    current.x,
                    previous.y
                );


                carveVerticalTunnel(
                    layoutGrid,
                    previous.y,
                    current.y,
                    current.x
                );

            }
            else{

                carveVerticalTunnel(
                    layoutGrid,
                    previous.y,
                    current.y,
                    current.x
                );


                carveHorizontalTunnel(
                    layoutGrid,
                    previous.x,
                    current.x,
                    previous.y
                );
            }
        }


        rooms.push(
            room
        );
    }


    /*
     * START Y ESCAPE
     */

    if (__mpSnapshot && __mpSnapshot.startCoord && __mpSnapshot.exitCoord) {
        startCoord = { x: Number(__mpSnapshot.startCoord.x), z: Number(__mpSnapshot.startCoord.z) };
        exitCoord = { x: Number(__mpSnapshot.exitCoord.x), z: Number(__mpSnapshot.exitCoord.z) };
    } else if(
        rooms.length>1
    ){

        const first =
            rooms[0].center();

        const last =
            rooms[
                rooms.length-1
            ]
            .center();


        startCoord={
            x:first.x,
            z:first.y
        };


        exitCoord={
            x:last.x,
            z:last.y
        };

    }
    else{

        startCoord={
            x:5,
            z:5
        };


        exitCoord={
            x:10,
            z:10
        };
    }


    layoutGrid[
        exitCoord.z
    ][
        exitCoord.x
    ]=2;


    /*
     * COLOCACIÓN DISTRIBUIDA
     * - 10 partículas lo más lejos posible entre sí
     * - 25 escondites bien repartidos (min distancia)
     * - 15 carbóns (se colocan después)
     */

    const walkableCells = [];

    for (let r = 1; r < mapRows - 1; r++) {
        for (let c = 1; c < mapCols - 1; c++) {
            if (
                layoutGrid[r][c] === 0 &&
                !(r === startCoord.z && c === startCoord.x) &&
                !(r === exitCoord.z && c === exitCoord.x)
            ) {
                walkableCells.push({ r, c });
            }
        }
    }

    // Mezclar para variedad
    for (let i = walkableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = walkableCells[i];
        walkableCells[i] = walkableCells[j];
        walkableCells[j] = tmp;
    }

    function cellDist(a, b) {
        return Math.hypot(a.r - b.r, a.c - b.c);
    }

    // --- 10 PARTÍCULAS: maximizar separación (farthest-point sampling) ---
    const ITEM_COUNT = 10;
    const itemCells = __mpSnapshot && Array.isArray(__mpSnapshot.keys)
        ? __mpSnapshot.keys.map(k => ({ r: Math.round(Number(k.z) / blockSize), c: Math.round(Number(k.x) / blockSize) }))
        : [];

    if (!__mpSnapshot && walkableCells.length > 0) {
        // Primera partícula: lo más lejos del inicio
        let bestIdx = 0;
        let bestD = -1;
        for (let i = 0; i < walkableCells.length; i++) {
            const d = Math.hypot(
                walkableCells[i].r - startCoord.z,
                walkableCells[i].c - startCoord.x
            );
            if (d > bestD) {
                bestD = d;
                bestIdx = i;
            }
        }
        itemCells.push(walkableCells[bestIdx]);
        walkableCells.splice(bestIdx, 1);

        while (itemCells.length < ITEM_COUNT && walkableCells.length > 0) {
            let farIdx = 0;
            let farScore = -1;
            for (let i = 0; i < walkableCells.length; i++) {
                let minD = Infinity;
                for (const placed of itemCells) {
                    const d = cellDist(walkableCells[i], placed);
                    if (d < minD) minD = d;
                }
                if (minD > farScore) {
                    farScore = minD;
                    farIdx = i;
                }
            }
            itemCells.push(walkableCells[farIdx]);
            walkableCells.splice(farIdx, 1);
        }
    }

    if (!__mpSnapshot) itemCells.forEach(cell => { layoutGrid[cell.r][cell.c] = 4; });

    // --- MUCHOS ESCONDITES repartidos por el mapa ---
    const HIDE_COUNT = CONFIG.hideCount;
    const HIDE_MIN_DIST = CONFIG.hideMinDist;
    const hideCells = __mpSnapshot && Array.isArray(__mpSnapshot.hides)
        ? __mpSnapshot.hides.map(h => ({ r: Math.round(Number(h.z) / blockSize), c: Math.round(Number(h.x) / blockSize) })) : [];

    if (__mpSnapshot) {
        // El grid recibido ya contiene las celdas de escondite.
    }

    // Reconstruir candidatos (sin celdas de ítems)
    const hideCandidates = [];
    for (let r = 1; r < mapRows - 1; r++) {
        for (let c = 1; c < mapCols - 1; c++) {
            if (
                layoutGrid[r][c] === 0 &&
                !(r === startCoord.z && c === startCoord.x) &&
                !(r === exitCoord.z && c === exitCoord.x)
            ) {
                hideCandidates.push({ r, c });
            }
        }
    }

    if (!__mpSnapshot) for (let i = hideCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = hideCandidates[i];
        hideCandidates[i] = hideCandidates[j];
        hideCandidates[j] = tmp;
    }

    if (!__mpSnapshot) for (const cell of hideCandidates) {
        if (hideCells.length >= HIDE_COUNT) break;
        let ok = true;
        for (const placed of hideCells) {
            if (cellDist(cell, placed) < HIDE_MIN_DIST) {
                ok = false;
                break;
            }
        }
        if (ok) {
            hideCells.push(cell);
            layoutGrid[cell.r][cell.c] = 5;
        }
    }

    // Si faltan por distancia estricta, relajar un poco
    if (!__mpSnapshot && hideCells.length < HIDE_COUNT) {
        for (const cell of hideCandidates) {
            if (hideCells.length >= HIDE_COUNT) break;
            if (layoutGrid[cell.r][cell.c] !== 0) continue;
            let ok = true;
            for (const placed of hideCells) {
                if (cellDist(cell, placed) < HIDE_MIN_DIST * 0.6) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                hideCells.push(cell);
                layoutGrid[cell.r][cell.c] = 5;
            }
        }
    }


    /*
     * CONSTRUIR MUNDO
     */

    const wallCoords=[];

    const exitCoords=[];

    const dummy =
        new THREE.Object3D();


    for(
        let r=0;
        r<mapRows;
        r++
    ){

        for(
            let c=0;
            c<mapCols;
            c++
        ){

            const cell =
                layoutGrid[r][c];


            const x =
                c*
                blockSize;


            const z =
                r*
                blockSize;


            if(
                cell===1
            ){

                wallCoords.push({
                    x,
                    z
                });
            }


            else if(
                cell===2
            ){

                exitCoords.push({
                    x,
                    z
                });
            }


            else if(
                cell===4
            ){
                let mesh = null;
                if (typeof ModelLibrary !== 'undefined' && ModelLibrary.templates.key) {
                    mesh = ModelLibrary.spawn('key', x, z, {
                        targetSize: 0.38,
                        rotY: Math.random() * Math.PI * 2,
                        floorY: -0.5
                    });
                }
                if (!mesh) {
                    mesh = (typeof ModelLibrary !== 'undefined')
                        ? ModelLibrary.fallbackMesh('key')
                        : new THREE.Mesh(sphereGeometry, itemMaterial);
                    mesh.position.set(x, -0.28, z);
                }
                // Forzar base sobre el suelo
                if (mesh) {
                    mesh.updateMatrixWorld(true);
                    const kb = new THREE.Box3().setFromObject(mesh);
                    if (kb.min.y < -0.5) mesh.position.y += (-0.5 - kb.min.y);
                    mesh.position.y += 0.02;
                }
                scene.add(mesh);
                let particles = null;
                try {
                    particles = createKeyParticles();
                    // Partículas justo encima de la llave
                    const py = mesh ? (mesh.position.y + 0.25) : -0.15;
                    particles.position.set(x, py, z);
                    scene.add(particles);
                } catch (e) {}
                collectibleObjects.push({
                    mesh,
                    particles,
                    x,
                    z,
                    collected: false
                });
            }


            else if(
                cell===5
            ){
                let mesh = null;
                if (typeof ModelLibrary !== 'undefined' && ModelLibrary.templates.escondite) {
                    mesh = ModelLibrary.spawn('escondite', x, z, {
                        targetSize: 1.2,
                        rotY: 0,
                        floorY: -0.5,
                        buryY: 0
                    });
                }
                if (!mesh) {
                    mesh = new THREE.Mesh(hideSpotGeometry, hideSpotMaterial);
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(x, -0.42, z);
                    mesh.renderOrder = 2;
                }
                scene.add(mesh);
                hideSpots.push({
                    mesh,
                    x,
                    z
                });
            }
        }
    }


    /*
     * PAREDES
     */

    if(
        wallCoords.length
    ){

        const walls =
            new THREE.InstancedMesh(
                boxGeometry,
                wallMaterial,
                wallCoords.length
            );


        for(
            let i=0;
            i<wallCoords.length;
            i++
        ){

            const p =
                wallCoords[i];


            dummy.position.set(
                p.x,
                CONFIG.wallY,
                p.z
            );


            dummy.updateMatrix();


            walls.setMatrixAt(
                i,
                dummy.matrix
            );


            collidableBoxes.push({

                box:
                    new THREE.Box3(

                        new THREE.Vector3(
                            p.x-.5,
                            -.5,
                            p.z-.5
                        ),

                        new THREE.Vector3(
                            p.x+.5,
                            5.8,
                            p.z+.5
                        )
                    )
            });
        }


        walls.instanceMatrix.needsUpdate =
            true;


        scene.add(
            walls
        );


        worldMeshes.push(
            walls
        );
    }


    /*
     * SALIDA
     */

    if(
        exitCoords.length
    ){

        exitMeshRef =
            new THREE.InstancedMesh(
                boxGeometry,
                exitMaterialLocked,
                exitCoords.length
            );


        for(
            let i=0;
            i<exitCoords.length;
            i++
        ){

            dummy.position.set(

                exitCoords[i].x,

                0,

                exitCoords[i].z

            );


            dummy.updateMatrix();


            exitMeshRef.setMatrixAt(
                i,
                dummy.matrix
            );
        }


        exitMeshRef.instanceMatrix.needsUpdate =
            true;


        scene.add(
            exitMeshRef
        );


        worldMeshes.push(
            exitMeshRef
        );
    }


    /*
     * SUELO
     */

    floorMesh =
        new THREE.Mesh(

            new THREE.PlaneGeometry(
                mapCols*
                blockSize,
                mapRows*
                blockSize
            ),

            floorMaterial

        );


    floorMesh.rotation.x =
        -Math.PI/2;


    floorMesh.position.set(

        (
            mapCols*
            blockSize
        )/2-
        blockSize/2,

        -.5,

        (
            mapRows*
            blockSize
        )/2-
        blockSize/2

    );


    scene.add(
        floorMesh
    );

    // Re-aplicar textura del suelo (por si el mapa se regeneró)
    if (gameTextures && gameTextures.floor) {
        const ft = gameTextures.floor;
        ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
        ft.repeat.set(Math.max(mapCols / 3, 20), Math.max(mapRows / 3, 20));
        ft.needsUpdate = true;
        floorMaterial.map = ft;
        floorMaterial.color.setHex(0xffffff);
        floorMaterial.needsUpdate = true;
        floorMesh.material = floorMaterial;
    }
    // Re-aplicar textura de escondites
    if (gameTextures && gameTextures.hide) {
        hideSpotMaterial.map = gameTextures.hide;
        hideSpotMaterial.color.setHex(0xffffff);
        hideSpotMaterial.needsUpdate = true;
        hideSpots.forEach(h => {
            if (h.mesh) {
                h.mesh.material = hideSpotMaterial;
                h.mesh.material.needsUpdate = true;
            }
        });
    }


    /*
     * TECHO (se oculta en modo volar) — negro, sin textura
     */
    ceilingMesh =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                mapCols * blockSize,
                mapRows * blockSize
            ),
            new THREE.MeshLambertMaterial({
                color: 0x0a0a12,
                side: THREE.DoubleSide
            })
        );

    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(
        (mapCols * blockSize) / 2 - blockSize / 2,
        CONFIG.ceilingY,
        (mapRows * blockSize) / 2 - blockSize / 2
    );
    ceilingMesh.visible = !isFlying;
    scene.add(ceilingMesh);


    /*
     * =====================================================
     * carbónS — exactamente 15, bien repartidas
     * =====================================================
     */

    const BATTERY_COUNT = CONFIG.batteryCount;
    const BATTERY_MIN_DIST = CONFIG.batteryMinDist;
    const batterySpawns = __mpSnapshot && Array.isArray(__mpSnapshot.batteries) ? __mpSnapshot.batteries.map(o => ({x:Number(o.x), z:Number(o.z)})) : [];

    const batteryCandidates = [];
    for (let r = 1; r < mapRows - 1; r++) {
        for (let c = 1; c < mapCols - 1; c++) {
            if (
                layoutGrid[r][c] === 0 &&
                !(r === startCoord.z && c === startCoord.x) &&
                !(r === exitCoord.z && c === exitCoord.x)
            ) {
                const distStart = Math.hypot(
                    c - startCoord.x,
                    r - startCoord.z
                );
                if (distStart > 5) {
                    batteryCandidates.push({ r, c });
                }
            }
        }
    }

    if (!__mpSnapshot) for (let i = batteryCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = batteryCandidates[i];
        batteryCandidates[i] = batteryCandidates[j];
        batteryCandidates[j] = tmp;
    }

    if (!__mpSnapshot) for (const cell of batteryCandidates) {
        if (batterySpawns.length >= BATTERY_COUNT) break;
        let ok = true;
        for (const placed of batterySpawns) {
            if (Math.hypot(cell.r - placed.z, cell.c - placed.x) < BATTERY_MIN_DIST) {
                ok = false;
                break;
            }
        }
        if (ok) {
            batterySpawns.push({
                x: cell.c * blockSize,
                z: cell.r * blockSize
            });
        }
    }

    // Relajar distancia si faltan
    if (!__mpSnapshot && batterySpawns.length < BATTERY_COUNT) {
        for (const cell of batteryCandidates) {
            if (batterySpawns.length >= BATTERY_COUNT) break;
            let ok = true;
            for (const placed of batterySpawns) {
                if (Math.hypot(cell.r - placed.z, cell.c - placed.x) < BATTERY_MIN_DIST * 0.55) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                batterySpawns.push({
                    x: cell.c * blockSize,
                    z: cell.r * blockSize
                });
            }
        }
    }

    batterySpawns.forEach(spawn => {
        let mesh = null;
        if (typeof ModelLibrary !== 'undefined' && ModelLibrary.templates.coal) {
            mesh = ModelLibrary.spawn('coal', spawn.x, spawn.z, {
                targetSize: 0.4,
                rotY: 0,
                floorY: -0.5
            });
        }
        if (!mesh) {
            mesh = (typeof ModelLibrary !== 'undefined')
                ? ModelLibrary.fallbackMesh('coal')
                : new THREE.Mesh(batteryGeometry, batteryMaterial);
            mesh.position.set(spawn.x, 0.25, spawn.z);
        }
        scene.add(mesh);
        batteryObjects.push({
            mesh,
            x: spawn.x,
            z: spawn.z,
            collected: false
        });
    });


    /*
     * =====================================================
     * CHOCOLATES — 40, restauran estamina (comer 3s)
     * =====================================================
     */

    const CHOCOLATE_COUNT = CONFIG.chocolateCount;
    const CHOCOLATE_MIN_DIST = 6;
    const chocolateSpawns = __mpSnapshot && Array.isArray(__mpSnapshot.pans) ? __mpSnapshot.pans.map(o => ({x:Number(o.x), z:Number(o.z)})) : [];

    const chocolateCandidates = [];
    for (let r = 1; r < mapRows - 1; r++) {
        for (let c = 1; c < mapCols - 1; c++) {
            if (
                layoutGrid[r][c] === 0 &&
                !(r === startCoord.z && c === startCoord.x) &&
                !(r === exitCoord.z && c === exitCoord.x)
            ) {
                chocolateCandidates.push({ r, c });
            }
        }
    }

    if (!__mpSnapshot) for (let i = chocolateCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = chocolateCandidates[i];
        chocolateCandidates[i] = chocolateCandidates[j];
        chocolateCandidates[j] = tmp;
    }

    if (!__mpSnapshot) for (const cell of chocolateCandidates) {
        if (chocolateSpawns.length >= CHOCOLATE_COUNT) break;
        let ok = true;
        for (const placed of chocolateSpawns) {
            if (Math.hypot(cell.r - placed.z, cell.c - placed.x) < CHOCOLATE_MIN_DIST) {
                ok = false;
                break;
            }
        }
        if (ok) {
            chocolateSpawns.push({
                x: cell.c * blockSize,
                z: cell.r * blockSize
            });
        }
    }

    if (!__mpSnapshot && chocolateSpawns.length < CHOCOLATE_COUNT) {
        for (const cell of chocolateCandidates) {
            if (chocolateSpawns.length >= CHOCOLATE_COUNT) break;
            let ok = true;
            for (const placed of chocolateSpawns) {
                if (Math.hypot(cell.r - placed.z, cell.c - placed.x) < CHOCOLATE_MIN_DIST * 0.5) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                chocolateSpawns.push({
                    x: cell.c * blockSize,
                    z: cell.r * blockSize
                });
            }
        }
    }

    chocolateSpawns.forEach(spawn => {
        let mesh = null;
        if (typeof ModelLibrary !== 'undefined' && ModelLibrary.templates.pan) {
            mesh = ModelLibrary.spawn('pan', spawn.x, spawn.z, {
                targetSize: 0.42,
                rotY: 0,
                floorY: -0.5
            });
        }
        if (!mesh) {
            mesh = (typeof ModelLibrary !== 'undefined')
                ? ModelLibrary.fallbackMesh('pan')
                : new THREE.Mesh(chocolateGeometry, chocolateMaterial);
            mesh.position.set(spawn.x, 0.12, spawn.z);
        }
        scene.add(mesh);
        chocolateObjects.push({
            mesh,
            x: spawn.x,
            z: spawn.z,
            collected: false
        });
    });

    /*
     * =====================================================
     * DECORACIÓN — props en el suelo (sin colisión)
     * =====================================================
     */
    (function spawnDecor() {
        if (typeof ModelLibrary === 'undefined') return;
        if (__mpSnapshot && Array.isArray(__mpSnapshot.decor)) {
            const sizes = { barril:0.7,caja:0.55,cubo:0.45,mesita:0.55,skull:0.35,skull2:0.35,sword:0.7,hacha:0.65,flecha:0.5,escudo:0.5,escudo1:0.5,pocion:0.3,metales:0.4,telarana:0.8 };
            for (const d of __mpSnapshot.decor) {
                const mesh = ModelLibrary.spawn(d.key, Number(d.x), Number(d.z), { targetSize:sizes[d.key]||0.5, rotY:Number(d.rotY)||0, floorY:-0.5, buryY:(d.key==='skull'||d.key==='skull2')?0.12:0 });
                if (!mesh) continue;
                scene.add(mesh);
                decorObjects.push({ mesh, x:Number(d.x), z:Number(d.z), key:d.key });
            }
            return;
        }
        // Móvil: menos decoración (si no, se queda en negro por falta de memoria)
        const _mob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        const DECOR_COUNT = _mob ? 80 : 480;
        const keys = ModelLibrary.decorKeys.filter(k => ModelLibrary.templates[k]);
        if (!keys.length) {
            console.warn('[decor] ningún modelo de decoración cargado');
            return;
        }

        const candidates = [];
        for (let r = 2; r < mapRows - 2; r++) {
            for (let c = 2; c < mapCols - 2; c++) {
                if (layoutGrid[r][c] !== 0) continue;
                if (startCoord && r === startCoord.z && c === startCoord.x) continue;
                if (exitCoord && r === exitCoord.z && c === exitCoord.x) continue;
                candidates.push({ r, c });
            }
        }
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;
        }

        // Tamaño máximo en unidades del mundo (moderado)
        const sizes = {
            barril: 0.7, caja: 0.55, cubo: 0.45, mesita: 0.55,
            skull: 0.35, skull2: 0.35, sword: 0.7, hacha: 0.65,
            flecha: 0.5, escudo: 0.5, escudo1: 0.5, pocion: 0.3,
            metales: 0.4, telarana: 0.8
        };

        // Repartir tipos de forma equilibrada
        let keyIdx = 0;
        let placed = 0;
        for (const cell of candidates) {
            if (placed >= DECOR_COUNT) break;
            let ok = true;
            for (const d of decorObjects) {
                if (Math.hypot(cell.r - d.z / blockSize, cell.c - d.x / blockSize) < 1.5) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            const key = keys[keyIdx % keys.length];
            keyIdx++;
            const x = cell.c * blockSize;
            const z = cell.r * blockSize;
            const bury = (key === 'skull' || key === 'skull2') ? 0.12 : 0;
            const mesh = ModelLibrary.spawn(key, x, z, {
                targetSize: sizes[key] || 0.5,
                rotY: Math.random() * Math.PI * 2,
                floorY: -0.5,
                buryY: bury
            });
            if (!mesh) continue;
            scene.add(mesh);
            decorObjects.push({ mesh, x, z, key });
            placed++;
        }
        console.info('[decor] colocados', placed, 'tipos', keys.length);
    })();


    /*
     * =====================================================
     * 5 MONSTRUOS
     * =====================================================
     */

    const monsterSpawns = __mpSnapshot && Array.isArray(__mpSnapshot.monsters)
        ? __mpSnapshot.monsters.map(m => ({x:Number(m.x) / blockSize, z:Number(m.z) / blockSize}))
        : findMonsterSpawnPoints();


    for(
        let i=0;
        i<5;
        i++
    ){

        const spawn =
            monsterSpawns[i] ||
            monsterSpawns[0];

        let mesh = null;
        let clips = [];

        // Modelo 3D animado
        const tpl = (typeof ModelLibrary !== 'undefined' && ModelLibrary.templates.monster)
            ? ModelLibrary.templates.monster
            : null;
        clips = (ModelLibrary && ModelLibrary.animations && ModelLibrary.animations.monster) || [];

        if (tpl) {
            // Clonar con skeleton si está disponible
            if (typeof THREE !== 'undefined' && THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
                mesh = THREE.SkeletonUtils.clone(tpl);
            } else {
                mesh = tpl.clone(true);
            }
            mesh.userData.animationClips = clips;

            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
            mesh.scale.set(1, 1, 1);
            mesh.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(mesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetH = 5.5;
            mesh.scale.setScalar(targetH / maxDim);
            mesh.updateMatrixWorld(true);

            const box2 = new THREE.Box3().setFromObject(mesh);
            // baseY para que los pies toquen el suelo (y = -0.5 en este juego → offset)
            const baseY = -0.5 - box2.min.y;

            mesh.position.set(
                spawn.x * blockSize,
                baseY,
                spawn.z * blockSize
            );
            mesh.frustumCulled = false;
            mesh.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = false;
                    c.receiveShadow = false;
                    c.frustumCulled = false;
                    if (c.material) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach((mat) => {
                            // Lo más oscuro posible, sin brillo
                            if (mat.color) mat.color.setHex(0x050505);
                            if (mat.emissive) {
                                mat.emissive.setHex(0x000000);
                                mat.emissiveIntensity = 0;
                            }
                            if (mat.metalness != null) mat.metalness = 0;
                            if (mat.roughness != null) mat.roughness = 1;
                            if (mat.specular) mat.specular.setHex(0x000000);
                            mat.needsUpdate = true;
                        });
                    }
                }
            });

            scene.add(mesh);

            const ai = new MonsterAI(mesh, layoutGrid, blockSize, checkMonsterCollision);
            ai.baseY = baseY;
            monsterAIs.push(ai);
        } else {
            // Fallback cápsula roja
            const material = monsterMaterial.clone();
            mesh = new THREE.Mesh(monsterGeometry, material);
            mesh.position.set(spawn.x * blockSize, 0.7, spawn.z * blockSize);
            mesh.frustumCulled = false;
            scene.add(mesh);
            const ai = new MonsterAI(mesh, layoutGrid, blockSize, checkMonsterCollision);
            ai.baseY = 0.7;
            monsterAIs.push(ai);
        }
    }
    console.info('[monsters] spawneados', monsterAIs.length, ModelLibrary && ModelLibrary.templates.monster ? '(GLB)' : '(fallback)');


    /*
     * REINICIAR carbón
     */

    batteryPhasesCount =
        MAX_BATTERY;

    flashlightOn=false;
    flashlight.intensity=0;
    flashlightDrainTimer=0;

    updateBatteryUI();

    stamina = MAX_STAMINA;
    chocolateInventory = 0;
    updateStaminaUI();


    /*
     * SCORE
     */

    score=0;

    totalItemsCount =
        collectibleObjects.length;


    yawObject.position.set(

        startCoord.x*
        blockSize,

        0,

        startCoord.z*
        blockSize

    );


    yawObject.rotation.y=0;

    pitchObject.rotation.x=0;


    updateHUDUI();


    showNotification(

        `NIVEL ${currentLevel}`,

        'Cinco monstruos están junto a la salida.'

    );

    // Guardar una copia inmutable del mundo autoritativo del nivel.
    // Esto hace que un reinicio nunca regenere otra distribución.
    if (__isHostCoop && typeof Multiplayer !== 'undefined' && typeof Multiplayer._worldSnapshot === 'function' && typeof window !== 'undefined') {
        window.__paralogismoCoopWorlds = window.__paralogismoCoopWorlds || {};
        window.__paralogismoCoopBaseWorlds = window.__paralogismoCoopBaseWorlds || {};
        const snap = Multiplayer._worldSnapshot();
        if (snap) {
            // Solo el primer snapshot del nivel es la plantilla de reinicio.
            // Nunca se sustituye por uno donde ya falten recursos.
            if (!window.__paralogismoCoopBaseWorlds[currentLevel]) {
                window.__paralogismoCoopBaseWorlds[currentLevel] = JSON.parse(JSON.stringify(snap));
            }
            window.__paralogismoCoopWorlds[currentLevel] = snap;
        }
    }

    Math.random = __randomOriginal;
}


/* =========================================================
   HUD
========================================================= */


/* =========================================================
   PORTAL (aparece al 100% Magic Keys)
========================================================= */
function removePortal() {
    if (portalMesh) {
        scene.remove(portalMesh);
        portalMesh = null;
    }
    portalMixer = null;
    portalSpawned = false;
}

function placePortalRoot(root, clips, worldX, worldZ) {
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    // Hacer visibles materiales (a veces el “interior” del portal viene apagado)
    root.traverse((c) => {
        if (!c.isMesh || !c.material) return;
        c.visible = true;
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((mat) => {
            mat.visible = true;
            mat.transparent = !!mat.transparent;
            mat.depthWrite = mat.depthWrite !== false;
            mat.side = THREE.DoubleSide;
            if (mat.emissive) {
                // un poco de brillo para que se note el vórtice
                if (mat.emissive.getHex && mat.emissive.getHex() === 0) {
                    mat.emissive.setHex(0x220044);
                }
            }
            mat.needsUpdate = true;
        });
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.setScalar(2.8 / maxDim);
    root.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x = worldX - center.x;
    root.position.z = worldZ - center.z;
    root.position.y = -0.5 - box2.min.y;

    scene.add(root);
    portalMesh = root;
    worldMeshes.push(root);

    // Animación activa del portal (no Static Pose)
    if (clips && clips.length && typeof THREE.AnimationMixer !== 'undefined') {
        portalMixer = new THREE.AnimationMixer(root);

        let clip =
            clips.find(c => /portalmain/i.test(c.name)) ||
            clips.find(c => /mainaction/i.test(c.name)) ||
            clips.find(c => !/static|pose/i.test(c.name)) ||
            (clips.length > 1 ? clips[1] : clips[0]);

        // Reproducir TODAS las no-estáticas por si el vórtice está en otra pista
        const toPlay = clips.filter(c => !/static|pose/i.test(c.name));
        if (!toPlay.length) toPlay.push(clip);

        toPlay.forEach((c, i) => {
            const action = portalMixer.clipAction(c);
            action.reset();
            action.setEffectiveWeight(1);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            if (i === 0) {
                console.info('[portal] anim principal:', c.name, '| todas:', clips.map(x => x.name));
            }
        });
    } else {
        console.warn('[portal] sin clips de animación en el GLB');
    }
}

function spawnPortalAtExit() {
    if (portalSpawned || !exitCoord) return;
    portalSpawned = true; // evitar dobles cargas

    const worldX = exitCoord.x * blockSize;
    const worldZ = exitCoord.z * blockSize;

    if (exitMeshRef) exitMeshRef.visible = false;

    // Recargar el GLB fresco: clone() rompe skins/animaciones del portal
    const path = (typeof ModelLibrary !== 'undefined' ? ModelLibrary.path : 'assets/models/') + 'portal.glb';

    const finishFallback = () => {
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(1.25, 32),
            new THREE.MeshBasicMaterial({
                color: 0xaa66ff,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(worldX, 0.12, worldZ);
        scene.add(disc);
        portalMesh = disc;
        worldMeshes.push(disc);
        console.warn('[portal] fallback disco (sin animación de GLB)');
    };

    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
        finishFallback();
        return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
        path,
        (gltf) => {
            // Si se reinició el mapa mientras cargaba, abortar
            if (!portalSpawned && portalMesh) return;
            const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!root) {
                finishFallback();
                return;
            }
            const clips = gltf.animations || [];
            placePortalRoot(root, clips, worldX, worldZ);
        },
        undefined,
        (err) => {
            console.warn('[portal] error cargando', path, err);
            // Intentar template en memoria
            const tpl = ModelLibrary && ModelLibrary.templates && ModelLibrary.templates.portal;
            const clips = (ModelLibrary && ModelLibrary.animations && ModelLibrary.animations.portal) || [];
            if (tpl) {
                // Último recurso: usar original (no clone) y moverlo
                placePortalRoot(tpl, clips, worldX, worldZ);
            } else {
                finishFallback();
            }
        }
    );
}


function updateHUDUI(){

    const allCollected =
        score>=
        totalItemsCount &&
        totalItemsCount>0;


    const pct =
        totalItemsCount>0
            ? (
                score/
                totalItemsCount
            )*
            100
            :0;


    if (progressFill) {
        progressFill.style.width = `${pct}%`;
    }

    if (progressPct) {
        progressPct.textContent = `${Math.floor(pct)}%`;
    }

    const keyMini = document.getElementById('key-mini-count');
    if (keyMini) {
        keyMini.textContent = `${score}/${totalItemsCount || 0}`;
    }


    // Radar de salida solo cuando todas las partículas están recogidas
    if (radarContainer) {
        if (allCollected) {
            radarContainer.classList.add('visible');
        } else {
            radarContainer.classList.remove('visible');
        }
    }


    // Mesh de salida + icono candado junto al nivel (sin texto)
    const doorIcon = document.getElementById('door-lock-icon');
    if (allCollected) {
        if (exitMeshRef) {
            exitMeshRef.visible = false;
        }
        if (doorIcon) doorIcon.src = 'assets/ui/unlock.png';
        spawnPortalAtExit();
        if (!window.__exitUnlockNotified && totalItemsCount > 0) {
            window.__exitUnlockNotified = true;
            showNotification(
                '¡PORTAL ABIERTO!',
                'El portal ha aparecido · Sigue la brújula'
            );
        }
    } else {
        window.__exitUnlockNotified = false;
        if (exitMeshRef) {
            exitMeshRef.visible = true;
            exitMeshRef.material = exitMaterialLocked;
            if (exitMeshRef.instanceMatrix) exitMeshRef.instanceMatrix.needsUpdate = true;
        }
        if (doorIcon) doorIcon.src = 'assets/ui/lock.png';
        if (portalSpawned) removePortal();
    }
}


/* =========================================================
   carbón HUD
========================================================= */

function updateBatteryUI(){
    const coalFill = document.getElementById('coal-bar-fill');
    if (coalFill) {
        const pct = Math.max(0, Math.min(100, (batteryPhasesCount / MAX_BATTERY) * 100));
        coalFill.style.width = pct + '%';
    }


    batteryText.textContent =
        `${batteryPhasesCount} / ${MAX_BATTERY}`;


    batteryPhases.forEach(
        (
            phase,
            index
        ) => {

            phase.classList.toggle(

                'active',

                index<
                batteryPhasesCount

            );
        }
    );


    flashlightStatus.textContent =
        flashlightOn
            ? 'Farol: ENCENDIDO [R]'
            : 'Farol: APAGADO [R]';


    flashlightStatus.classList.toggle(
        'on',
        flashlightOn
    );
}


function updateStaminaUI(){
    const pct = Math.max(0, Math.min(100, (stamina / MAX_STAMINA) * 100));
    if (staminaFill) staminaFill.style.width = `${pct}%`;
    if (staminaText) staminaText.textContent = `${Math.floor(pct)}%`;
    if (chocolateCountEl) chocolateCountEl.textContent = `${chocolateInventory}`;
}


/* =========================================================
   LINTERNA
========================================================= */

function toggleFlashlight(){

    if(
        batteryPhasesCount<=0
    ){

        flashlightOn=false;

        updateBatteryUI();

        showNotification(
            'CARBÓN AGOTADO',
            'Necesitas encontrar carbón.'
        );

        return;
    }


    flashlightOn =
        !flashlightOn;


    if (flashlightOn) {
        flashlight.intensity = 14;
        flashlight.distance = 18;
        flashlight.angle = Math.PI / 5;
        flashlight.penumbra = 0.4;
        flashlight.decay = 1.6;
        flashlightDrainTimer = 0;
    } else {
        flashlight.intensity = 0;
    }

    updateBatteryUI();
}


/* =========================================================
   DRENAR carbón
========================================================= */

function updateFlashlightBattery(
    delta
){

    if(
        !flashlightOn
    )
        return;


    if(
        batteryPhasesCount<=0
    ){

        flashlightOn=false;

        flashlight.intensity=0;

        updateBatteryUI();

        return;
    }


    flashlightDrainTimer +=
        delta;


    /*
     * CADA 4 SEGUNDOS
     * SE PIERDE UNA FASE.
     */

    if(
        flashlightDrainTimer>=
        FLASHLIGHT_DRAIN_TIME
    ){

        flashlightDrainTimer -=
            FLASHLIGHT_DRAIN_TIME;


        batteryPhasesCount--;


        if(
            batteryPhasesCount<=0
        ){

            batteryPhasesCount=0;

            flashlightOn=false;
            flashlight.intensity=0;
            showNotification(
                'CARBÓN AGOTADO',
                'El farol se apagó.'
            );
        }


        updateBatteryUI();
    }
}


/* =========================================================
   RECOGER carbón
   2 SEGUNDOS
========================================================= */

let collectingBattery=null;

let batteryCollectStart=0;

const BATTERY_COLLECT_TIME =
    2000;


function startBatteryCollection(){

    if(
        collectingBattery ||
        collectingPan ||
        isHidden ||
        isFlying
    )
        return;


    let nearest=null;

    let nearestDistance=
        Infinity;


    for(
        const battery
        of batteryObjects
    ){

        if(
            battery.collected
        )
            continue;


        const distance =
            Math.hypot(

                yawObject.position.x-
                battery.x,

                yawObject.position.z-
                battery.z

            );


        if(
            distance < 2.2 &&
            distance < nearestDistance
        ){
            nearest = battery;
            nearestDistance = distance;
        }
    }

    if(!nearest)
        return;


    collectingBattery =
        nearest;


    batteryCollectStart =
        performance.now();

    showPrompt('Carbón', true);
}


function finishBatteryCollection(){
    if (!collectingBattery || collectingBattery.collected) {
        collectingBattery = null;
        return;
    }

    const idx = batteryObjects.indexOf(collectingBattery);
    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) {
        if (idx >= 0) Multiplayer.requestResource('battery', idx);
        collectingBattery = null;
        hidePrompt();
        return;
    }

    collectingBattery.collected = true;
    scene.remove(collectingBattery.mesh);
    batteryPhasesCount = Math.min(MAX_BATTERY, batteryPhasesCount + 1);
    updateBatteryUI();
    showNotification('CARBÓN', `Fase recargada: ${batteryPhasesCount}/5`);
    if (typeof Multiplayer !== 'undefined' && Multiplayer.isConnected() && Multiplayer.isHost) {
        Multiplayer.broadcast({ t: 'resourceState', state: Multiplayer._resourceState() });
    }
    collectingBattery = null;
    hidePrompt();
}


/* =========================================================
   RECOGER ÍTEM
   5 SEGUNDOS
========================================================= */

function startPanCollection(){

    if(
        collectingItem ||
        collectingBattery ||
        collectingPan ||
        isHidden ||
        isFlying
    )
        return;

    let nearest = null;
    let nearestDistance = Infinity;

    for (const choco of chocolateObjects) {
        if (choco.collected) continue;
        const distance = Math.hypot(
            yawObject.position.x - choco.x,
            yawObject.position.z - choco.z
        );
        if (distance < 2.2 && distance < nearestDistance) {
            nearest = choco;
            nearestDistance = distance;
        }
    }

    if (!nearest) return;

    collectingPan = nearest;
    chocolateCollectStart = performance.now();
    showPrompt('Pan', true);
}


function finishPanCollection(){
    if (!collectingPan || collectingPan.collected) {
        collectingPan = null;
        return;
    }

    const idx = chocolateObjects.indexOf(collectingPan);
    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) {
        if (idx >= 0) Multiplayer.requestResource('pan', idx);
        collectingPan = null;
        hidePrompt();
        return;
    }

    collectingPan.collected = true;
    scene.remove(collectingPan.mesh);
    chocolateInventory++;
    stamina = Math.min(MAX_STAMINA, stamina + STAMINA_CHOCOLATE_BOOST);
    updateStaminaUI();
    showNotification('PAN', `+${STAMINA_CHOCOLATE_BOOST} vigor · Pan ${chocolateInventory}`);
    if (typeof Multiplayer !== 'undefined' && Multiplayer.isConnected() && Multiplayer.isHost) {
        Multiplayer.broadcast({ t: 'resourceState', state: Multiplayer._resourceState() });
    }
    collectingPan = null;
    hidePrompt();
}


function relocateCollectible(obj) {
    if (!obj || obj.collected) return;
    // Nueva celda caminable lejos del jugador
    const tries = 80;
    for (let t = 0; t < tries; t++) {
        const r = 1 + Math.floor(Math.random() * (mapRows - 2));
        const c = 1 + Math.floor(Math.random() * (mapCols - 2));
        if (!isWalkableCell(r, c)) continue;
        const x = c * blockSize;
        const z = r * blockSize;
        const dPlayer = Math.hypot(x - yawObject.position.x, z - yawObject.position.z);
        if (dPlayer < blockSize * 4) continue;
        obj.x = x;
        obj.z = z;
        if (obj.mesh) obj.mesh.position.set(x, obj.mesh.position.y, z);
        if (obj.particles) obj.particles.position.set(x, obj.particles.position.y, z);
        return;
    }
}

function startCollecting(){

    if(
        collectingItem ||
        collectingBattery ||
        collectingPan ||
        isHidden ||
        isFlying ||
        (typeof window !== 'undefined' && window.__falaciaBlock)
    )
        return;


    let nearest=null;

    let nearestDist=
        Infinity;


    for(
        const obj
        of collectibleObjects
    ){

        if(
            obj.collected
        )
            continue;


        const distance =
            Math.hypot(

                yawObject.position.x-
                obj.x,

                yawObject.position.z-
                obj.z

            );


        if(
            distance < 2.2 &&
            distance < nearestDist
        ){
            nearest = obj;
            nearestDist = distance;
        }
    }

    if(!nearest)
        return;

    // Modo educativo: pregunta de falacia antes de recolectar
    if (typeof FalaciaQuiz !== 'undefined' && FalaciaQuiz.enabled) {
        FalaciaQuiz.ask('collect').then((ok) => {
            if (ok) {
                const idx = collectibleObjects.indexOf(nearest);
                if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled) {
                    if (Multiplayer.requestKey(idx)) {
                        showNotification('MAGIC KEY', 'Recogida compartida…');
                    } else {
                        showNotification('MULTIJUGADOR', 'Esperando conexión con el host…');
                    }
                } else {
                    collectingItem = nearest;
                    collectStartTime = performance.now();
                    finishCollecting();
                }
            } else {
                // En cooperativo solo el host mueve la llave; así ambos ven el
                // mismo cambio de posición.
                if (typeof Multiplayer === 'undefined' || !Multiplayer.isConnected() || Multiplayer.isHost) {
                    relocateCollectible(nearest);
                    if (typeof Multiplayer !== 'undefined' && Multiplayer.isConnected() && Multiplayer.isHost) {
                        Multiplayer.broadcast({ t: 'resourceState', state: Multiplayer._resourceState() });
                    }
                }
                showNotification('TIEMPO / ERROR', 'La Magic Key se ha movido');
            }
            try { enterGameLock(); } catch (e) {}
        });
        return;
    }

    collectingItem = nearest;


    collectStartTime =
        performance.now();

    showPrompt('Magic Key', true);
}


function finishCollecting(){

    // En cooperativo el cliente no consume la llave localmente: solicita al
    // host que la marque para TODOS.
    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost && collectingItem) {
        const idx = collectibleObjects.indexOf(collectingItem);
        if (idx >= 0 && !collectingItem.collected) Multiplayer.requestKey(idx);
        collectingItem = null;
        hidePrompt();
        return;
    }

    if(
        !collectingItem ||
        collectingItem.collected
    ){

        cancelCollecting();

        return;
    }


    collectingItem.collected = true;
    scene.remove(collectingItem.mesh);
    if (collectingItem.particles) {
        scene.remove(collectingItem.particles);
        collectingItem.particles = null;
    }
    score++;

    if (typeof Multiplayer !== 'undefined' && Multiplayer.isConnected() && Multiplayer.isHost) {
        Multiplayer.broadcast({ t: 'resourceState', state: Multiplayer._resourceState(), score });
    }

    updateHUDUI();


    if (score >= totalItemsCount && totalItemsCount > 0) {
        showNotification(
            '¡TODAS RECOGIDAS!',
            'Salida abierta · Radar activo · ¡Los monstruos van a la salida!'
        );
    } else {
        showNotification(
            'PARTÍCULA RECOGIDA',
            `${Math.floor((score / totalItemsCount) * 100)}%`
        );
    }


    collectingItem=null;

    hidePrompt();
}


function cancelCollecting(){

    collectingItem=null;

    collectingBattery=null;

    collectingPan=null;

    hidePrompt();
}


/* =========================================================
   ESCONDERSE
========================================================= */

function toggleHideAction(){

    if(
        isFlying
    )
        return;


    if(
        isHidden
    ){

        isHidden=false;
        yawObject.position.y = 0;
        velocityY = 0;

        currentHideSpot=null;

        if (ocultoText) ocultoText.classList.remove('visible');
        hideVision.classList.remove('visible');
        GameMusic.setHidden(false);

        return;
    }


    for(
        const spot
        of hideSpots
    ){

        const distance =
            Math.hypot(

                yawObject.position.x-
                spot.x,

                yawObject.position.z-
                spot.z

            );


        if(
            distance<1
        ){

            isHidden=true;
            yawObject.position.y = 0;
            velocityY = 0;

            currentHideSpot=
                spot;


            yawObject.position.x=
                spot.x;

            yawObject.position.z=
                spot.z;


            if (ocultoText) ocultoText.classList.add('visible');
            hideVision.classList.add('visible');
            GameMusic.setHidden(true);

            cancelCollecting();

            break;
        }
    }
}


/* =========================================================
   TECLADO
========================================================= */

document.addEventListener(
    'keydown',
    event => {

        if (
            event.repeat &&
            (event.code === 'KeyT' ||
             event.code === 'KeyY' ||
             event.code === 'KeyQ' ||
             event.code === 'KeyR' ||
             event.code === 'KeyE')
        ) {
            return;
        }


        switch(
            event.code
        ){

            case 'KeyW':

                moveForward=true;

                break;


            case 'KeyS':

                moveBackward=true;

                break;


            case 'KeyA':

                moveLeft=true;

                break;


            case 'KeyD':

                moveRight=true;

                break;


            case 'ControlLeft':
            case 'ControlRight':

                isRunning=true;

                if (modeText) modeText.textContent =
                    isFlying
                        ? 'Volar'
                        : 'Correr';

                break;


            case 'Space':

                if (isFlying) {
                    moveUp = true;
                } else if (!isDead && !isHidden && !(typeof gamePaused !== 'undefined' && gamePaused)) {
                    if (yawObject.position.y <= 0.05 && velocityY <= 0.05) {
                        velocityY = JUMP_FORCE;
                    }
                }

                break;


            case 'ShiftLeft':
            case 'ShiftRight':

                if (isFlying) {
                    moveDown = true;
                } else {
                    isRunning = true;
                }

                break;


            case 'KeyT':

                if (isDead) break;
                if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) break;

                isFlying =
                    !isFlying;

                velocityY = 0;
                if (!isFlying) {
                    yawObject.position.y = 0;
                }

                if(
                    isFlying &&
                    isHidden
                ){

                    toggleHideAction();
                }

                // Modo volar: sin niebla, más luz y sin techo. Normal: niebla intensa + techo.
                if (isFlying) {
                    scene.fog.density = FOG_FLY;
                    ambientLight.intensity = 0.85;
                    playerLight.intensity = 0.55;
                    playerLight.distance = 40;
                    if (ceilingMesh) ceilingMesh.visible = false;
                } else {
                    scene.fog.density = FOG_NORMAL;
                    ambientLight.intensity = 0.16;
                    playerLight.intensity = 0.18;
                    playerLight.distance = 4;
                    if (ceilingMesh) ceilingMesh.visible = true;
                }

                if (modeText) modeText.textContent =
                    isFlying
                        ? 'Volar'
                        : (
                            isRunning
                                ? 'Correr'
                                : 'Caminar'
                        );

                break;


            case 'KeyE':

                if (isDead) break;

                if(
                    isHidden
                ){
                    toggleHideAction();
                }
                else{
                    toggleHideAction();

                    if(
                        !isHidden
                    ){
                        if(
                            !collectingItem &&
                            !collectingBattery &&
                            !collectingPan
                        ){
                            startCollecting();

                            if(
                                !collectingItem
                            ){
                                startBatteryCollection();
                            }

                            if(
                                !collectingItem &&
                                !collectingBattery
                            ){
                                startPanCollection();
                            }
                        }
                    }
                }

                break;


            case 'KeyZ':
                if (event.altKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) break;
                    if (typeof FalaciaQuiz !== 'undefined') FalaciaQuiz.toggle();
                }
                break;

            case 'KeyR':

                if (isDead) break;

                toggleFlashlight();

                break;


            case 'KeyM':
                // CUALQUIER jugador puede pedir reinicio. El HOST ejecuta el
                // reset y lo replica a todos: mismo mapa, recursos restaurados
                // y portal bloqueado otra vez.
                if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled) {
                    if (Multiplayer.isHost) {
                        generateAndBuildWorld(false, true, true);
                        Multiplayer.broadcastWorldLevel(true);
                        showNotification('PARTIDA REINICIADA', `Nivel ${currentLevel} · mismo mapa · portal bloqueado`);
                    } else if (typeof Multiplayer.requestReset === 'function') {
                        Multiplayer.requestReset();
                    }
                    break;
                }
                generateAndBuildWorld(false);
                showNotification('MAPA REINICIADO', `Nivel ${currentLevel} · misma generación`);
                break;
        }
    }
);



/* =========================================================
   ALT + X: RECOGER TODOS LOS ÍTEMS
========================================================= */

document.addEventListener(
    'keydown',
    event => {

        if(
            event.altKey &&
            event.code==='KeyX'
        ){

            if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) return;
            event.preventDefault();

            cancelCollecting();

            let collectedNow=0;


            collectibleObjects.forEach(
                obj => {

                    if(
                        obj.collected
                    )
                        return;


                    obj.collected=true;

                    scene.remove(
                        obj.mesh
                    );

                    score++;

                    collectedNow++;
                }
            );


            if(
                collectedNow>0
            ){

                updateHUDUI();

                showNotification(
                    'ÍTEMS RECOGIDOS',
                    `${score} / ${totalItemsCount}`
                );
            }
        }
    }
);


/* =========================================================
   KEYUP
========================================================= */

document.addEventListener(
    'keyup',
    event => {

        switch(
            event.code
        ){

            case 'KeyW':

                moveForward=false;

                break;


            case 'KeyS':

                moveBackward=false;

                break;


            case 'KeyA':

                moveLeft=false;

                break;


            case 'KeyD':

                moveRight=false;

                break;


            case 'ControlLeft':
            case 'ControlRight':

                isRunning=false;

                if (modeText) modeText.textContent =
                    isFlying
                        ? 'Volar'
                        : 'Caminar';

                break;


            case 'Space':

                moveUp=false;

                break;


            case 'ShiftLeft':
            case 'ShiftRight':

                moveDown = false;
                if (!isFlying) {
                    isRunning = false;
                    if (modeText) modeText.textContent = isFlying ? 'Volar' : 'Caminar';
                }

                break;


            case 'KeyE':

                cancelCollecting();

                break;
        }
    }
);


/* =========================================================
   FULLSCREEN + POINTER LOCK + BLOQUEO DEL NAVEGADOR
========================================================= */

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.innerWidth < 1200);
}


function enterGameLock(){
    if (isDead) return;
    // No forzar lock si el menú de pausa está abierto (permite clicar Continuar / Menú)
    if (typeof gamePaused !== 'undefined' && gamePaused) return;
    if (typeof gameStarted !== 'undefined') gameStarted = true;
    GameMusic.play();
    const sm = document.getElementById('start-menu');
    if (sm) sm.classList.remove('visible');

    const root = document.documentElement;
    const mobile = isMobileDevice();

    // Pantalla completa
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req =
            root.requestFullscreen ||
            root.webkitRequestFullscreen ||
            root.msRequestFullscreen;
        if (req) {
            try {
                const p = req.call(root);
                if (p && typeof p.then === 'function') p.catch(function () {});
            } catch (e) {}
        }
    }

    // Pointer lock SOLO en PC (en móvil rompe el input)
    if (!mobile) {
        if (document.pointerLockElement !== renderer.domElement) {
            try {
                var pl = renderer.domElement.requestPointerLock();
                if (pl && typeof pl.then === 'function') pl.catch(function () {});
            } catch (e) {}
        }
    }
}

// Cualquier clic en el juego entra en fullscreen + pointer lock
renderer.domElement.addEventListener('click', enterGameLock);
document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t) return;
    // No interferir con botones de menús
    const id = t.id || '';
    if (id === 'btn-revive' || id === 'btn-restart' || id === 'btn-pause-restart' || id === 'btn-continue' || id === 'btn-quit' || id === 'btn-start' || id === 'btn-mute' || id === 'btn-save') return;
    if (t.closest && (t.closest('#pause-menu') || t.closest('#death-overlay') || t.closest('#start-menu'))) return;
    if (typeof gamePaused !== 'undefined' && gamePaused) return;
    if (isDead) return;
    enterGameLock();
});

// Si el usuario sale de fullscreen, re-entrar en el próximo clic (ya cubierto)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !isDead) {
        // no forzar en bucle; el próximo clic lo recupera
    }
});

// Bloquear menú contextual y arrastre
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());

// Evitar gestos / scroll del navegador
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });
window.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// Bloquear teclas del navegador que estorban
document.addEventListener('keydown', e => {
    const blockKeys = new Set([
        'Tab', 'F1', 'F3', 'F5', 'F6', 'F7', 'F10', 'F11', 'F12',
        'Escape', 'PrintScreen', 'Meta', 'OS', 'ContextMenu'
    ]);
    if (blockKeys.has(e.key) || blockKeys.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
    }
    // Ctrl/Cmd + teclas habituales del navegador
    if (e.ctrlKey || e.metaKey) {
        const k = (e.key || '').toLowerCase();
        if (['r','w','t','n','s','p','o','u','h','j','d','f','g','l','+','-','=','0'].includes(k)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    // Alt + flechas / left-right browser nav
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
    }
}, true);




document.addEventListener(
    'mousemove',
    event => {

        if(
            document.pointerLockElement===
            renderer.domElement
        ){

            yawObject.rotation.y -=
                event.movementX*
                .002;


            pitchObject.rotation.x =
                Math.max(

                    -Math.PI/2.1,

                    Math.min(

                        Math.PI/2.1,

                        pitchObject.rotation.x-
                        event.movementY*
                        .002
                    )
                );
        }
    }
);


/* =========================================================
   CARGAR TEXTURAS + GENERAR MUNDO
   assets/textures/wall.png  → paredes
   assets/textures/floor.png → suelo
   techo → negro (sin textura)
========================================================= */

function applyAllTextures() {
    if (typeof Materials === 'undefined') return;
    Materials.applyTo(
        wallMaterial,
        floorMaterial,
        hideSpotMaterial,
        gameTextures,
        mapCols,
        mapRows
    );
    // Forzar en mallas ya existentes
    if (floorMesh && gameTextures.floor) {
        floorMesh.material = floorMaterial;
        floorMesh.material.needsUpdate = true;
    }
    if (hideSpots && hideSpots.length && gameTextures.hide) {
        hideSpots.forEach(h => {
            if (h.mesh) {
                h.mesh.material = hideSpotMaterial;
                h.mesh.material.needsUpdate = true;
            }
        });
    }
}

function startGameWithTextures() {
    // Cliente cooperativo: no crea un mapa local al arrancar. Espera el snapshot del HOST.
    let __mpJoin = false;
    try { __mpJoin = sessionStorage.getItem('paralogismo_mp_mode') === 'join'; } catch (e) {}
    if (__mpJoin && typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) {
        window.__paralogismoWaitingForHostWorld = true;
        return;
    }
    generateAndBuildWorld(false);
    applyAllTextures();
}

function verifyRequiredModels() {
    if (typeof ModelLibrary === 'undefined') return false;
    const required = ['monster','key','coal','pan','escondite'];
    const missing = required.filter(k => !ModelLibrary.templates || !ModelLibrary.templates[k]);
    if (missing.length) {
        console.warn('[models] faltan modelos:', missing);
        if (typeof showNotification === 'function') showNotification('MODELOS', 'Faltan: ' + missing.join(', ') + ' · se usarán reemplazos');
        return false;
    }
    console.info('[models] verificación OK: monster/key/coal/pan/escondite');
    return true;
}

function bootGame() {
    verifyRequiredModels();
    if (typeof Materials !== 'undefined' && Materials.loadAll) {
        Materials.loadAll(function (textures) {
            gameTextures = textures || { wall: null, floor: null, hide: null };
            console.info('[game] texturas cargadas', {
                wall: !!gameTextures.wall,
                floor: !!gameTextures.floor,
                hide: !!gameTextures.hide
            });
            applyAllTextures();
            startGameWithTextures();
        });
    } else {
        console.warn('[game] Materials no disponible, mundo sin texturas');
        startGameWithTextures();
    }
}

if (typeof ModelLibrary !== 'undefined' && ModelLibrary.loadAll) {
    ModelLibrary.loadAll(function () {
        bootGame();
    });
} else {
    console.warn('[game] ModelLibrary no disponible');
    bootGame();
}


/* =========================================================
   ANIMACIÓN
========================================================= */

let previousTime =
    performance.now();


function animate(){

    requestAnimationFrame(
        animate
    );


    const currentTime =
        performance.now();


    const delta =
        Math.min(

            (
                currentTime-
                previousTime
            )/
            1000,

            .1

        );


    previousTime =
        currentTime;

    // Solo congelar en pausa (no bloquear movimiento si el menú falló al cerrarse)
    if (typeof gamePaused !== 'undefined' && gamePaused) {
        renderer.render(scene, camera);
        return;
    }
    // Si aún no se pulsó Entrar, no procesar monstruos/ítems agresivos, pero sí permitir
    // que al cerrar el menú todo fluya. Si gameStarted es false y hay menú visible, no mover.
    const startEl = document.getElementById('start-menu');
    const startVisible = startEl && startEl.classList.contains('visible');
    if (startVisible) {
        renderer.render(scene, camera);
        return;
    }
    // Asegurar flag
    if (typeof gameStarted !== 'undefined' && !gameStarted && !startVisible) {
        gameStarted = true;
    }


    /*
     * =====================================================
     * OBJETOS
     * =====================================================
     */

    // Ítems en el suelo: sin rotación ni flotación (modelos GLB quietos)

    // Partículas doradas de Magic Keys
    collectibleObjects.forEach(obj => {
        if (obj.collected || !obj.particles) return;
        const pos = obj.particles.geometry.attributes.position;
        const speeds = obj.particles.userData.speeds;
        for (let i = 0; i < pos.count; i++) {
            let y = pos.getY(i) + speeds[i] * delta;
            if (y > 0.55) y = 0;
            pos.setY(i, y);
            // ligera deriva
            pos.setX(i, pos.getX(i) * 0.99 + (Math.random() - 0.5) * 0.01);
            pos.setZ(i, pos.getZ(i) * 0.99 + (Math.random() - 0.5) * 0.01);
        }
        pos.needsUpdate = true;
    });




    /*
     * =====================================================
     * RECOLECCIÓN DE ÍTEM
     * =====================================================
     */

    if(
        collectingItem
    ){

        const distance =
            Math.hypot(

                yawObject.position.x-
                collectingItem.x,

                yawObject.position.z-
                collectingItem.z

            );


        if(
            distance>2.6 ||
            isHidden ||
            isFlying
        ){

            cancelCollecting();

        }
        else{

            const elapsed =
                performance.now()-
                collectStartTime;

            setCollectBarProgress(elapsed / ITEM_COLLECT_TIME);

            if(
                elapsed>=
                ITEM_COLLECT_TIME
            ){

                finishCollecting();
            }
        }
    }


    /*
     * =====================================================
     * RECOLECCIÓN carbón
     * =====================================================
     */

    if(
        collectingBattery
    ){

        const distance =
            Math.hypot(

                yawObject.position.x-
                collectingBattery.x,

                yawObject.position.z-
                collectingBattery.z

            );


        if(
            distance>2.6 ||
            isHidden ||
            isFlying
        ){

            cancelCollecting();

        }
        else{

            const elapsed =
                performance.now()-
                batteryCollectStart;

            setCollectBarProgress(elapsed / BATTERY_COLLECT_TIME);

            if(
                elapsed>=
                BATTERY_COLLECT_TIME
            ){

                finishBatteryCollection();
            }
        }
    }


    /*
     * =====================================================
     * RECOLECCIÓN CHOCOLATE (3s)
     * =====================================================
     */

    if (collectingPan) {
        const distance = Math.hypot(
            yawObject.position.x - collectingPan.x,
            yawObject.position.z - collectingPan.z
        );

        if (distance > 2.6 || isHidden || isFlying) {
            cancelCollecting();
        } else {
            const elapsed = performance.now() - chocolateCollectStart;
            setCollectBarProgress(elapsed / CHOCOLATE_COLLECT_TIME);
            if (elapsed >= CHOCOLATE_COLLECT_TIME) {
                finishPanCollection();
            }
        }
    }


    /*
     * =====================================================
     * PROMPT
     * =====================================================
     */

    if(
        !collectingItem &&
        !collectingBattery &&
        !collectingPan
    ){

        let nearItem=false;

        let nearBattery=false;

        let nearPan=false;


        if(
            !isHidden &&
            !isFlying
        ){

            for(
                const item
                of collectibleObjects
            ){

                if(
                    item.collected
                )
                    continue;


                if(
                    Math.hypot(

                        yawObject.position.x-
                        item.x,

                        yawObject.position.z-
                        item.z

                    )<1.2
                ){

                    nearItem=true;

                    break;
                }
            }


            if(!nearItem){

                for(
                    const battery
                    of batteryObjects
                ){

                    if(
                        battery.collected
                    )
                        continue;


                    if(
                        Math.hypot(

                            yawObject.position.x-
                            battery.x,

                            yawObject.position.z-
                            battery.z

                        )<1.2
                    ){

                        nearBattery=true;

                        break;
                    }
                }
            }

            if (!nearItem && !nearBattery) {
                for (const choco of chocolateObjects) {
                    if (choco.collected) continue;
                    if (
                        Math.hypot(
                            yawObject.position.x - choco.x,
                            yawObject.position.z - choco.z
                        ) < 1.2
                    ) {
                        nearPan = true;
                        break;
                    }
                }
            }
        }


        if (nearItem) {
            showPrompt('Magic Key', false);
        } else if (nearBattery) {
            showPrompt('Carbón', false);
        } else if (nearPan) {
            showPrompt('Pan', false);
        } else if (!isHidden) {
            hidePrompt();
        }
    }



    /*
     * =====================================================
     * MOVIMIENTO PLAYER
     * =====================================================
     */

    if(
        !isHidden
    ){

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yawObject.rotation.y
        );
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yawObject.rotation.y
        );


        const moveDirection =
            new THREE.Vector3();


        if(
            moveForward
        )
            moveDirection.add(
                forward
            );


        if(
            moveBackward
        )
            moveDirection.sub(
                forward
            );


        if(
            moveRight
        )
            moveDirection.add(
                right
            );


        if(
            moveLeft
        )
            moveDirection.sub(
                right
            );


        if(
            moveDirection.lengthSq()>0
        )
            moveDirection.normalize();


        if (!isDead && !(typeof window !== 'undefined' && window.__falaciaBlock)) {
        // Estamina: correr drena, reposo regenera
        const wantsRun = isRunning && !isFlying && !isHidden;
        const canRun = wantsRun && stamina > 0;

        if (canRun && moveDirection.lengthSq() > 0) {
            stamina = Math.max(0, stamina - STAMINA_DRAIN_RATE * delta);
        } else if (!isHidden) {
            stamina = Math.min(MAX_STAMINA, stamina + STAMINA_REGEN_RATE * delta);
        }
        updateStaminaUI();

        if (wantsRun && !canRun && modeText) {
            if (modeText) modeText.textContent = isFlying ? 'Volar' : 'Caminar';
        }

        const speed =
            isFlying
                ?CONFIG.flySpeed
                :(
                    canRun
                        ?CONFIG.runSpeed
                        :CONFIG.walkSpeed
                );


        const movement =
            moveDirection.multiplyScalar(
                speed*
                delta
            );


        if(
            isFlying
        ){

            yawObject.position.add(
                movement
            );


            if(
                moveUp
            )
                yawObject.position.y +=
                    speed*
                    delta;


            if(
                moveDown
            )
                yawObject.position.y -=
                    speed*
                    delta;

        }
        else{

            const nextX =
                yawObject.position.clone();


            nextX.x +=
                movement.x;


            if(
                !checkCollision(
                    nextX
                )
            ){

                yawObject.position.x =
                    nextX.x;
            }


            const nextZ =
                yawObject.position.clone();


            nextZ.z +=
                movement.z;


            if(
                !checkCollision(
                    nextZ
                )
            ){

                yawObject.position.z =
                    nextZ.z;
            }


            // Gravedad y salto
            velocityY -= GRAVITY * delta;
            yawObject.position.y += velocityY * delta;
            if (yawObject.position.y <= 0) {
                yawObject.position.y = 0;
                velocityY = 0;
            }
        }
        } // fin if (!isDead)
    }


    /*
     * =====================================================
     * LINTERNA
     * =====================================================
     */

    updateFlashlightBattery(
        delta
    );


    /*
     * =====================================================
     * 3 MONSTRUOS
     * =====================================================
     */

    const mpCoop = typeof Multiplayer !== 'undefined' && Multiplayer.isConnected();
    if (!mpCoop || Multiplayer.isHost) {
        const extraTargets = [];
        if (mpCoop && Multiplayer.remotePlayers) {
            Object.values(Multiplayer.remotePlayers).forEach(rp => {
                if (rp && rp.mesh) extraTargets.push({
                    pos: rp.mesh.position,
                    hidden: !!rp.hidden,
                    flying: false,
                    flashlightActive: !!rp.flashlightActive,
                    battery: Number.isFinite(Number(rp.battery)) ? Number(rp.battery) : (rp.flashlightActive ? 1 : 0),
                    yaw: Number.isFinite(Number(rp.yaw)) ? Number(rp.yaw) : 0,
                    id: rp.name || 'remote'
                });
            });
        }

        for(
            const monster
            of monsterAIs
        ){
            const allCollected =
                totalItemsCount > 0 &&
                score >= totalItemsCount;

            const caught =
                monster.update(
                    delta,
                    yawObject.position,
                    isHidden,
                    isFlying,
                    flashlightOn && batteryPhasesCount > 0,
                    allCollected,
                    extraTargets
                );

            if(
                caught &&
                !isDead &&
                !deathSequenceActive
            ){
                startDeathSequence(monster);
                break;
            }
        }
    } else {
        // El host mueve los monstruos; el cliente solo interpola/recibe sus
        // posiciones para que ambos vean exactamente la misma persecución.
        for (const monster of monsterAIs) {
            if (!monster.mesh || isDead || deathSequenceActive) continue;
            if (monster.mixer) monster.mixer.update(delta);
            if (typeof monster._updateBlackParticles === 'function') monster._updateBlackParticles(delta);
            const d = Math.hypot(
                yawObject.position.x - monster.mesh.position.x,
                yawObject.position.z - monster.mesh.position.z
            );
            if (d < 1.15) {
                startDeathSequence(monster);
                break;
            }
        }
    }

    // Secuencia de muerte / screamer
    if (deathSequenceActive) {
        updateDeathSequence(delta);
    }

    // Pulsos rojos de advertencia si un monstruo activo está cerca
    {
        let nearest = Infinity;
        if (!isHidden && !isFlying && !isDead) {
            for (const monster of monsterAIs) {
                if (!monster.mesh) continue;
                // Si está paralizado, no cuenta para la alerta
                if (monster.stunnedTimer > 0) continue;
                const d = Math.hypot(
                    yawObject.position.x - monster.mesh.position.x,
                    yawObject.position.z - monster.mesh.position.z
                );
                if (d < nearest) nearest = d;
            }
        }
        // help = más lejos que el latido; palpito = radio de peligro
        const pulseR = CONFIG.dangerPulseRange;
        const helpR = pulseR * 2.35; // antes de la persecución visual de latidos

        if (dangerPulse) {
            if (nearest < pulseR) {
                dangerPulse.classList.add('active');
                const intensity = Math.max(0.2, 1 - nearest / pulseR);
                dangerPulse.style.animationDuration = (0.55 - intensity * 0.28) + 's';
                GameMusic.setDangerNear(true);
                GameMusic.setHelpNear(false);
            } else {
                dangerPulse.classList.remove('active');
                dangerPulse.style.opacity = '0';
                GameMusic.setDangerNear(false);
                // Zona intermedia: monstruo cerca pero aún no latidos
                GameMusic.setHelpNear(nearest < helpR);
            }
        } else {
            GameMusic.setDangerNear(false);
            GameMusic.setHelpNear(false);
        }

        // Gritos / voces esporádicas
        GameMusic.updateAmbientScares(delta);
    }


    /*
     * =====================================================
     * SALIDA
     * =====================================================
     */

    const gridX =
        Math.round(
            yawObject.position.x/
            blockSize
        );


    const gridZ =
        Math.round(
            yawObject.position.z/
            blockSize
        );


    if(
        exitCoord &&
        gridZ>=0 &&
        gridZ<mapRows &&
        gridX>=0 &&
        gridX<mapCols &&
        gridZ === exitCoord.z &&
        gridX === exitCoord.x &&
        score >= totalItemsCount &&
        totalItemsCount > 0
    ){

        if (typeof Multiplayer !== 'undefined' && Multiplayer.isConnected()) {
            if (Multiplayer.isHost) {
                generateAndBuildWorld(true);
                Multiplayer.broadcastWorldLevel();
            } else {
                Multiplayer.requestNextLevel();
            }
        } else {
            generateAndBuildWorld(true);
        }
    }


    /*
     * =====================================================
     * RADAR → apunta a la salida
     * =====================================================
     */

    if (
        radarContainer &&
        radarArrow &&
        radarContainer.classList.contains('visible') &&
        exitCoord
    ) {
        const exitWorldX = exitCoord.x * blockSize;
        const exitWorldZ = exitCoord.z * blockSize;

        const dx = exitWorldX - yawObject.position.x;
        const dz = exitWorldZ - yawObject.position.z;

        // Ángulo hacia la salida en el plano XZ (Three.js: atan2(x,z))
        const worldAngle = Math.atan2(dx, dz);
        // Relativo a donde mira el jugador → 0 = delante
        let relative = worldAngle - yawObject.rotation.y;
        // Normalizar -PI..PI
        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;
        const deg = (relative * 180) / Math.PI;
        // Flecha CSS apunta hacia ARRIBA (norte de la UI) = delante del jugador
        if (radarArrow) radarArrow.style.transform = `rotate(${deg}deg)`;
        // Disco de brújula: gira en sentido contrario al yaw para marcar el norte del mundo
        const compass = document.getElementById('compass-img');
        if (compass) {
            const yawDeg = (-yawObject.rotation.y * 180) / Math.PI;
            compass.style.transform = `rotate(${yawDeg}deg)`;
        }
    }


    // Portal animation
    if (portalMixer) {
        portalMixer.update(delta);
    }

    /*
     * =====================================================
     * RENDER
     * =====================================================
     */

    // En cooperativo el cuerpo lógico del jugador permanece en el suelo.
    if (!isFlying && typeof yawObject !== 'undefined' && yawObject.position.y < 0.001) yawObject.position.y = 0;
    if (typeof Multiplayer !== 'undefined') Multiplayer.update();

    renderer.render(scene, camera);
}



/* =========================================================
   MENÚS: inicio + pausa (ESC)
========================================================= */
let gameStarted = false;
let gamePaused = false;

function openStartMenu() {
    const el = document.getElementById('start-menu');
    if (el) el.classList.add('visible');
    gameStarted = false;
    gamePaused = false;
}

function closeStartMenu() {
    const el = document.getElementById('start-menu');
    if (el) el.classList.remove('visible');
    gameStarted = true;
    gamePaused = false;
    if (typeof enterGameLock === 'function') enterGameLock();
}

function openPauseMenu() {
    if (!gameStarted || isDead) return;
    gamePaused = true;
    const el = document.getElementById('pause-menu');
    if (el) el.classList.add('visible');
    try { document.exitPointerLock(); } catch (e) {}
}

function closePauseMenu() {
    gamePaused = false;
    const el = document.getElementById('pause-menu');
    if (el) el.classList.remove('visible');
    if (typeof enterGameLock === 'function') enterGameLock();
}

function exitToDesktop() {
    try { document.exitPointerLock(); } catch (e) {}
    try {
        if (document.fullscreenElement) document.exitFullscreen();
    } catch (e) {}
    gamePaused = false;
    // Forzar navegación al menú
    window.location.assign('index.html');
}

document.addEventListener('DOMContentLoaded', () => {
    // Entrada desde index.html → partida lista
    gameStarted = true;
    gamePaused = false;
    const sm = document.getElementById('start-menu');
    if (sm) sm.classList.remove('visible');

    if (typeof Multiplayer !== 'undefined') {
        try { Multiplayer.start(); } catch (err) { console.error('[MP]', err); }
    }

    const btnContinue = document.getElementById('btn-continue');
    const btnQuit = document.getElementById('btn-quit');
    const btnPauseRestart = document.getElementById('btn-pause-restart');
    if (btnContinue) {
        btnContinue.addEventListener('click', (ev) => {
            ev.preventDefault();
            closePauseMenu();
        });
    }
    if (btnPauseRestart) {
        btnPauseRestart.addEventListener('click', (ev) => {
            ev.preventDefault();
            closePauseMenu();
            if (typeof restartFromDeath === 'function') restartFromDeath();
            else if (typeof generateAndBuildWorld === 'function') generateAndBuildWorld(false);
        });
    }
    if (btnQuit) {
        btnQuit.addEventListener('click', (ev) => {
            ev.preventDefault();
            exitToDesktop();
        });
    }
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
        btnMute.addEventListener('click', (ev) => {
            ev.preventDefault();
            GameMusic.toggleMute();
        });
        btnMute.textContent = GameMusic.muted ? 'Sonido: OFF' : 'Sonido: ON';
    }
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', (ev) => {
            ev.preventDefault();
            SaveGame.downloadFile();
        });
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyQ') {
        e.preventDefault();
        if (!gameStarted) return;
        if (isDead) return;
        if (gamePaused) closePauseMenu();
        else openPauseMenu();
    }
});

// Pausar lógica si gamePaused: hook al inicio de animate

// Alt+Z: activar/desactivar modo educativo de falacias (captura temprana)
document.addEventListener('keydown', function paralogismoAltZ(ev) {
    if (!ev.altKey) return;
    const isZ = ev.code === 'KeyZ' || (ev.key && ev.key.toLowerCase() === 'z');
    if (!isZ) return;
    if (typeof Multiplayer !== 'undefined' && Multiplayer.enabled && !Multiplayer.isHost) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof FalaciaQuiz !== 'undefined') FalaciaQuiz.toggle();
}, true);

animate();

// Intentar bloquear al cargar (algunos navegadores lo permiten tras gesto previo)
window.addEventListener('load', () => {
    // Primer gesto del usuario activará fullscreen de forma fiable
});
document.addEventListener('pointerdown', (e) => {
    if (isDead) return;
    if (typeof gamePaused !== 'undefined' && gamePaused) return;
    const t = e.target;
    if (t && t.closest && (t.closest('#pause-menu') || t.closest('#death-overlay') || t.closest('button') || t.closest('a'))) return;
    enterGameLock();
});


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    'resize',
    () => {

        camera.aspect =
            window.innerWidth/
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );
    }
);