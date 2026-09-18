/**
 * PARALOGISMO-scaperun — Multijugador (PeerJS)
 *
 * Host crea sala → código de 6 letras
 * Otros se unen con el código
 * Se sincronizan: posición, rotación Y, nombre, nivel
 *
 * Usa el broker público de PeerJS (sin servidor propio).
 * Para producción conviene un PeerServer propio.
 */
const Multiplayer = {
  enabled: false,
  isHost: false,
  peer: null,
  peerId: null,
  roomCode: null,
  connections: [], // host: data connections to clients
  hostConn: null,  // client: connection to host
  remotePlayers: {}, // id -> { mesh, name, yaw }
  myName: 'Jugador',
  _lastSend: 0,
  SEND_HZ: 12,
  MONSTER_HZ: 20,
  _lastMonsterSend: 0,
  _monsterTargets: {},
  _pendingKey: false,
  _lastKeyBroadcast: 0,
  _lastResourceBroadcast: 0,
  _copyShortcutBound: false,

  isConnected() {
    return this.enabled && (this.isHost ? !!this.peer : !!this.hostConn);
  },

  isActive() {
    return this.enabled && (this.isHost ? this.connections.length >= 0 : !!this.hostConn);
  },

  /** Lee flags desde sessionStorage (puestos por index.html) */
  readSession() {
    try {
      const mode = sessionStorage.getItem('paralogismo_mp_mode'); // 'host' | 'join' | null
      const code = sessionStorage.getItem('paralogismo_mp_code');
      const name = sessionStorage.getItem('paralogismo_mp_name');
      if (name) this.myName = String(name).slice(0, 16);
      if (mode === 'host' || mode === 'join') {
        this.enabled = true;
        this.isHost = mode === 'host';
        this.roomCode = code || null;
      }
    } catch (e) {}
  },

  _loadPeerJS(cb) {
    if (typeof Peer !== 'undefined') {
      cb();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => cb();
    s.onerror = () => {
      console.error('[MP] No se pudo cargar PeerJS');
      if (typeof showNotification === 'function') {
        showNotification('MULTIJUGADOR', 'Error cargando PeerJS');
      }
    };
    document.head.appendChild(s);
  },

  start() {
    this.readSession();
    if (!this.enabled) return;
    this._bindPageExitDisconnect();
    this._loadPeerJS(() => {
      if (this.isHost) this._startHost();
      else this._startClient();
    });
  },

  _makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += chars[(Math.random() * chars.length) | 0];
    return c;
  },

  _startHost() {
    this.roomCode = this.roomCode || this._makeRoomCode();
    // Peer id = room code so clients can dial it
    this.peer = new Peer('para-' + this.roomCode, {
      debug: 1
    });
    this.peer.on('open', (id) => {
      this.peerId = id;
      console.info('[MP] Host sala', this.roomCode, id);
      if (typeof showNotification === 'function') {
        showNotification('SALA CREADA', 'Código: ' + this.roomCode + ' · Compártelo');
      }
      this._showRoomHud();
      this._bindCopyRoomShortcut();
    });
    this.peer.on('connection', (conn) => {
      this._setupConn(conn, true);
    });
    this.peer.on('error', (err) => {
      console.error('[MP] host error', err);
      // Si el id está ocupado, generar otro
      if (String(err).includes('taken') || (err && err.type === 'unavailable-id')) {
        this.roomCode = this._makeRoomCode();
        try { this.peer.destroy(); } catch (e) {}
        this._startHost();
      }
    });
  },

  _startClient() {
    if (!this.roomCode) {
      if (typeof showNotification === 'function') {
        showNotification('MULTIJUGADOR', 'Falta código de sala');
      }
      return;
    }
    this.peer = new Peer({ debug: 1 });
    this.peer.on('open', () => {
      const hostId = 'para-' + this.roomCode.toUpperCase();
      console.info('[MP] Conectando a', hostId);
      const conn = this.peer.connect(hostId, { reliable: true });
      this._setupConn(conn, false);
    });
    this.peer.on('error', (err) => {
      console.error('[MP] client error', err);
      if (typeof showNotification === 'function') {
        showNotification('MULTIJUGADOR', 'No se pudo unir · Revisa el código');
      }
    });
  },

  _setupConn(conn, fromHost) {
    conn.on('open', () => {
      if (fromHost) {
        this.connections.push(conn);
        // Enviar saludo / estado inicial
        conn.send({
          t: 'welcome',
          level: typeof currentLevel !== 'undefined' ? currentLevel : 1,
          seed: typeof worldSeed !== 'undefined' ? worldSeed : 0,
          score: typeof score !== 'undefined' ? score : 0,
          resources: this._resourceState(),
          snapshot: this._worldSnapshot()
        });
        setTimeout(() => this._sendWorldState(conn), 100);
        if (typeof showNotification === 'function') {
          showNotification('JUGADOR CONECTADO', 'Hay ' + this.connections.length + ' invitado(s)');
        }
      } else {
        this.hostConn = conn;
        conn.send({ t: 'hello', name: this.myName, modelReady: !!(typeof ModelLibrary !== 'undefined' && ModelLibrary.ready && ModelLibrary.templates && ModelLibrary.templates.monster) });
        if (typeof showNotification === 'function') {
          showNotification('CONECTADO', 'Sala ' + this.roomCode);
        }
        this._showRoomHud();
        this._bindCopyRoomShortcut();
      }
    });
    conn.on('data', (data) => this._onData(conn, data));
    conn.on('close', () => {
      if (fromHost) {
        this.connections = this.connections.filter((c) => c !== conn);
        this._removeRemote(conn.peer);
      } else {
        this.hostConn = null;
        if (typeof showNotification === 'function') {
          showNotification('DESCONECTADO', 'Se perdió el host');
        }
      }
    });
  },

  _onData(conn, data) {
    if (!data || !data.t) return;
    if (data.t === 'hello' && this.isHost) {
      conn.playerName = data.name || 'Invitado';
      conn.modelReady = !!data.modelReady;
      if (!conn.modelReady && typeof showNotification === 'function') showNotification('MODELO', 'El jugador está cargando los modelos');
      return;
    }
    if (data.t === 'leave' && this.isHost) {
      this.connections = this.connections.filter(c => c !== conn);
      this._removeRemote(conn.peer);
      try { conn.close(); } catch (e) {}
      if (typeof showNotification === 'function') showNotification('JUGADOR SALIÓ', (conn.playerName || 'Jugador') + ' se desconectó');
      return;
    }
    if (data.t === 'state') {
      this._upsertRemote(data);
      // El HOST comprueba también la linterna remota inmediatamente, sin
      // depender de que el cliente calcule bien la posición interpolada.
      if (this.isHost && data.flashlightActive && !data.hidden && !data.flying) {
        this._tryRemoteFlashlightStun(data);
      }
      return;
    }
    if (data.t === 'resetRequest' && this.isHost) {
      if (typeof generateAndBuildWorld === 'function') {
        generateAndBuildWorld(false, true, true);
        this.broadcastWorldLevel(true);
        if (typeof showNotification === 'function') showNotification('PARTIDA REINICIADA', 'Mismo mapa · recursos restaurados · portal bloqueado');
      }
      return;
    }
    if (data.t === 'stunRequest' && this.isHost) {
      // El cliente puede solicitar un stun, pero el HOST valida la geometría
      // y aplica el efecto de forma autoritativa.
      const ok = this._tryRemoteFlashlightStun(data);
      if (ok) this._broadcastMonsterNow();
      return;
    }
    if (data.t === 'keyState' && !this.isHost) {
      this._applyResourceState(data.resources || { keys: data.keys || [] });
      if (Number.isFinite(Number(data.score)) && typeof score !== 'undefined') {
        score = Math.max(0, Number(data.score) | 0);
        if (typeof updateHUDUI === 'function') updateHUDUI();
      }
      return;
    }
    if (data.t === 'welcome' && !this.isHost) {
      const level = Math.max(1, Number(data.level) || 1);
      const seed = Number(data.seed) >>> 0;
      if (seed) { window.__paralogismoAuthoritativeSeed = seed; worldSeed = seed; }
      if (typeof currentLevel !== 'undefined') currentLevel = level;
      if (data.snapshot) window.__paralogismoWorldSnapshot = data.snapshot;
      this.resetMonsterSync();
      if (typeof generateAndBuildWorld === 'function') generateAndBuildWorld(false);
      if (typeof applyAllTextures === 'function') applyAllTextures();
      this._applyResourceState(data.resources || { keys: data.keys || [] });
      if (Number.isFinite(Number(data.score)) && typeof score !== 'undefined') score = Math.max(0, Number(data.score) | 0);
      if (typeof updateHUDUI === 'function') updateHUDUI();
      return;
    }
    if (data.t === 'world' && !this.isHost) {
      const level = Math.max(1, Number(data.level) || 1);
      const seed = Number(data.seed) >>> 0;
      if (seed) { window.__paralogismoAuthoritativeSeed = seed; worldSeed = seed; }
      if (typeof currentLevel !== 'undefined') currentLevel = level;
      if (data.snapshot) window.__paralogismoWorldSnapshot = data.snapshot;
      this.resetMonsterSync();
      if (typeof generateAndBuildWorld === 'function') generateAndBuildWorld(false);
      if (typeof applyAllTextures === 'function') applyAllTextures();
      this._applyResourceState(data.resources || { keys: data.keys || [] });
      if (Number.isFinite(Number(data.score)) && typeof score !== 'undefined') score = Math.max(0, Number(data.score) | 0);
      if (typeof updateHUDUI === 'function') updateHUDUI();
      return;
    }
    if (data.t === 'keyRequest' && this.isHost) {
      this._hostCollectKey(Number(data.index));
      return;
    }
    if (data.t === 'resourceRequest' && this.isHost) {
      this._hostCollectResource(String(data.type), Number(data.index), conn);
      return;
    }
    if (data.t === 'resourceState') {
      this._applyResourceState(data.state || {});
      if (Number.isFinite(Number(data.score)) && typeof score !== 'undefined') {
        score = Math.max(0, Number(data.score) | 0);
        if (typeof updateHUDUI === 'function') updateHUDUI();
      }
      return;
    }
    if (data.t === 'resourceGranted' && !this.isHost) {
      this._applyGrantedResource(String(data.type));
      return;
    }
    if (data.t === 'nextLevel' && this.isHost) {
      if (typeof generateAndBuildWorld === 'function') {
        generateAndBuildWorld(true);
        this.broadcastWorldLevel();
      }
      return;
    }
    if (data.t === 'monsterState' && !this.isHost) {
      this._applyMonsterState(data.monsters || []);
      return;
    }
  },

  _tryRemoteFlashlightStun(data) {
    if (!this.isHost || !data || !data.flashlightActive || data.hidden) return false;
    if (typeof monsterAIs === 'undefined') return false;
    const px = Number(data.x), pz = Number(data.z);
    const yaw = Number(data.yaw);
    if (!Number.isFinite(px) || !Number.isFinite(pz) || !Number.isFinite(yaw)) return false;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let stunned = false;
    for (const ai of monsterAIs) {
      if (!ai || !ai.mesh || (ai.stunnedTimer || 0) > 0 || (ai.stunCooldownTimer || 0) > 0) continue;
      const dx = ai.mesh.position.x - px, dz = ai.mesh.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.01 || dist > 10.5) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot >= 0.30 && typeof ai.stun === 'function') {
        const result = ai.stun();
        if (result !== false) stunned = true;
      }
    }
    return stunned;
  },

  _broadcastMonsterNow() {
    if (!this.isHost || typeof monsterAIs === 'undefined') return;
    const monsters = monsterAIs.map(ai => ({
      x: ai.mesh ? ai.mesh.position.x : 0, y: ai.mesh ? ai.mesh.position.y : 0, z: ai.mesh ? ai.mesh.position.z : 0,
      ry: ai.mesh ? ai.mesh.rotation.y : 0, stunned: !!(ai && ai.stunnedTimer > 0),
      stunRemaining: ai && Number.isFinite(ai.stunnedTimer) ? Math.max(0, ai.stunnedTimer) : 0,
      targetId: ai && ai.currentTargetId ? ai.currentTargetId : null
    }));
    this.broadcast({ t: 'monsterState', monsters });
  },

  resetMonsterSync() { this._monsterTargets = {}; },

  _keyState() {
    if (typeof collectibleObjects === 'undefined') return [];
    return collectibleObjects.map(k => ({ collected: !!k.collected, x: k.x, z: k.z }));
  },

  _resourceState() {
    const arr = (typeof batteryObjects !== 'undefined' ? batteryObjects : []);
    const pan = (typeof chocolateObjects !== 'undefined' ? chocolateObjects : []);
    return {
      keys: this._keyState(),
      batteries: arr.map(o => ({ collected: !!o.collected, x: o.x, z: o.z })),
      pans: pan.map(o => ({ collected: !!o.collected, x: o.x, z: o.z }))
    };
  },

  _removeObjectMesh(o) {
    if (!o) return;
    if (o.mesh && typeof scene !== 'undefined') scene.remove(o.mesh);
    if (o.particles && typeof scene !== 'undefined') { scene.remove(o.particles); o.particles = null; }
  },

  _applyResourceState(state) {
    if (!state) return;
    this._applyKeyState(state.keys || []);
    const apply = (list, values) => {
      if (!Array.isArray(list) || !Array.isArray(values)) return;
      for (let i = 0; i < list.length; i++) {
        const o = list[i], v = values[i];
        if (!o || !v) continue;
        if (Number.isFinite(v.x)) o.x = v.x;
        if (Number.isFinite(v.z)) o.z = v.z;
        if (v.collected) {
          o.collected = true;
          this._removeObjectMesh(o);
        } else if (!o.collected) {
          o.collected = false;
          if (o.mesh) o.mesh.position.set(o.x, o.mesh.position.y, o.z);
          if (o.particles) o.particles.position.set(o.x, o.particles.position.y, o.z);
        }
      }
    };
    apply(typeof batteryObjects !== 'undefined' ? batteryObjects : [], state.batteries);
    apply(typeof chocolateObjects !== 'undefined' ? chocolateObjects : [], state.pans);
  },

  _applyKeyState(keys) {
    if (typeof collectibleObjects === 'undefined') return;
    for (let i = 0; i < collectibleObjects.length; i++) {
      const k = collectibleObjects[i];
      const raw = keys[i];
      const shouldBeCollected = typeof raw === 'object' ? !!raw.collected : !!raw;
      if (raw && typeof raw === 'object' && !shouldBeCollected) {
        if (Number.isFinite(raw.x)) k.x = raw.x;
        if (Number.isFinite(raw.z)) k.z = raw.z;
        if (k.mesh) k.mesh.position.set(k.x, k.mesh.position.y, k.z);
        if (k.particles) k.particles.position.set(k.x, k.particles.position.y, k.z);
      }
      if (shouldBeCollected && !k.collected) {
        k.collected = true;
        if (k.mesh) scene.remove(k.mesh);
        if (k.particles) { scene.remove(k.particles); k.particles = null; }
      }
    }
    const n = keys.filter(k => typeof k === 'object' ? !!k.collected : !!k).length;
    if (typeof score !== 'undefined') score = n;
    if (typeof updateHUDUI === 'function') updateHUDUI();
  },

  _hostCollectKey(index) {
    if (!this.isHost || !Number.isInteger(index)) return;
    if (typeof collectibleObjects === 'undefined' || !collectibleObjects[index]) return;
    const key = collectibleObjects[index];
    if (key.collected) {
      this.broadcast({ t: 'resourceState', state: this._resourceState(), score: score || 0 });
      return;
    }
    key.collected = true;
    if (key.mesh) scene.remove(key.mesh);
    if (key.particles) { scene.remove(key.particles); key.particles = null; }
    if (typeof score !== 'undefined') score = Math.min(totalItemsCount || collectibleObjects.length, score + 1);
    if (typeof updateHUDUI === 'function') updateHUDUI();
    this.broadcast({ t: 'resourceState', state: this._resourceState(), score: score });
  },

  _hostCollectResource(type, index, requesterConn = null) {
    if (!this.isHost || !Number.isInteger(index)) return false;
    const list = type === 'battery' ? (typeof batteryObjects !== 'undefined' ? batteryObjects : []) :
                 type === 'pan' ? (typeof chocolateObjects !== 'undefined' ? chocolateObjects : []) : null;
    if (!list || !list[index]) return false;
    const obj = list[index];
    if (obj.collected) {
      this.broadcast({ t: 'resourceState', state: this._resourceState() });
      return true;
    }
    obj.collected = true;
    this._removeObjectMesh(obj);
    this.broadcast({ t: 'resourceState', state: this._resourceState() });
    if (requesterConn && requesterConn.open) requesterConn.send({ t: 'resourceGranted', type, index });
    return true;
  },

  requestResource(type, index) {
    if (!this.isConnected() || !Number.isInteger(index)) return false;
    if (this.isHost) return this._hostCollectResource(type, index, null);
    if (this.hostConn && this.hostConn.open) {
      // Ocultación inmediata en el cliente: el host sigue siendo la autoridad.
      // El siguiente resourceState del host confirma o corrige este estado.
      const list = type === 'battery' ? (typeof batteryObjects !== 'undefined' ? batteryObjects : []) :
                   type === 'pan' ? (typeof chocolateObjects !== 'undefined' ? chocolateObjects : []) : null;
      const obj = list && list[index];
      if (obj && !obj.collected) {
        obj.collected = true;
        this._removeObjectMesh(obj);
      }
      this.hostConn.send({ t: 'resourceRequest', type, index });
      return true;
    }
    return false;
  },

  _applyGrantedResource(type) {
    if (type === 'battery' && typeof batteryPhasesCount !== 'undefined') {
      batteryPhasesCount = Math.min(typeof MAX_BATTERY !== 'undefined' ? MAX_BATTERY : 5, batteryPhasesCount + 1);
      if (typeof updateBatteryUI === 'function') updateBatteryUI();
      if (typeof showNotification === 'function') showNotification('CARBÓN', `Fase recargada: ${batteryPhasesCount}/5`);
    } else if (type === 'pan' && typeof chocolateInventory !== 'undefined') {
      chocolateInventory++;
      if (typeof stamina !== 'undefined') stamina = Math.min(typeof MAX_STAMINA !== 'undefined' ? MAX_STAMINA : stamina, stamina + (typeof STAMINA_CHOCOLATE_BOOST !== 'undefined' ? STAMINA_CHOCOLATE_BOOST : 0));
      if (typeof updateStaminaUI === 'function') updateStaminaUI();
      if (typeof showNotification === 'function') showNotification('PAN', `Pan ${chocolateInventory}`);
    }
  },

  requestKey(index) {
    if (!this.isConnected()) return false;
    if (this.isHost) { this._hostCollectKey(index); return true; }
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ t: 'keyRequest', index });
      return true;
    }
    return false;
  },

  requestReset() {
    if (!this.enabled) return false;
    if (this.isHost) {
      if (typeof generateAndBuildWorld === 'function') {
        generateAndBuildWorld(false, true, true);
        this.broadcastWorldLevel(true);
      }
      return true;
    }
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ t: 'resetRequest' });
      return true;
    }
    return false;
  },

  requestNextLevel() {
    if (this.isHost) return false;
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ t: 'nextLevel' });
      return true;
    }
    return false;
  },

  broadcast(payload) {
    if (!this.isHost) return;
    this.connections.forEach(c => { if (c.open) c.send(payload); });
  },

  _worldSnapshot() {
    if (!this.isHost || typeof layoutGrid === 'undefined') return null;
    return {
      seed: typeof worldSeed !== 'undefined' ? worldSeed : 0,
      level: typeof currentLevel !== 'undefined' ? currentLevel : 1,
      layoutGrid: layoutGrid.map(row => Array.from(row)),
      startCoord: typeof startCoord !== 'undefined' && startCoord ? { x: startCoord.x, z: startCoord.z } : null,
      exitCoord: typeof exitCoord !== 'undefined' && exitCoord ? { x: exitCoord.x, z: exitCoord.z } : null,
      keys: typeof collectibleObjects !== 'undefined' ? collectibleObjects.map(o => ({ x:o.x, z:o.z, collected:!!o.collected })) : [],
      hides: typeof hideSpots !== 'undefined' ? hideSpots.map(o => ({ x:o.x, z:o.z })) : [],
      batteries: typeof batteryObjects !== 'undefined' ? batteryObjects.map(o => ({ x:o.x, z:o.z, collected:!!o.collected })) : [],
      pans: typeof chocolateObjects !== 'undefined' ? chocolateObjects.map(o => ({ x:o.x, z:o.z, collected:!!o.collected })) : [],
      monsters: typeof monsterAIs !== 'undefined' ? monsterAIs.map(ai => ({
        x: ai.mesh ? ai.mesh.position.x : 0, z: ai.mesh ? ai.mesh.position.z : 0
      })) : [],
      decor: typeof decorObjects !== 'undefined' ? decorObjects.map(o => ({
        x:o.x, z:o.z, key:o.key, rotY:o.mesh ? o.mesh.rotation.y : 0
      })) : []
    };
  },

  _sendWorldState(conn) {
    if (!this.isHost || !conn || !conn.open) return;
    const snapshot = this._worldSnapshot();
    if (typeof window !== 'undefined' && snapshot) {
      window.__paralogismoCoopWorlds = window.__paralogismoCoopWorlds || {};
      window.__paralogismoCoopBaseWorlds = window.__paralogismoCoopBaseWorlds || {};
      if (!window.__paralogismoCoopBaseWorlds[currentLevel || 1]) {
        window.__paralogismoCoopBaseWorlds[currentLevel || 1] = JSON.parse(JSON.stringify(snapshot));
      }
      window.__paralogismoCoopWorlds[currentLevel || 1] = snapshot;
    }
    conn.send({ t: 'world', level: currentLevel || 1, seed: worldSeed || 0, snapshot, resources: this._resourceState(), score: score || 0 });
  },

  broadcastWorldLevel(isReset=false) {
    if (!this.isHost) return;
    const snapshot = this._worldSnapshot();
    if (typeof window !== 'undefined' && snapshot) {
      window.__paralogismoCoopWorlds = window.__paralogismoCoopWorlds || {};
      window.__paralogismoCoopBaseWorlds = window.__paralogismoCoopBaseWorlds || {};
      if (!window.__paralogismoCoopBaseWorlds[currentLevel || 1]) {
        window.__paralogismoCoopBaseWorlds[currentLevel || 1] = JSON.parse(JSON.stringify(snapshot));
      }
      window.__paralogismoCoopWorlds[currentLevel || 1] = isReset
        ? JSON.parse(JSON.stringify(window.__paralogismoCoopBaseWorlds[currentLevel || 1]))
        : snapshot;
    }
    // En un reset el snapshot enviado DEBE estar limpio (todos los recursos).
    const sendSnapshot = isReset && typeof window !== 'undefined' && window.__paralogismoCoopBaseWorlds
      ? window.__paralogismoCoopBaseWorlds[currentLevel || 1]
      : snapshot;
    this.broadcast({ t: 'world', level: currentLevel || 1, seed: worldSeed || 0, snapshot: sendSnapshot, resources: this._resourceState(), score: score || 0, reset: !!isReset });
  },

  _applyMonsterState(monsters) {
    if (typeof monsterAIs === 'undefined') return;
    monsters.forEach((m, i) => {
      const ai = monsterAIs[i];
      if (!ai || !ai.mesh) return;
      if (!this._monsterTargets[i]) {
        this._monsterTargets[i] = {
          x: ai.mesh.position.x,
          y: ai.mesh.position.y,
          z: ai.mesh.position.z,
          ry: ai.mesh.rotation.y || 0,
          received: performance.now()
        };
      }
      const t = this._monsterTargets[i];
      if (Number.isFinite(m.x)) t.x = m.x;
      if (Number.isFinite(m.y)) t.y = m.y;
      if (Number.isFinite(m.z)) t.z = m.z;
      if (Number.isFinite(m.ry)) t.ry = m.ry;
      t.stunned = !!m.stunned;
      t.stunRemaining = Number.isFinite(m.stunRemaining) ? Math.max(0, m.stunRemaining) : 0;
      t.received = performance.now();
    });
  },

  _upsertRemote(data) {
    if (!data.id || typeof THREE === 'undefined') return;
    let rp = this.remotePlayers[data.id];
    if (!rp) {
      const group = new THREE.Group();
      group.name = 'RemotePlayer_' + data.id;

      // Avatar cooperativo compatible con Three.js r128:
      // cápsula construida con cilindro + dos medias esferas.
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5aa9ff });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.50, 16), bodyMat);
      body.position.y = 0.57;
      group.add(body);
      const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
      capTop.position.y = 0.82;
      group.add(capTop);
      const capBottom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bodyMat);
      capBottom.position.y = 0.32;
      group.add(capBottom);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 12, 8),
        new THREE.MeshLambertMaterial({ color: 0xd7e9ff })
      );
      head.position.y = 1.22;
      group.add(head);

      const visor = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 6),
        new THREE.MeshBasicMaterial({ color: 0x101820 })
      );
      visor.scale.set(1.35, 0.62, 0.35);
      visor.position.set(0, 1.24, -0.23);
      group.add(visor);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.025, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0x69d4ff })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.025;
      group.add(ring);

      const beacon = new THREE.PointLight(0x69d4ff, 0.8, 3.5);
      beacon.position.y = 1.05;
      group.add(beacon);

      // Linterna remota: sigue la orientación del avatar y solo se enciende
      // cuando el otro jugador realmente tiene la linterna activa.
      const remoteFlashlight = new THREE.SpotLight(0xffffff, 0, 13, Math.PI / 6, 0.55, 2);
      remoteFlashlight.position.set(0, 1.22, -0.22);
      const remoteFlashTarget = new THREE.Object3D();
      remoteFlashTarget.position.set(0, 1.15, -10);
      group.add(remoteFlashTarget);
      remoteFlashlight.target = remoteFlashTarget;
      group.add(remoteFlashlight);
      const remoteFlashPoint = new THREE.PointLight(0xffffff, 0, 5);
      remoteFlashPoint.position.set(0, 1.18, -0.42);
      remoteFlashPoint.userData.remoteFlashPoint = true;
      group.add(remoteFlashPoint);

      // Haz visible del farol remoto. La SpotLight ilumina el escenario y este
      // cono permite que el compañero vea físicamente hacia dónde apunta.
      const remoteBeam = new THREE.Mesh(
        new THREE.ConeGeometry(2.7, 10, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      remoteBeam.userData.remoteFlashBeam = true;
      remoteBeam.rotation.x = Math.PI / 2;
      remoteBeam.position.set(0, 1.22, -5.0);
      group.add(remoteBeam);

      // Etiqueta con nombre, siempre visible por encima del jugador.
      const canvas = document.createElement('canvas');
      canvas.width = 384; canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.roundRect(8, 8, 368, 64, 14);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((data.name || 'Jugador').slice(0, 16), 192, 51);
      const tex = new THREE.CanvasTexture(canvas);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
      spr.scale.set(2.1, 0.44, 1);
      spr.position.y = 1.85;
      group.add(spr);

      // El avatar remoto siempre nace y permanece pegado al suelo; el salto/cámara
      // del jugador local no debe hacer que el cuerpo del compañero levite.
      group.position.set(Number(data.x) || 0, -1.5, Number(data.z) || 0);
      if (typeof scene !== 'undefined') scene.add(group);
      rp = {
        mesh: group, name: data.name || 'Jugador', yaw: 0,
        target: new THREE.Vector3(group.position.x, -1.5, group.position.z),
        lastState: performance.now(), flashlightOn: false, flashlightActive: false, hidden: false
      };
      this.remotePlayers[data.id] = rp;
    }
    if (!rp.target) rp.target = new THREE.Vector3();
    rp.target.set(Number(data.x) || 0, -1.5, Number(data.z) || 0);
    rp.name = data.name || rp.name || 'Jugador';
    rp.lastState = performance.now();
    if (data.yaw != null) rp.yaw = data.yaw;
    rp.flashlightOn = !!data.flashlightOn;
    rp.flashlightActive = !!data.flashlightActive;
    rp.hidden = !!data.hidden;
    rp.battery = Number.isFinite(Number(data.battery)) ? Number(data.battery) : (rp.flashlightActive ? 1 : 0);
    if (rp.mesh) {
      rp.mesh.position.y = -1.5;
      // Cuando el compañero entra a un escondite, su avatar completo
      // (incluida la linterna y la etiqueta) deja de ser visible.
      rp.mesh.visible = !rp.hidden;
      const lights = rp.mesh.children.filter(ch => ch && ch.isSpotLight);
      lights.forEach(light => {
        light.intensity = rp.flashlightActive ? 14 : 0;
        light.distance = 18;
        light.angle = Math.PI / 5;
        light.penumbra = 0.4;
        light.decay = 1.6;
      });
      rp.mesh.children.filter(ch => ch && ch.userData && ch.userData.remoteFlashPoint).forEach(light => {
        light.intensity = rp.flashlightActive ? 1.1 : 0;
      });
      const beam = rp.mesh.children.find(ch => ch && ch.userData && ch.userData.remoteFlashBeam) || rp.mesh.children.find(ch => ch && ch.geometry && ch.geometry.type === 'ConeGeometry');
      if (beam) { beam.userData.remoteFlashBeam = true; beam.material.opacity = rp.flashlightActive && !rp.hidden ? 0.085 : 0; }
    }
  },

  _removeRemote(id) {
    const rp = this.remotePlayers[id];
    if (!rp) return;
    if (rp.mesh.parent) rp.mesh.parent.remove(rp.mesh);
    delete this.remotePlayers[id];
  },

  /** Llamar cada frame desde animate */
  update() {
    if (!this.enabled) return;
    this._requestFlashlightStuns();
    // Suavizar avatares remotos entre paquetes de red.
    const now = performance.now();
    Object.values(this.remotePlayers).forEach(rp => {
      if (!rp || !rp.mesh || !rp.target) return;
      // Si un jugador desaparece de la red durante unos segundos, no lo usamos
      // como objetivo de la IA.
      if (rp.lastState && now - rp.lastState > 2500) return;
      rp.mesh.position.lerp(rp.target, 0.32);
      rp.mesh.position.y = -1.5;
      if (rp.yaw != null) {
        let diff = rp.yaw - rp.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rp.mesh.rotation.y += diff * 0.32;
      }
    });

    // En el cliente, los monstruos son autoritativos del host y se interpolan.
    if (!this.isHost && typeof monsterAIs !== 'undefined') {
      Object.keys(this._monsterTargets).forEach((key) => {
        const ai = monsterAIs[Number(key)];
        const t = this._monsterTargets[key];
        if (!ai || !ai.mesh || !t) return;
        ai.mesh.position.x += (t.x - ai.mesh.position.x) * 0.38;
        ai.mesh.position.y += (t.y - ai.mesh.position.y) * 0.38;
        ai.mesh.position.z += (t.z - ai.mesh.position.z) * 0.38;
        if (t.stunned) {
          ai.stunnedTimer = Math.max(ai.stunnedTimer || 0, t.stunRemaining || 0);
          ai.stunCooldownTimer = Math.max(ai.stunCooldownTimer || 0, t.stunRemaining || 0);
          if (typeof ai._setEmissive === 'function') ai._setEmissive(0x000000, 0);
          if (typeof ai._startBlackParticles === 'function') ai._startBlackParticles();
        } else if ((ai.stunnedTimer || 0) > 0) {
          ai.stunnedTimer = Math.max(0, ai.stunnedTimer - 1 / 60);
          if (ai.stunnedTimer <= 0 && typeof ai._setEmissive === 'function') ai._setEmissive(0x000000, 0);
        }
        let diff = (t.ry || 0) - ai.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ai.mesh.rotation.y += diff * 0.38;
      });
    }

    if (typeof yawObject === 'undefined') return;
    if (now - this._lastSend < 1000 / this.SEND_HZ) return;
    this._lastSend = now;

    const payload = {
      t: 'state',
      id: this.peerId || (this.peer && this.peer.id) || 'local',
      name: this.myName,
      x: yawObject.position.x,
      y: 0,
      z: yawObject.position.z,
      yaw: yawObject.rotation.y,
      flashlightOn: !!(typeof flashlightOn !== 'undefined' && flashlightOn),
      hidden: !!(typeof isHidden !== 'undefined' && isHidden),
      flashlightActive: !!(typeof flashlightOn !== 'undefined' && flashlightOn && typeof batteryPhasesCount !== 'undefined' && batteryPhasesCount > 0),
      battery: (typeof batteryPhasesCount !== 'undefined' ? batteryPhasesCount : 0)
    };

    if (this.isHost) {
      if (now - this._lastResourceBroadcast >= 500) {
        this._lastResourceBroadcast = now;
        this.broadcast({ t: 'resourceState', state: this._resourceState(), score: score || 0 });
      }
      this.connections.forEach((c) => {
        if (c.open) c.send(payload);
      });
      if (now - this._lastMonsterSend >= 1000 / this.MONSTER_HZ && typeof monsterAIs !== 'undefined') {
        this._lastMonsterSend = now;
        const monsters = monsterAIs.map(ai => ({
          x: ai.mesh ? ai.mesh.position.x : 0,
          y: ai.mesh ? ai.mesh.position.y : 0,
          z: ai.mesh ? ai.mesh.position.z : 0,
          ry: ai.mesh ? ai.mesh.rotation.y : 0,
          stunned: !!(ai && ai.stunnedTimer > 0),
          stunRemaining: ai && Number.isFinite(ai.stunnedTimer) ? Math.max(0, ai.stunnedTimer) : 0,
          targetId: ai && ai.currentTargetId ? ai.currentTargetId : null
        }));
        this.broadcast({ t: 'monsterState', monsters });
      }
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(payload);
    }
  },

  /** Host reenvía estado de un cliente a los demás */
  // (ampliable: en _onData state, si isHost, broadcast)

  _requestFlashlightStuns() {
    if (!this.enabled || this.isHost || !this.hostConn || !this.hostConn.open) return;
    if (typeof flashlightOn === 'undefined' || !flashlightOn) return;
    if (typeof batteryPhasesCount !== 'undefined' && batteryPhasesCount <= 0) return;
    if (typeof yawObject === 'undefined' || !yawObject || typeof monsterAIs === 'undefined') return;
    const now = performance.now();
    if (!this._lastStunRequestByMonster) this._lastStunRequestByMonster = {};
    const fx = -Math.sin(yawObject.rotation.y), fz = -Math.cos(yawObject.rotation.y);
    for (let i = 0; i < monsterAIs.length; i++) {
      const ai = monsterAIs[i];
      if (!ai || !ai.mesh || (ai.stunnedTimer || 0) > 0) continue;
      const dx = ai.mesh.position.x - yawObject.position.x;
      const dz = ai.mesh.position.z - yawObject.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 10.5 || dist < 0.05) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot < 0.05) continue;
      if (now - (this._lastStunRequestByMonster[i] || 0) < 180) continue;
      this._lastStunRequestByMonster[i] = now;
      this.hostConn.send({
        t: 'stunRequest', index: i,
        x: yawObject.position.x, z: yawObject.position.z,
        fx, fz
      });
    }
  },

  _copyRoomCode() {
    const code = String(this.roomCode || '').trim().toUpperCase();
    if (!code) return;
    const done = () => {
      if (typeof showNotification === 'function') {
        showNotification('CÓDIGO COPIADO', 'Sala ' + code + ' copiada al portapapeles');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => {
        this._copyRoomCodeFallback(code, done);
      });
    } else {
      this._copyRoomCodeFallback(code, done);
    }
  },

  _copyRoomCodeFallback(code, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) {
      if (typeof showNotification === 'function') {
        showNotification('CÓDIGO DE SALA', code);
      }
    }
  },

  _bindCopyRoomShortcut() {
    if (this._copyShortcutBound) return;
    this._copyShortcutBound = true;
    window.addEventListener('keydown', (ev) => {
      if (!this.enabled || !this.roomCode) return;
      if (!(ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey && String(ev.key).toLowerCase() === 'p')) return;
      ev.preventDefault();
      ev.stopPropagation();
      this._copyRoomCode();
    }, true);
  },

  _showRoomHud() {
    let el = document.getElementById('mp-room-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mp-room-hud';
      el.style.cssText =
        'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:60;' +
        'background:rgba(0,0,0,.7);border:1px solid #c9a227;color:#fff;padding:6px 14px;' +
        'font:13px system-ui;border-radius:6px;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = this.isHost
      ? 'Sala ' + this.roomCode + ' (HOST) · Ctrl+P copia el código'
      : 'Sala ' + this.roomCode + ' · Ctrl+P copia el código';
  },

  _bindPageExitDisconnect() {
    if (this._pageExitBound) return;
    this._pageExitBound = true;
    const sendLeave = () => {
      try {
        if (this.isHost) {
          this.connections.forEach(c => { if (c && c.open) c.send({ t: 'leave' }); });
        } else if (this.hostConn && this.hostConn.open) {
          this.hostConn.send({ t: 'leave' });
        }
      } catch (e) {}
    };
    window.addEventListener('pagehide', sendLeave, { capture: true });
    window.addEventListener('beforeunload', sendLeave, { capture: true });
  },

  disconnect() {
    try {
      this.connections.forEach((c) => c.close());
      if (this.hostConn) this.hostConn.close();
      if (this.peer) this.peer.destroy();
    } catch (e) {}
    Object.keys(this.remotePlayers).forEach((id) => this._removeRemote(id));
    this.enabled = false;
  }
};

// Host: rebroadcast client states
const _origOnData = Multiplayer._onData.bind(Multiplayer);
Multiplayer._onData = function (conn, data) {
  _origOnData(conn, data);
  if (this.isHost && data && data.t === 'state') {
    this.connections.forEach((c) => {
      if (c !== conn && c.open) c.send(data);
    });
    // Host also shows remote
    this._upsertRemote(data);
  }
};
