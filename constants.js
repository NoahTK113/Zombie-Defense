// ============================================================
// ZOMBIE DEFENSE - Constants & Configuration
// ============================================================

// --- World ---
const TILE_SIZE = 20;
const WORLD_W = 640;   // tiles wide (~10x viewport width)
const WORLD_H = 205;   // tiles tall (70 sky + 1 grass + 134 earth)
const GROUND_LEVEL = 70; // row index where ground surface sits

// Tile types
const TILE = {
    AIR: 0,
    EARTH: 1,
    BRICK: 2,
    ARTIFACT: 3,
    PEDESTAL: 4,
};

// Artifact constants
const ARTIFACT_SIZE = 5; // tiles
const ARTIFACT_PX = ARTIFACT_SIZE * TILE_SIZE;
const ARTIFACT_TX = Math.floor(WORLD_W / 2) - 2; // tile x start
const ARTIFACT_TY = GROUND_LEVEL - ARTIFACT_SIZE; // tile y start

// Pedestal constants
const PEDESTAL_CENTER_X = ARTIFACT_TX + Math.floor(ARTIFACT_SIZE / 2); // tile 320
const PEDESTAL_TOP_W = ARTIFACT_SIZE; // 5, matches artifact width
const PEDESTAL_BOT_W = 40;
const PEDESTAL_CONE_DEPTH = 18; // rows the cone spans (1:1 slope from 5 to 40)
const PEDESTAL_CONE_TOP_Y = GROUND_LEVEL; // starts right below artifact

// Lighting constants (tunable)
const LIGHT_RADIUS = 25;     // tiles - full bright zone around artifact
const LIGHT_FALLOFF = 15;    // tiles - transition from bright to dark
const LIGHT_DARKNESS = 0.85; // max overlay opacity in dark areas (0-1)
const LIGHT_AMBIENT = 0.08;  // global ambient - reduces darkness slightly everywhere

// Zombie constants (tunable)
const ZOMBIE_SPEED = 60;            // pixels/sec base walk speed
const ZOMBIE_SPAWN_INTERVAL = 3;    // seconds between spawns
const ZOMBIE_SPAWN_DIST = LIGHT_RADIUS + LIGHT_FALLOFF + 5; // tiles from artifact center
const ZOMBIE_COLLISION_R = TILE_SIZE * 0.4;  // circle collision radius per zombie (8px, matches body half-width)
const ZOMBIE_BOUNCE = 0.02;                  // velocity damping on collision (0=absorb, 1=elastic)
const ABSORB_PULSE_HZ = 1.5;              // red pulse frequency during absorption
const ABSORB_PULSE_COUNT = 5;             // number of pulses before disintegration
const ABSORB_DURATION = ABSORB_PULSE_COUNT / ABSORB_PULSE_HZ; // ~3.33 seconds
const ZOMBIE_BREAK_DPS = 33;          // damage per second when attacking blocks
const BLOCK_BASE_HP = { [TILE.EARTH]: 100, [TILE.BRICK]: 150 }; // HP per block type
const ZOMBIE_BASE_HP = 150;             // base zombie hit points
const ZOMBIE_KNOCKBACK = 36;            // pixels/sec impulse on bullet hit

// Shooting constants (tunable)
const PISTOL_FIRE_RATE = 0.067;         // seconds between shots (3x faster)
const PISTOL_DAMAGE = 3;                // damage per bullet
const BULLET_SPEED = 3200;              // pixels/sec (doubled)
const BULLET_RADIUS = 2;                // bullet visual radius in pixels
const PISTOL_PENETRATION = 2;           // number of zombies a bullet can hit

// Player combat constants
const PLAYER_MAX_HP = 100;              // player max health
const ZOMBIE_CONTACT_DAMAGE = 30;       // damage per zombie touch
const PLAYER_INVULN_TIME = 0.2;         // seconds of invulnerability after hit
const PLAYER_DAMAGE_KNOCKBACK = 200;    // pixels/sec knockback impulse when hit
const PLAYER_RESPAWN_TIME = 10;         // seconds to respawn after death

// Artifact health
const ARTIFACT_MAX_HP = 1000;
const ARTIFACT_ABSORB_DAMAGE = 100;     // damage per zombie absorbed
const ARTIFACT_REGEN = 20;              // HP/sec regen (4x)

// Death particle constants
const DEATH_PARTICLE_COUNT = 8;         // pieces per zombie death
const DEATH_PARTICLE_LIFE = 0.8;        // seconds particles live

// Physics
const GRAVITY = 800; // pixels/sec^2
const INTRO_SPAWN_OFFSET = 250; // tiles to the right of artifact (near world edge)

// Camera zoom limits
const MIN_ZOOM_BUILD = 0.65;
const MIN_ZOOM_PLAYER = 1.25;
const MAX_ZOOM = 3.0;

// ============================================================
// WAVE SYSTEM CONFIG (CoD Zombies style)
// ============================================================
const WAVE_CONFIG = {
    // --- Zombie Count ---
    baseZombieCount: 5,              // zombies in wave 1
    // Formula: floor(baseZombieCount + countGrowthRate * (wave-1)^countGrowthPower)
    countGrowthRate: 2.5,
    countGrowthPower: 1.35,

    // --- Type Ratio ---
    flyerRatio: 0.67,                // 2/3 of each wave are flyers

    // --- Spawn Rate ---
    baseSpawnInterval: 2.5,          // seconds between spawns in wave 1
    minSpawnInterval: 0.4,           // fastest possible spawn rate
    spawnIntervalDecay: 0.12,        // seconds faster per wave

    // --- Walker Stats ---
    walker: {
        hp: {
            base: ZOMBIE_BASE_HP,
            perWave: 0.18,
            power: 1.15,
        },
        speed: {
            baseMin: 25,
            baseMax: 65,
            minGrowth: 3,
            maxGrowth: 5,
            absoluteMax: 140,
        },
        contactDamage: {
            base: ZOMBIE_CONTACT_DAMAGE,
            perWave: 0.06,
            power: 1.0,
        },
        breakDPS: {
            base: ZOMBIE_BREAK_DPS,
            perWave: 0.05,
            power: 1.0,
        },
    },

    // --- Flyer Stats (independent for future tuning) ---
    flyer: {
        hp: {
            base: ZOMBIE_BASE_HP,
            perWave: 0.18,
            power: 1.15,
        },
        speed: {
            baseMin: 50,
            baseMax: 130,
            minGrowth: 9,
            maxGrowth: 15,
            absoluteMax: 420,
        },
        contactDamage: {
            base: ZOMBIE_CONTACT_DAMAGE,
            perWave: 0.06,
            power: 1.0,
        },
        breakDPS: {
            base: ZOMBIE_BREAK_DPS,
            perWave: 0.05,
            power: 1.0,
        },
    },
};

// Shovel (starting melee weapon)
const SHOVEL_DAMAGE = 15;             // damage to zombies per swing (2 hits to kill wave 1)
const SHOVEL_BLOCK_DAMAGE = 50;       // damage to blocks per swing (earth=2 hits, brick=3)
const SHOVEL_SWING_DURATION = 0.3;    // seconds for swing animation
const SHOVEL_COOLDOWN = 0;            // no cooldown, swing duration is the full cycle
const SHOVEL_RANGE = 2.5;             // tiles ahead of player
const SHOVEL_KNOCKBACK = 180;         // pixels/sec knockback on zombie hit

// Flashlight
const FLASHLIGHT_BEAM_RANGE = 18;     // tiles - how far the beam reaches in facing direction
const FLASHLIGHT_BEAM_WIDTH = 8;      // tiles - beam width perpendicular to facing

// --- Wave Scaling Helper Functions ---
function waveScaleStat(config, waveNum) {
    const multiplier = Math.pow(1 + config.perWave * (waveNum - 1), config.power);
    return config.base * multiplier;
}

function waveZombieCount(waveNum) {
    return Math.floor(WAVE_CONFIG.baseZombieCount + WAVE_CONFIG.countGrowthRate * Math.pow(waveNum - 1, WAVE_CONFIG.countGrowthPower));
}

function waveSpawnInterval(waveNum) {
    return Math.max(WAVE_CONFIG.minSpawnInterval, WAVE_CONFIG.baseSpawnInterval - WAVE_CONFIG.spawnIntervalDecay * (waveNum - 1));
}

function waveSpeedRange(waveNum, typeConfig) {
    const spd = typeConfig || WAVE_CONFIG.walker.speed;
    const minSpd = spd.baseMin + spd.minGrowth * (waveNum - 1);
    const maxSpd = Math.min(spd.absoluteMax, spd.baseMax + spd.maxGrowth * (waveNum - 1));
    return { min: minSpd, max: Math.max(maxSpd, minSpd) }; // ensure max >= min
}
