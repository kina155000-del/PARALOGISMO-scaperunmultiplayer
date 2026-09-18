/**
 * Mazmorra — IA de monstruos (MonsterAI)
 * Requiere que game.js haya definido: isWalkableCell, mapRows, mapCols,
 * exitCoord, stunIndicator, CONFIG (config.js), THREE
 * Se carga ANTES de game.js: la clase se registra; se usa al generar el mundo.
 */
/* =========================================================
   MONSTRUO INTELIGENTE
========================================================= */

class MonsterAI{

    constructor(
        mesh,
        layoutGrid,
        blockSize,
        collisionFn
    ){

        this.mesh =
            mesh;

        this.layoutGrid =
            layoutGrid;

        this.blockSize =
            blockSize;

        this.collisionFn =
            collisionFn;

        this.mixer = null;
        this.actions = {};
        this.currentAnim = null;
        this.baseY = 0; // altura del modelo sobre el suelo
        this._setupAnimations(mesh);

        this.speed =
            CONFIG.monsterSpeed;

        this.chaseSpeed =
            CONFIG.monsterChaseSpeed;

        this.path=[];

        this.pathIndex=0;

        this.pathTimer=0;

        this.targetPoint=null;

        this.lastKnownPlayer=null;

        this.lastSeenTimer=0;

        this.stunnedTimer=0;

        this.stunCooldownTimer=0;

        this.dispersing=false;

        // Tiempo que el jugador lleva escondido (para irse tras 1s)
        this.playerHiddenTime = 0;

        // Una sola teletransportación cerca de la salida al completar partículas
        this.hasRelocatedToExit = false;

        this.patrolPoints=[];

        this.extractWalkablePoints();
    }


    extractWalkablePoints(){

        this.patrolPoints=[];


        for(
            let r=1;
            r<mapRows-1;
            r++
        ){

            for(
                let c=1;
                c<mapCols-1;
                c++
            ){

                if(
                    isWalkableCell(
                        r,
                        c
                    )
                ){

                    this.patrolPoints.push({

                        x:
                            c*
                            this.blockSize,

                        z:
                            r*
                            this.blockSize
                    });
                }
            }
        }
    }


    worldToGrid(
        x,
        z
    ){

        return{

            r:
                Math.round(
                    z/
                    this.blockSize
                ),

            c:
                Math.round(
                    x/
                    this.blockSize
                )
        };
    }


    gridToWorld(
        r,
        c
    ){

        return{

            x:
                c*
                this.blockSize,

            z:
                r*
                this.blockSize
        };
    }


    findPath(
        sx,
        sz,
        tx,
        tz
    ){

        const start =
            this.worldToGrid(
                sx,
                sz
            );

        const goal =
            this.worldToGrid(
                tx,
                tz
            );


        if(
            !isWalkableCell(
                start.r,
                start.c
            )
        ){

            return[];
        }


        let target =
            goal;


        if(
            !isWalkableCell(
                target.r,
                target.c
            )
        ){

            let nearest=null;
            let nearestDist=Infinity;


            for(
                let radius=1;
                radius<=8;
                radius++
            ){

                for(
                    let dr=-radius;
                    dr<=radius;
                    dr++
                ){

                    for(
                        let dc=-radius;
                        dc<=radius;
                        dc++
                    ){

                        const r=
                            goal.r+
                            dr;

                        const c=
                            goal.c+
                            dc;


                        if(
                            isWalkableCell(
                                r,
                                c
                            )
                        ){

                            const d=
                                Math.hypot(
                                    dr,
                                    dc
                                );


                            if(
                                d<
                                nearestDist
                            ){

                                nearestDist=d;

                                nearest={
                                    r,
                                    c
                                };
                            }
                        }
                    }
                }


                if(nearest)
                    break;
            }


            if(!nearest)
                return[];


            target=nearest;
        }


        const startKey =
            `${start.r},${start.c}`;

        const targetKey =
            `${target.r},${target.c}`;


        if(
            startKey===
            targetKey
        ){

            return[];
        }


        const open=[];

        const cameFrom =
            new Map();

        const gScore =
            new Map();


        gScore.set(
            startKey,
            0
        );


        open.push({

            r:start.r,
            c:start.c,
            f:0
        });


        const directions=[

            [-1,0],
            [1,0],
            [0,-1],
            [0,1],

            [-1,-1],
            [-1,1],
            [1,-1],
            [1,1]

        ];


        const closed =
            new Set();


        while(
            open.length
        ){

            open.sort(
                (a,b)=>
                    a.f-b.f
            );


            const current =
                open.shift();


            const currentKey =
                `${current.r},${current.c}`;


            if(
                closed.has(
                    currentKey
                )
            )
                continue;


            closed.add(
                currentKey
            );


            if(
                current.r===
                    target.r &&
                current.c===
                    target.c
            ){

                const path=[];

                let key =
                    currentKey;


                while(
                    key &&
                    key!==startKey
                ){

                    const parts =
                        key
                        .split(',')
                        .map(Number);


                    path.unshift(
                        this.gridToWorld(
                            parts[0],
                            parts[1]
                        )
                    );


                    key =
                        cameFrom.get(
                            key
                        );
                }


                return path;
            }


            for(
                const direction
                of directions
            ){

                const nr =
                    current.r+
                    direction[0];

                const nc =
                    current.c+
                    direction[1];


                if(
                    !isWalkableCell(
                        nr,
                        nc
                    )
                )
                    continue;


                /*
                 * No atraviesa las esquinas
                 * de dos paredes.
                 */

                if(
                    direction[0]!==0 &&
                    direction[1]!==0
                ){

                    if(

                        !isWalkableCell(
                            current.r+
                            direction[0],
                            current.c
                        ) ||

                        !isWalkableCell(
                            current.r,
                            current.c+
                            direction[1]
                        )

                    ){

                        continue;
                    }
                }


                const moveCost =
                    direction[0]!==0 &&
                    direction[1]!==0
                        ?1.414
                        :1;


                const neighborKey =
                    `${nr},${nc}`;


                const newCost =
                    gScore.get(
                        currentKey
                    )+
                    moveCost;


                if(
                    !gScore.has(
                        neighborKey
                    ) ||
                    newCost<
                        gScore.get(
                            neighborKey
                        )
                ){

                    gScore.set(
                        neighborKey,
                        newCost
                    );


                    cameFrom.set(
                        neighborKey,
                        currentKey
                    );


                    const heuristic =
                        Math.hypot(

                            target.c-nc,

                            target.r-nr

                        );


                    open.push({

                        r:nr,
                        c:nc,

                        f:
                            newCost+
                            heuristic
                    });
                }
            }
        }


        return[];
    }


    hasLineOfSight(
        from,
        to
    ){

        const distance =
            Math.hypot(
                to.x-from.x,
                to.z-from.z
            );


        const steps =
            Math.max(
                8,
                Math.ceil(
                    distance*4
                )
            );


        for(
            let i=1;
            i<steps;
            i++
        ){

            const t =
                i/steps;


            const x =
                from.x+
                (
                    to.x-
                    from.x
                )*
                t;


            const z =
                from.z+
                (
                    to.z-
                    from.z
                )*
                t;


            if(
                this.collisionFn({
                    x,
                    z
                })
            ){

                return false;
            }
        }


        return true;
    }


    randomPoint(){

        if(
            !this.patrolPoints.length
        ){

            return{
                x:5,
                z:5
            };
        }


        return{
            ...this.patrolPoints[
                Math.floor(
                    Math.random()*
                    this.patrolPoints.length
                )
            ]
        };
    }


    findSafePoint(
        player
    ){

        let best=null;

        let bestScore=
            -Infinity;


        for(
            let i=0;
            i<35;
            i++
        ){

            const point =
                this.randomPoint();


            const playerDistance =
                Math.hypot(

                    point.x-
                    player.x,

                    point.z-
                    player.z

                );


            const monsterDistance =
                Math.hypot(

                    point.x-
                    this.mesh.position.x,

                    point.z-
                    this.mesh.position.z

                );


            const score =
                playerDistance+
                monsterDistance*
                .1;


            if(
                score>
                bestScore
            ){

                bestScore=
                    score;

                best=
                    point;
            }
        }


        return(
            best||
            this.randomPoint()
        );
    }



    _setupAnimations(root) {
        if (!root || typeof THREE === 'undefined') return;
        const clips = root.userData.animationClips || [];
        if (!clips.length) return;

        this.mixer = new THREE.AnimationMixer(root);
        clips.forEach((clip) => {
            const name = (clip.name || 'clip').toLowerCase();
            this.actions[name] = this.mixer.clipAction(clip);
            // también sin path Armature|
            const short = name.split('|').pop();
            if (short && short !== name) this.actions[short] = this.actions[name];
        });
        this.playAnim('idle') || this.playAnim('walk') || this.playAnim('run') || this._playFirst();
    }

    _playFirst() {
        const keys = Object.keys(this.actions);
        if (!keys.length) return false;
        return this.playAnim(keys[0]);
    }

    playAnim(name) {
        if (!this.mixer || !name) return false;
        const key = String(name).toLowerCase();
        // buscar coincidencia parcial
        let action = this.actions[key];
        if (!action) {
            const found = Object.keys(this.actions).find(k => k.includes(key) || key.includes(k));
            if (found) action = this.actions[found];
        }
        if (!action) return false;
        if (this.currentAnim === action) return true;
        if (this.currentAnim) {
            this.currentAnim.fadeOut(0.2);
        }
        action.reset().fadeIn(0.2).play();
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.currentAnim = action;
        return true;
    }

    _setEmissive(hex, intensity) {
        if (!this.mesh) return;
        this.mesh.traverse((c) => {
            if (!c.isMesh || !c.material) return;
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            mats.forEach((mat) => {
                if (mat.color) mat.color.setHex(0x030303);
                if (mat.emissive) {
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0;
                }
                if (mat.metalness != null) mat.metalness = 0;
                if (mat.roughness != null) mat.roughness = 1;
                mat.needsUpdate = true;
            });
        });
    }

    _ensureBlackParticles() {
        if (this.blackParticles || !this.mesh || typeof THREE === 'undefined') return;
        const count = 48;
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 0.4;
            positions[i * 3 + 1] = Math.random() * 0.6;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
            velocities.push({
                x: (Math.random() - 0.5) * 0.8,
                y: 0.6 + Math.random() * 1.2,
                z: (Math.random() - 0.5) * 0.8
            });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: 0x0a0a0a,
            size: 0.12,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            sizeAttenuation: true
        });
        const pts = new THREE.Points(geo, mat);
        pts.visible = false;
        pts.frustumCulled = false;
        pts.userData.velocities = velocities;
        pts.userData.life = 0;
        this.mesh.add(pts);
        this.blackParticles = pts;
    }

    _updateBlackParticles(delta) {
        if (!this.blackParticles) return;
        const pts = this.blackParticles;
        if (!pts.visible) return;
        pts.userData.life -= delta;
        const pos = pts.geometry.attributes.position;
        const vels = pts.userData.velocities;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i) + vels[i].x * delta;
            let y = pos.getY(i) + vels[i].y * delta;
            let z = pos.getZ(i) + vels[i].z * delta;
            if (y > 2.2) {
                x = (Math.random() - 0.5) * 0.5;
                y = 0;
                z = (Math.random() - 0.5) * 0.5;
            }
            pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
        if (pts.userData.life <= 0 && this.stunnedTimer <= 0) {
            pts.visible = false;
        }
    }

    _startBlackParticles() {
        this._ensureBlackParticles();
        if (!this.blackParticles) return;
        this.blackParticles.visible = true;
        this.blackParticles.userData.life = Math.max(this.stunnedTimer || 2, 2);
    }


    stun(){

        if(
            this.stunCooldownTimer>0 ||
            this.stunnedTimer>0
        )
            return false;


        this.stunnedTimer =
            CONFIG.monsterStunDuration;

        this.stunCooldownTimer =
            CONFIG.monsterStunCooldown;


        this.path=[];

        this.pathIndex=0;

        this.pathTimer=.5;


        // Oscuro total, sin brillo
        this._setEmissive(0x000000, 0);
        this._startBlackParticles();


        stunIndicator.classList.add(
            'show'
        );


        setTimeout(
            () => {

                stunIndicator.classList.remove(
                    'show'
                );

            },
            900
        );
    }


    update(
        delta,
        playerPos,
        playerHidden,
        playerFlying,
        flashlightActive,
        allParticlesCollected,
        extraTargets = []
    ){

        if(
            !this.mesh
        )
            return false;

        if (this.mixer) this.mixer.update(delta);
        this._updateBlackParticles(delta);

        // Animación según estado
        if (this.stunnedTimer > 0) {
            this.playAnim('idle') || this.playAnim('hit') || this.playAnim('death');
        }

        if(
            this.stunCooldownTimer>0
        ){

            this.stunCooldownTimer -=
                delta;

            if(
                this.stunCooldownTimer<0
            )
                this.stunCooldownTimer=0;
        }


        /*
         * PARALIZADO
         */

        if(
            this.stunnedTimer>0
        ){

            this.stunnedTimer -=
                delta;

            // Sin girar: queda congelado y oscuro
            this._updateBlackParticles(delta);

            if(
                this.stunnedTimer<=0
            ){

                this.stunnedTimer=0;


                this._setEmissive(0x000000, 0);
            }


            return false;
        }


        // En cooperativo el monstruo considera a todos los jugadores vivos
        // y elige al objetivo visible más cercano.
        const targets = [{
            pos: playerPos,
            hidden: !!playerHidden,
            flying: !!playerFlying,
            flashlightActive: !!flashlightActive,
            battery: (flashlightActive ? 1 : 0),
            yaw: (typeof yawObject !== 'undefined' && yawObject && yawObject.rotation) ? yawObject.rotation.y : 0,
            id: 'local'
        }].concat(Array.isArray(extraTargets) ? extraTargets : []);
        let target = targets[0];
        let distance = Infinity;
        for (const candidate of targets) {
            if (!candidate || !candidate.pos || candidate.hidden || candidate.flying) continue;
            const d = Math.hypot(
                candidate.pos.x - this.mesh.position.x,
                candidate.pos.z - this.mesh.position.z
            );
            if (d < distance) { distance = d; target = candidate; }
        }
        if (!target || !target.pos) {
            target = targets[0];
            distance = Math.hypot(playerPos.x - this.mesh.position.x, playerPos.z - this.mesh.position.z);
        }
        const targetPos = target.pos;
        const targetHidden = !!target.hidden;
        const targetFlying = !!target.flying;
        this.currentTargetId = target.id || 'local';


        /*
         * LA LINTERNA PARALIZA
         * SOLO A CORTA DISTANCIA
         */

        // Cualquiera de los dos jugadores puede paralizar al monstruo.
        // El host recibe el estado de ambas linternas y es la única autoridad
        // que aplica el stun, por lo que el resultado es idéntico para los dos.
        if (this.stunCooldownTimer <= 0) {
            const flashlightTargets = targets.filter(candidate =>
                candidate && candidate.pos && !candidate.hidden && !candidate.flying &&
                candidate.flashlightActive && candidate.battery > 0
            );
            for (const lightTarget of flashlightTargets) {
                const dx = this.mesh.position.x - lightTarget.pos.x;
                const dz = this.mesh.position.z - lightTarget.pos.z;
                const lightDistance = Math.hypot(dx, dz);
                if (lightDistance > 9.5 || lightDistance < 0.01) continue;
                const yaw = Number.isFinite(Number(lightTarget.yaw)) ? Number(lightTarget.yaw) : (lightTarget.id === 'local' && typeof yawObject !== 'undefined' ? yawObject.rotation.y : 0);
                const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
                const dot = (dx * fx + dz * fz) / lightDistance;
                // Cono amplio para que ambas linternas sean realmente utilizables.
                // La linterna es un arma de luz: para el stun no exigimos la
                // misma prueba de colision que usa la vision del monstruo.
                // La comprobacion del cono + distancia evita activaciones
                // por detras y hace que funcione tambien en modo SOLO.
                if (dot >= 0.30) {
                    this.stun();
                    return false;
                }
            }
        }


        /*
         * DETECCIÓN
         */

        const seesPlayer =
            !targetHidden &&
            !targetFlying &&
            distance < CONFIG.monsterVisionRange &&
            this.hasLineOfSight(
                this.mesh.position,
                targetPos
            );


        if(
            seesPlayer
        ){

            this.lastKnownPlayer={

                x:
                    targetPos.x,

                z:
                    targetPos.z
            };

            this.lastSeenTimer=
                CONFIG.monsterMemoryTime;
        }
        else{

            this.lastSeenTimer -=
                delta;
        }


        this.pathTimer -=
            delta;


        let destination=null;


        /*
         * TODAS LAS PARTÍCULAS RECOGIDAS:
         * Teletransporte ÚNICO cerca de la salida, luego cazan
         * con normalidad pero patrullando cerca del punto de victoria.
         */
        if(
            allParticlesCollected &&
            exitCoord &&
            !this.hasRelocatedToExit
        ){
            this.hasRelocatedToExit = true;
            this.playerHiddenTime = 0;
            this.dispersing = false;
            this.lastKnownPlayer = null;
            this.lastSeenTimer = 0;
            this.path = [];
            this.pathIndex = 0;
            this.pathTimer = 0;

            const cx = exitCoord.x * this.blockSize;
            const cz = exitCoord.z * this.blockSize;
            let placed = false;
            for (let attempt = 0; attempt < 40 && !placed; attempt++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 2.5 + Math.random() * 5;
                const nx = cx + Math.cos(angle) * radius;
                const nz = cz + Math.sin(angle) * radius;
                const cellC = Math.round(nx / this.blockSize);
                const cellR = Math.round(nz / this.blockSize);
                if (
                    isWalkableCell(cellR, cellC) &&
                    !(cellR === exitCoord.z && cellC === exitCoord.x)
                ) {
                    this.mesh.position.set(nx, this.baseY != null ? this.baseY : 0, nz);
                    placed = true;
                }
            }
            if (!placed) {
                this.mesh.position.set(cx + 2, this.baseY != null ? this.baseY : 0, cz + 2);
            }
            this.targetPoint = null;
        }

        /*
         * SI EL JUGADOR ESTÁ ESCONDIDO (prioridad alta)
         * Espera 1 segundo y luego SE VA (no campean).
         */

        if(
            targetHidden && !targetFlying
        ){

            this.playerHiddenTime += delta;

            // Primer segundo: aún puede ir a la última posición
            if(
                this.playerHiddenTime < 1.0
            ){

                if(
                    this.lastKnownPlayer
                ){
                    destination = {
                        x: this.lastKnownPlayer.x,
                        z: this.lastKnownPlayer.z
                    };
                }
                else if(
                    this.targetPoint
                ){
                    destination = this.targetPoint;
                }
                else {
                    // Sin info: empieza a alejarse ya
                    this.dispersing = true;
                    this.targetPoint = this.findSafePoint(playerPos);
                    this.path = [];
                    this.pathIndex = 0;
                    destination = this.targetPoint;
                }

            }
            else {

                // Tras 1s: abandonar búsqueda y alejarse de verdad
                this.lastKnownPlayer = null;
                this.lastSeenTimer = 0;

                if(
                    !this.dispersing ||
                    !this.targetPoint ||
                    Math.hypot(
                        this.targetPoint.x - this.mesh.position.x,
                        this.targetPoint.z - this.mesh.position.z
                    ) < 2.5
                ){
                    this.dispersing = true;
                    // Punto lejos del jugador (no cerca del escondite)
                    this.targetPoint = this.findSafePoint(playerPos);
                    this.path = [];
                    this.pathIndex = 0;
                    this.pathTimer = 0;
                }

                destination = this.targetPoint;
            }
        }

        /*
         * SI VE AL JUGADOR
         */

        else if(
            seesPlayer
        ){

            this.playerHiddenTime = 0;
            this.dispersing = false;

            destination={

                x:
                    targetPos.x,

                z:
                    targetPos.z
            };

        }

        /*
         * SI PERDIÓ AL JUGADOR
         */

        else if(
            this.lastKnownPlayer &&
            this.lastSeenTimer>0
        ){

            this.playerHiddenTime = 0;
            this.dispersing = false;

            destination={

                x:
                    this.lastKnownPlayer.x,

                z:
                    this.lastKnownPlayer.z
            };

        }
        else if(
            playerFlying
        ){

            this.playerHiddenTime = 0;
            this.dispersing = false;

            if(
                !this.targetPoint ||
                Math.hypot(

                    this.targetPoint.x-
                    this.mesh.position.x,

                    this.targetPoint.z-
                    this.mesh.position.z

                )<1
            ){

                this.targetPoint =
                    this.randomPoint();

                this.path=[];
                this.pathIndex=0;
            }


            destination =
                this.targetPoint;
        }

        /*
         * PATRULLA
         * (si ya están las partículas, patrulla cerca de la salida)
         */

        else{

            this.playerHiddenTime = 0;
            this.dispersing=false;

            if(
                !this.targetPoint ||
                Math.hypot(

                    this.targetPoint.x-
                    this.mesh.position.x,

                    this.targetPoint.z-
                    this.mesh.position.z

                )<1
            ){

                if (allParticlesCollected && exitCoord) {
                    const cx = exitCoord.x * this.blockSize;
                    const cz = exitCoord.z * this.blockSize;
                    let found = null;
                    for (let t = 0; t < 25; t++) {
                        const angle = Math.random() * Math.PI * 2;
                        const radius = 1.5 + Math.random() * 9;
                        const px = cx + Math.cos(angle) * radius;
                        const pz = cz + Math.sin(angle) * radius;
                        const cellC = Math.round(px / this.blockSize);
                        const cellR = Math.round(pz / this.blockSize);
                        if (isWalkableCell(cellR, cellC)) {
                            found = { x: px, z: pz };
                            break;
                        }
                    }
                    this.targetPoint = found || this.randomPoint();
                } else {
                    this.targetPoint =
                        this.randomPoint();
                }

                this.path=[];
                this.pathIndex=0;
            }


            destination =
                this.targetPoint;
        }


        /*
         * CALCULAR CAMINO
         */

        if(
            destination &&
            this.pathTimer<=0
        ){

            this.path =
                this.findPath(

                    this.mesh.position.x,
                    this.mesh.position.z,

                    destination.x,
                    destination.z

                );


            this.pathIndex=0;


            /*
             * Recalcula muy seguido cuando persigue.
             */

            this.pathTimer =
                seesPlayer
                    ? .10
                    : .32;
        }


        /*
         * MOVIMIENTO
         */

        if(
            this.path.length &&
            this.pathIndex<
            this.path.length
        ){

            const waypoint =
                this.path[
                    this.pathIndex
                ];


            const dx =
                waypoint.x-
                this.mesh.position.x;


            const dz =
                waypoint.z-
                this.mesh.position.z;


            const waypointDistance =
                Math.hypot(
                    dx,
                    dz
                );


            if(
                waypointDistance<
                .2
            ){

                this.pathIndex++;

            }
            else{

                const nx =
                    dx/
                    waypointDistance;

                const nz =
                    dz/
                    waypointDistance;


                const speed =
                    (seesPlayer || allParticlesCollected || this.lastSeenTimer > 0)
                        ? this.chaseSpeed
                        : this.speed;


                const step =
                    speed*
                    delta;


                /*
                 * MOVIMIENTO CON
                 * EVITACIÓN DE PAREDES
                 */

                const directions=[

                    {
                        x:nx,
                        z:nz
                    },

                    {
                        x:-nz,
                        z:nx
                    },

                    {
                        x:nz,
                        z:-nx
                    },

                    {
                        x:
                            (nx-nz)*
                            .707,

                        z:
                            (nz+nx)*
                            .707
                    }

                ];


                let moved=false;


                for(
                    const dir
                    of directions
                ){

                    const next={

                        x:
                            this.mesh.position.x+
                            dir.x*
                            step,

                        z:
                            this.mesh.position.z+
                            dir.z*
                            step
                    };


                    if(
                        !this.collisionFn(
                            next
                        )
                    ){

                        this.mesh.position.x =
                            next.x;

                        this.mesh.position.z =
                            next.z;

                        this.mesh.rotation.y =
                            Math.atan2(
                                dir.x,
                                dir.z
                            );
                        this.playAnim('run') || this.playAnim('walk') || this.playAnim('chase');

                        moved=true;

                        break;
                    }
                }


                /*
                 * Si la caja de colisión del modelo impide avanzar, no
                 * dejamos al monstruo congelado: probamos la cuadrícula.
                 */
                if (!moved && destination) {
                    const dx0 = destination.x - this.mesh.position.x;
                    const dz0 = destination.z - this.mesh.position.z;
                    const d0 = Math.hypot(dx0, dz0);
                    if (d0 > 0.05) {
                        const speed0 = (seesPlayer || allParticlesCollected || this.lastSeenTimer > 0) ? this.chaseSpeed : this.speed;
                        const step0 = Math.min(d0, speed0 * delta);
                        const nx0 = dx0 / d0;
                        const nz0 = dz0 / d0;
                        const tx0 = this.mesh.position.x + nx0 * step0;
                        const tz0 = this.mesh.position.z + nz0 * step0;
                        const r0 = Math.round(tz0 / this.blockSize);
                        const c0 = Math.round(tx0 / this.blockSize);
                        const r1 = Math.round(this.mesh.position.z / this.blockSize);
                        const c1 = Math.round(this.mesh.position.x / this.blockSize);
                        const diagonal0 = r0 !== r1 && c0 !== c1;
                        const walkable = isWalkableCell(r0, c0) && (!diagonal0 || (isWalkableCell(r1, c0) && isWalkableCell(r0, c1)));
                        if (walkable) {
                            this.mesh.position.x = tx0;
                            this.mesh.position.z = tz0;
                            this.mesh.rotation.y = Math.atan2(nx0, nz0);
                            this.playAnim('run') || this.playAnim('walk') || this.playAnim('chase');
                            moved = true;
                        }
                    }
                }

                if(!moved){
                    this.path=[];
                    this.pathIndex=0;
                    this.pathTimer=0;
                }
            }
        }

        // Fallback robusto: si el A* no entrega camino (por ejemplo, porque el
        // monstruo quedó un poco fuera del centro de una celda), seguimos al
        // objetivo por la cuadrícula sin depender de la caja 3D del modelo.
        if (destination && (!this.path.length || this.pathIndex >= this.path.length)) {
            const dx2 = destination.x - this.mesh.position.x;
            const dz2 = destination.z - this.mesh.position.z;
            const d2 = Math.hypot(dx2, dz2);
            if (d2 > 0.08) {
                const speed2 = (seesPlayer || allParticlesCollected || this.lastSeenTimer > 0) ? this.chaseSpeed : this.speed;
                const step2 = Math.min(d2, speed2 * delta);
                const nx2 = dx2 / d2, nz2 = dz2 / d2;
                const tx2 = this.mesh.position.x + nx2 * step2;
                const tz2 = this.mesh.position.z + nz2 * step2;
                const rr = Math.round(tz2 / this.blockSize);
                const cc = Math.round(tx2 / this.blockSize);
                if (isWalkableCell(rr, cc)) {
                    this.mesh.position.x = tx2;
                    this.mesh.position.z = tz2;
                    this.mesh.rotation.y = Math.atan2(nx2, nz2);
                    this.playAnim('run') || this.playAnim('walk') || this.playAnim('chase');
                }
            }
        }

        // Último respaldo anti-bloqueo: si A* y el movimiento directo no avanzaron,
        // intenta cada eje por separado. Esto evita que un monstruo se congele
        // por quedar ligeramente desalineado con la cuadrícula.
        if (destination && !this.stunnedTimer) {
            const dx3 = destination.x - this.mesh.position.x;
            const dz3 = destination.z - this.mesh.position.z;
            const d3 = Math.hypot(dx3, dz3);
            if (d3 > 0.08) {
                const step3 = Math.min(d3, ((seesPlayer || allParticlesCollected || this.lastSeenTimer > 0) ? this.chaseSpeed : this.speed) * delta);
                const tryMove = (nx, nz) => {
                    const tx = this.mesh.position.x + nx * step3;
                    const tz = this.mesh.position.z + nz * step3;
                    const rr = Math.round(tz / this.blockSize), cc = Math.round(tx / this.blockSize);
                    if (!isWalkableCell(rr, cc)) return false;
                    this.mesh.position.x = tx; this.mesh.position.z = tz;
                    this.mesh.rotation.y = Math.atan2(nx, nz);
                    this.playAnim('run') || this.playAnim('walk') || this.playAnim('chase');
                    return true;
                };
                const ax = Math.abs(dx3) >= Math.abs(dz3) ? Math.sign(dx3) : 0;
                const az = Math.abs(dz3) > Math.abs(dx3) ? Math.sign(dz3) : 0;
                if (ax && !tryMove(ax, 0)) tryMove(0, Math.sign(dz3));
                else if (az && !tryMove(0, az)) tryMove(Math.sign(dx3), 0);
            }
        }

        this.mesh.position.y = (this.baseY != null ? this.baseY : 0);


        /*
         * CAPTURA
         */

        return(
            !playerHidden &&
            !playerFlying &&
            distance<.8
        );
    }


    teleportNearPlayer(
        playerPos
    ){

        const point =
            this.findSafePoint(
                playerPos
            );


        this.mesh.position.set(

            point.x,

            .7,

            point.z

        );


        this.path=[];

        this.pathIndex=0;

        this.pathTimer=0;
    }
}


