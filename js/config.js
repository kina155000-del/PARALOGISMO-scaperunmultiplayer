/**
 * Mazmorra — Configuración central
 * Cambia aquí cantidades, velocidades, niebla, etc.
 */
const CONFIG = {
  // Mapa
  mapRows: 180,
  mapCols: 180,
  blockSize: 1,
  roomAttempts: 110,
  roomSizeMin: 6,
  roomSizeMax: 15,

  // Conteos
  particleCount: 10,
  hideCount: 160,
  hideMinDist: 4.2,
  batteryCount: 100,
  batteryMinDist: 7,
  chocolateCount: 100,
  monsterCount: 5,

  // Niebla / luz
  fogNormal: 0.12,
  fogFly: 0.0,
  ambientIntensity: 0.16,
  ambientIntensityFly: 0.85,
  playerLightIntensity: 0.18,
  playerLightIntensityFly: 0.55,

  // Jugador
  walkSpeed: 3.2,
  runSpeed: 5.5,
  flySpeed: 12,
  maxStamina: 100,
  staminaDrainRate: 18,
  staminaRegenRate: 2.8,
  staminaChocolateBoost: 35,

  // Linterna
  maxBattery: 5,
  flashlightDrainTime: 8,

  // Recolección (ms)
  itemCollectTime: 1500,
  chocolateCollectTime: 3000,

  // Monstruos
  monsterSpeed: 3.4,
  monsterChaseSpeed: 5.2,
  monsterVisionRange: 38,
  monsterMemoryTime: 14,
  monsterStunDuration: 10,
  monsterStunCooldown: 20,
  dangerPulseRange: 11,

  // Muros / techo
  wallHeight: 6.5,
  wallY: 2.5,
  ceilingY: 5.9,

  // Título
  title: 'PARALOGISMO-scaperun'
};

// Congelar para evitar cambios accidentales en runtime
Object.freeze(CONFIG);
