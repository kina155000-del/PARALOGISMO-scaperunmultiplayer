/**
 * PARALOGISMO-scaperun — Base de preguntas sobre falacias
 * Modo educativo: se desactiva con Alt+Z
 */
const FalaciaQuiz = {
  enabled: true,
  active: false,
  timer: null,
  timeLeft: 25,
  TIME_LIMIT: 25,
  pendingResolve: null,
  mode: 'collect', // 'collect' | 'revive'
  current: null,
  usedIds: new Set(),

  // 45 preguntas — opciones [texto, índiceCorrecto]
  bank: [
    { id:1, q:'¿Qué falacia ataca a la persona en vez del argumento?', opts:['Ad hominem','Hombre de paja','Falsa causa','Generalización'], a:0, hard:false },
    { id:2, q:'Presentar una versión distorsionada del argumento ajeno se llama:', opts:['Hombre de paja','Ad populum','Pendiente resbaladiza','Falso dilema'], a:0, hard:false },
    { id:3, q:'“Todos lo hacen, entonces es correcto” es:', opts:['Ad populum','Ad verecundiam','Ad baculum','Petición de principio'], a:0, hard:false },
    { id:4, q:'Apelar a la autoridad irrelevante es:', opts:['Ad verecundiam','Ad misericordiam','Ad ignorantiam','Non sequitur'], a:0, hard:false },
    { id:5, q:'“Si no puedes probar que no existe, existe” es:', opts:['Ad ignorantiam','Falsa causa','Anfibología','Equívoco'], a:0, hard:false },
    { id:6, q:'Amenazar para imponer una conclusión es:', opts:['Ad baculum','Ad populum','Ad hominem','Hombre de paja'], a:0, hard:false },
    { id:7, q:'Apelar a la lástima para ganar el argumento es:', opts:['Ad misericordiam','Ad baculum','Falso dilema','Generalización'], a:0, hard:false },
    { id:8, q:'Suponer solo dos opciones cuando hay más es:', opts:['Falso dilema','Pendiente resbaladiza','Post hoc','Cereza picking'], a:0, hard:false },
    { id:9, q:'“Si permitimos A, terminaremos en Z catastrófico” sin pruebas es:', opts:['Pendiente resbaladiza','Falsa causa','Ad populum','Tu quoque'], a:0, hard:false },
    { id:10, q:'Confundir correlación con causalidad es:', opts:['Falsa causa / post hoc','Ad hominem','Equívoco','Anfibología'], a:0, hard:false },
    { id:11, q:'Usar una muestra insuficiente para generalizar es:', opts:['Generalización apresurada','Hombre de paja','Ad verecundiam','Non sequitur'], a:0, hard:false },
    { id:12, q:'Asumir lo que se quiere demostrar es:', opts:['Petición de principio','Ad ignorantiam','Falso dilema','Red herring'], a:0, hard:false },
    { id:13, q:'Desviar el tema a algo irrelevante es:', opts:['Red herring / pista falsa','Ad baculum','Post hoc','Tu quoque'], a:0, hard:false },
    { id:14, q:'“Tú también lo haces” para evadir la crítica es:', opts:['Tu quoque','Ad populum','Ad misericordiam','Falsa causa'], a:0, hard:false },
    { id:15, q:'Jugar con el doble sentido de una palabra es:', opts:['Equívoco','Anfibología','Ad hominem','Non sequitur'], a:0, hard:false },
    { id:16, q:'La conclusión no se sigue de las premisas. Eso es:', opts:['Non sequitur','Ad populum','Hombre de paja','Ad baculum'], a:0, hard:false },
    { id:17, q:'Elegir solo evidencias que favorecen tu tesis es:', opts:['Cherry picking','Generalización','Ad verecundiam','Falso dilema'], a:0, hard:false },
    { id:18, q:'Afirmar que algo es bueno solo por ser antiguo es:', opts:['Ad antiquitatem','Ad novitatem','Ad populum','Ad baculum'], a:0, hard:false },
    { id:19, q:'Afirmar que algo es bueno solo por ser nuevo es:', opts:['Ad novitatem','Ad antiquitatem','Ad misericordiam','Post hoc'], a:0, hard:false },
    { id:20, q:'“Después de A ocurrió B, luego A causó B” es:', opts:['Post hoc ergo propter hoc','Ad hominem','Red herring','Equívoco'], a:0, hard:false },
    { id:21, q:'¿Cuál NO es una falacia informal típica?', opts:['Modus ponens válido','Ad hominem','Hombre de paja','Falso dilema'], a:0, hard:false },
    { id:22, q:'Insultar al interlocutor en un debate es, sobre todo:', opts:['Ad hominem abusivo','Ad populum','Petición de principio','Anfibología'], a:0, hard:false },
    { id:23, q:'“O estás con nosotros o contra nosotros” es:', opts:['Falso dilema','Pendiente resbaladiza','Ad ignorantiam','Tu quoque'], a:0, hard:false },
    { id:24, q:'Citar a un famoso de otro campo como prueba científica es:', opts:['Ad verecundiam','Ad baculum','Falsa causa','Non sequitur'], a:0, hard:false },
    { id:25, q:'La ambigüedad por mala puntuación o estructura se relaciona con:', opts:['Anfibología','Equívoco','Ad populum','Cherry picking'], a:0, hard:false },
    { id:26, q:'“Nadie ha refutado X, luego X es verdadero” es:', opts:['Ad ignorantiam','Ad misericordiam','Ad novitatem','Red herring'], a:0, hard:false },
    { id:27, q:'Atacar un argumento inventado que nadie defendió es:', opts:['Hombre de paja','Tu quoque','Ad baculum','Post hoc'], a:0, hard:false },
    { id:28, q:'Usar la fuerza o el miedo como “razón” es:', opts:['Ad baculum','Ad populum','Ad antiquitatem','Equívoco'], a:0, hard:false },
    { id:29, q:'“La mayoría opina X, luego X es verdad” es:', opts:['Ad populum','Ad verecundiam','Falsa causa','Petición de principio'], a:0, hard:false },
    { id:30, q:'Suponer una cadena inevitable de males sin justificación es:', opts:['Pendiente resbaladiza','Falso dilema','Ad hominem','Non sequitur'], a:0, hard:false },

    // HARD (revivir)
    { id:31, q:'La falacia que confunde el orden causal con la mera sucesión temporal se formaliza a menudo como:', opts:['Post hoc ergo propter hoc','Cum hoc ergo propter hoc solo','Ad logicam','Dicto simpliciter'], a:0, hard:true },
    { id:32, q:'“Si P entonces Q; Q; por tanto P” es el error llamado:', opts:['Afirmación del consecuente','Negación del antecedente','Modus tollens','Silogismo disyuntivo'], a:0, hard:true },
    { id:33, q:'“Si P entonces Q; no P; por tanto no Q” es:', opts:['Negación del antecedente','Afirmación del consecuente','Modus ponens','Dilema constructivo'], a:0, hard:true },
    { id:34, q:'Una generalización que ignora excepciones relevantes se acerca a:', opts:['Dicto simpliciter / accidente','Ad logicam','Petitio principii','Ignoratio elenchi'], a:0, hard:true },
    { id:35, q:'Demostrar que un argumento es falaz no prueba automáticamente lo contrario. Señalar eso evita la falacia:', opts:['Ad logicam (falacia de la falacia)','Ad hominem','Tu quoque','Red herring'], a:0, hard:true },
    { id:36, q:'La “ignoratio elenchi” consiste en:', opts:['Refutar algo distinto de lo que se debatió','Atacar a la persona','Apelar al pueblo','Amenazar'], a:0, hard:true },
    { id:37, q:'Un argumento circular donde la premisa ya incluye la conclusión es:', opts:['Petitio principii','Non sequitur formal','Ad verecundiam','Post hoc'], a:0, hard:true },
    { id:38, q:'La falacia del continuo (sorites) explota:', opts:['Límites vagos entre categorías','Autoridad experta','Amenazas','Popularidad'], a:0, hard:true },
    { id:39, q:'“No hay evidencia de que el remedio falle, luego cura” combina sobre todo:', opts:['Ad ignorantiam + posible post hoc','Solo ad baculum','Solo equívoco','Modus ponens'], a:0, hard:true },
    { id:40, q:'Cargar la pregunta (“¿Sigues engañando al público?”) es un caso de:', opts:['Pregunta compleja / cargada','Falso dilema puro','Ad misericordiam','Cherry picking'], a:0, hard:true },
    { id:41, q:'La falacia “etimológica” asume erróneamente que:', opts:['El origen de una palabra fija su significado actual','La mayoría siempre acierta','La novedad implica verdad','La amenaza prueba la tesis'], a:0, hard:true },
    { id:42, q:'Un “non sequitur” formal se caracteriza porque:', opts:['La conclusión no se deduce de las premisas','Se ataca al emisor','Se apela a la piedad','Se usa una amenaza'], a:0, hard:true },
    { id:43, q:'La falacia del francotirador (texas sharpshooter) describe:', opts:['Ajustar la hipótesis después de ver los datos','Atacar a la persona','Apelar a la tradición','Inventar un hombre de paja'], a:0, hard:true },
    { id:44, q:'“Cum hoc ergo propter hoc” se refiere a:', opts:['Inferir causa solo porque dos hechos coinciden','Amenazar al interlocutor','Citar mal a un experto','Desviar el tema'], a:0, hard:true },
    { id:45, q:'La falacia de composición afirma erróneamente que:', opts:['Lo que vale para las partes vale para el todo','Lo antiguo es mejor','Lo popular es verdad','La lástima decide'], a:0, hard:true }
  ],

  toggle() {
    this.enabled = !this.enabled;
    try { sessionStorage.setItem('paralogismo_quiz', this.enabled ? '1' : '0'); } catch (e) {}
    if (!this.enabled && this.active) this._forceClose(false);
    if (typeof showNotification === 'function') {
      showNotification(
        this.enabled ? 'MODO FALACIAS: ON' : 'MODO FALACIAS: OFF',
        this.enabled ? 'Alt+Z para desactivar' : 'Alt+Z para activar'
      );
    }
  },

  loadPref() {
    try {
      const v = sessionStorage.getItem('paralogismo_quiz');
      if (v === '0') this.enabled = false;
      if (v === '1') this.enabled = true;
    } catch (e) {}
  },

  pickQuestion(hard) {
    let pool = this.bank.filter(x => !!x.hard === !!hard);
    if (!pool.length) pool = this.bank.slice();
    // Preferir no repetidas
    let fresh = pool.filter(x => !this.usedIds.has(x.id));
    if (!fresh.length) {
      this.usedIds.clear();
      fresh = pool;
    }
    const item = fresh[Math.floor(Math.random() * fresh.length)];
    this.usedIds.add(item.id);
    // Barajar opciones manteniendo respuesta
    const pairs = item.opts.map((t, i) => ({ t, i }));
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pairs[i]; pairs[i] = pairs[j]; pairs[j] = tmp;
    }
    const correct = pairs.findIndex(p => p.i === item.a);
    return {
      id: item.id,
      q: item.q,
      opts: pairs.map(p => p.t),
      a: correct,
      hard: !!item.hard
    };
  },

  ensureUI() {
    if (document.getElementById('falacia-quiz')) return;
    const el = document.createElement('div');
    el.id = 'falacia-quiz';
    el.innerHTML = `
      <div class="fq-card">
        <div class="fq-badge" id="fq-badge">FALACIA</div>
        <h2 class="fq-title" id="fq-title">Pregunta</h2>
        <p class="fq-q" id="fq-q"></p>
        <div class="fq-opts" id="fq-opts"></div>
        <div class="fq-bar"><div class="fq-bar-fill" id="fq-bar"></div></div>
        <p class="fq-timer" id="fq-timer">25s</p>
      </div>`;
    document.body.appendChild(el);
  },

  /**
   * @returns {Promise<boolean>} true si acertó
   */
  ask(mode) {
    this.loadPref();
    if (!this.enabled) return Promise.resolve(true);
    if (this.active) return Promise.resolve(false);

    this.ensureUI();
    this.mode = mode || 'collect';
    this.current = this.pickQuestion(this.mode === 'revive');
    this.active = true;
    this.timeLeft = this.TIME_LIMIT;

    // Pausar controles de juego
    try {
      if (typeof gamePaused !== 'undefined') { /* no marcamos pause completo */ }
      document.exitPointerLock && document.exitPointerLock();
    } catch (e) {}

    const root = document.getElementById('falacia-quiz');
    const qEl = document.getElementById('fq-q');
    const optsEl = document.getElementById('fq-opts');
    const badge = document.getElementById('fq-badge');
    const title = document.getElementById('fq-title');
    const timerEl = document.getElementById('fq-timer');
    const bar = document.getElementById('fq-bar');

    badge.textContent = this.mode === 'revive' ? 'REVIVIR · FALACIA DIFÍCIL' : 'MAGIC KEY · FALACIA';
    title.textContent = this.mode === 'revive' ? 'Responde para revivir' : 'Responde para recolectar';
    qEl.textContent = this.current.q;
    optsEl.innerHTML = '';
    this.current.opts.forEach((text, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fq-opt';
      b.textContent = text;
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this._answer(idx);
      });
      optsEl.appendChild(b);
    });

    root.classList.add('visible');
    if (typeof gamePaused !== 'undefined') {
      // bloquear movimiento con flag propio
    }
    window.__falaciaBlock = true;

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      const tick = () => {
        if (!this.active) return;
        this.timeLeft -= 0.1;
        if (timerEl) timerEl.textContent = Math.max(0, Math.ceil(this.timeLeft)) + 's';
        if (bar) bar.style.width = Math.max(0, (this.timeLeft / this.TIME_LIMIT) * 100) + '%';
        if (this.timeLeft <= 0) {
          this._forceClose(false);
          return;
        }
        this.timer = setTimeout(tick, 100);
      };
      this.timer = setTimeout(tick, 100);
    });
  },

  _answer(idx) {
    if (!this.active || !this.current) return;
    const ok = idx === this.current.a;
    this._forceClose(ok);
  },

  _forceClose(success) {
    if (!this.active && !this.pendingResolve) return;
    this.active = false;
    window.__falaciaBlock = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const root = document.getElementById('falacia-quiz');
    if (root) root.classList.remove('visible');
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.current = null;
    if (resolve) resolve(!!success);
  }
};

// Preferencia al cargar
try { FalaciaQuiz.loadPref(); } catch (e) {}
