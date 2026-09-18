# Mazmorra

Juego de laberinto en Three.js (primeras personas).

## Cómo jugar / abrir

1. Descomprime este ZIP.
2. Abre `index.html` (menú) → `juego.html` (partida) en un navegador moderno (Chrome, Firefox, Edge).
3. Haz **clic** para entrar en pantalla completa y capturar el ratón.

> Si el navegador bloquea módulos o carga local de assets, puedes servir la carpeta con un servidor local:
> `npx serve .`  o  `python3 -m http.server 8080`

## Controles

| Tecla | Acción |
|-------|--------|
| WASD | Moverse |
| Ratón | Mirar |
| Ctrl | Correr (gasta estamina) |
| Q | Interactuar / esconderse / comer chocolate |
| F | Linterna |
| E | Modo volar |
| R | Regenerar mapa |

## Estructura del proyecto

```
mazmorra/
├── index.html          # Menú inicio
├── juego.html          # Partida
├── css/
│   └── style.css       # Estilos HUD y overlays
├── js/
│   ├── config.js       # ← Ajusta cantidades, velocidades, niebla
│   ├── materials.js    # Carga de texturas (assets/textures)
│   ├── monsters.js     # Punto de extensión IA monstruos
│   ├── world.js        # Punto de extensión generación de mapa
│   └── game.js         # Lógica principal + loop Three.js
└── assets/
    └── textures/       # wall.png, floor.png, ceiling.png (opcionales)
```

## Configuración rápida

Edita `js/config.js`:

- `hideCount`, `batteryCount`, `chocolateCount`, `monsterCount`
- `walkSpeed`, `runSpeed`, `monsterChaseSpeed`
- `fogNormal`, `staminaRegenRate`

## Texturas (siguiente paso)

Coloca imágenes en `assets/textures/` y cárgalas en `game.js` con `THREE.TextureLoader` sobre `wallMaterial` / `floorMaterial`.


## Texturas activas

Coloca estos archivos (nombres exactos):

```
assets/textures/wall.png   → paredes
assets/textures/floor.png  → suelo
assets/textures/hide.png   → escondites (hoyos)
```

El **techo** es negro a propósito (sin textura).

Si abres `index.html` con `file://`, algunos navegadores bloquean texturas locales.
Usa un servidor local:

```bash
cd mazmorra
python3 -m http.server 8080
```

Luego abre http://localhost:8080


## Modelos 3D (GLB)

Coloca los archivos en `assets/models/` con estos nombres exactos:

### Jugables
| Archivo | Uso |
|---------|-----|
| key.glb | Magic Keys |
| pan.glb | Pan (estamina) |
| coal.glb | Carbón (farol) |
| escondite.glb | Hoyos de escondite |

### Decoración (mismo folder)
escudo.glb, escudo1.glb, flecha.glb, hacha.glb, pocion.glb,
Skull2.glb, Sword.glb, Barril.glb, caja.glb, cubo.glb,
mesita.glb, metales.glb, Skull.glb, telaña.glb

Los recolectables (key, pan, coal) brillan un poco. La decoración se reparte por el suelo sin colisión (~80 props).

Requiere `GLTFLoader` (ya incluido en index.html).


## UI / menús (imágenes)

Coloca PNGs en `assets/ui/` y regístralos en `js/ui.js` → `UIAssets.files`.

Ejemplo:
```js
files: {
  logo: 'logo.png',
  menuBg: 'menu-bg.png',
  iconKey: 'icon-key.png',
  iconCoal: 'icon-coal.png',
  iconBread: 'icon-bread.png'
}
```


## Assets UI (nombres exactos)

```
assets/ui/
  pergamino.png
  madera.png
  lock.png
  unlock.png
  brujula.png
  fonts/
    tipografia1.ttf   ← Tipografia (1).ttf
    tipografia2.ttf   ← Tipografia (2).ttf
    tipografia3.ttf   ← Tipografia (3).ttf
```


## Controles
- WASD mover · Ctrl correr
- **E** interactuar (recoger / esconderse)
- **R** farol
- **Y** volar
- **Q** o **T** o **ESC** pausa
- **M** regenerar mapa (dev)

## Texturas UI extra
```
assets/textures/carbon.png
assets/textures/pan.png
assets/ui/brujula.png
```


## V7
En multijugador, la semilla queda bloqueada por sala y nivel: reiniciar/reaparecer conserva el mapa; solo avanzar de nivel cambia la semilla. Recursos compartidos con ocultación inmediata y confirmación autoritativa del host.
