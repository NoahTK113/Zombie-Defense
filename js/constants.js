// ============================================================
// ZOMBIE DEFENSE - Constants & Configuration
// ============================================================

// --- World ---
const TILE_SIZE = 20;
const TILE_TEXELS = 60; // render resolution per tile (3x TILE_SIZE, matches max zoom)
const WORLD_W = 640;   // tiles wide (~10x viewport width)
const WORLD_H = 205;   // tiles tall (70 sky + 1 grass + 134 earth)
const GROUND_LEVEL = 70; // row index where ground surface sits

// Tile types
const TILE = {
    AIR: 0,
    EARTH: 1,
    BRICK: 2,
    ARTIFACT: 3,
    CONCRETE: 4,
    STEEL: 5,
    MATERIAL_X: 6,
    MATERIAL_Y: 7,
};

// Artifact constants
const ARTIFACT_SIZE = 5; // tiles
const ARTIFACT_PX = ARTIFACT_SIZE * TILE_SIZE;
const ARTIFACT_TX = Math.floor(WORLD_W / 2) - 2; // tile x start
const ARTIFACT_TY = GROUND_LEVEL - ARTIFACT_SIZE; // tile y start
const ARTIFACT_CENTER_X = ARTIFACT_TX + Math.floor(ARTIFACT_SIZE / 2); // tile 320

// Lighting constants (tunable)
const LIGHT_RADIUS = 25;     // tiles - full bright zone around artifact
const LIGHT_FALLOFF = 15;    // tiles - transition from bright to dark
const LIGHT_DARKNESS = 0.85; // max overlay opacity in dark areas (0-1)
const LIGHT_AMBIENT = 0.08;  // global ambient - reduces darkness slightly everywhere

// Zombie constants (tunable)

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
const FLYER_WALL_MULT = 1.8;           // soft wall penalty: penaltyAccel = flyerAccel * this

// Shooting constants (tunable)
const PISTOL_FIRE_RATE = 0.067;         // seconds between shots (3x faster)
const PISTOL_DAMAGE = 3;                // damage per bullet
const BULLET_SPEED = 3200;              // pixels/sec (doubled)
const BULLET_RADIUS = 2;                // bullet visual radius in pixels
const PISTOL_PENETRATION = 2;           // number of zombies a bullet can hit

// Player combat constants
const PLAYER_MAX_HP = 100;              // player max health
const ZOMBIE_CONTACT_DAMAGE = 30;       // damage per zombie touch
const PLAYER_INVULN_TIME = 0.5;         // seconds of invulnerability after hit
const PLAYER_DAMAGE_KNOCKBACK = 50;    // pixels/sec knockback impulse when hit
const PLAYER_RESPAWN_TIME = 10;         // seconds to respawn after death

// Artifact health
const ARTIFACT_MAX_HP = 200;
const ARTIFACT_ABSORB_DAMAGE = 100;     // damage per zombie absorbed
const ARTIFACT_REGEN = 5;              // HP/sec regen (4x)

// Death particle constants
const DEATH_PARTICLE_COUNT = 14;         // pieces per zombie death
const DEATH_PARTICLE_LIFE = 1.5;        // seconds particles live

// Physics
const GRAVITY = 800; // pixels/sec^2
const INTRO_SPAWN_OFFSET = 250; // tiles to the right of artifact (near world edge)

// Camera
const CAMERA_FOLLOW_SPEED = 4;         // lerp factor for player tracking (higher = tighter)

// Camera zoom limits
const MIN_ZOOM_BUILD = 0.65;
const MIN_ZOOM_PLAYER = 1.7;
const MAX_ZOOM = 3.0;

// ============================================================
// WAVE SYSTEM CONFIG (CoD Zombies style)
// ============================================================
const WAVE_COUNTDOWN_SECONDS = 60;   // intermission between waves

const WAVE_CONFIG = {
    // --- Zombie Count ---
    baseZombieCount: 5,              // zombies in wave 1
    // Formula: floor(baseZombieCount + countGrowthRate * (wave-1)^countGrowthPower)
    countGrowthRate: 2.5,
    countGrowthPower: 1.35,

    // --- Type Ratio ---
    flyerRatio: 0.67,                // 2/3 of each wave are flyers

    // --- Role & Trait Ratios ---
    hunterRatio: 0.40,               // fraction of spawns that target player only
    breakerRatio: 0.10,              // fraction of spawns with breaker trait (straight-line, breaks on contact)

    // --- Spawn Rate ---
    baseSpawnInterval: 3.0,          // seconds between spawns in wave 1
    minSpawnInterval: 0.1,           // fastest possible spawn rate
    spawnIntervalDecay: 0.1,         // seconds faster per wave
    maxZombiesAlive: 35,             // max zombies on map at once; spawning pauses until kills

    // --- Walker Stats ---
    walker: {
        hp: {
            base: ZOMBIE_BASE_HP,
            perWave: 1.0,
            power: 1.0,
        },
        speed: {
            baseMin: 60,
            baseMax: 65,
            minGrowth: 3,
            maxGrowth: 5,
            absoluteMax: 140,
        },
        contactDamage: {
            base: ZOMBIE_CONTACT_DAMAGE,
            perWave: 0.0,
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
            perWave: 1.0,
            power: 1.0,
        },
        speed: {
            baseMin: 30,
            baseMax: 50,
            minGrowth: 5,
            maxGrowth: 10,
            absoluteMax: 300,
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
const SHOVEL_DAMAGE = 75;             // damage to zombies per swing (2 HTK wave 1)
const SHOVEL_BLOCK_DAMAGE = 50;       // damage to blocks per swing (earth=2 hits, brick=3)
const SHOVEL_SWING_DURATION = 0.35;   // seconds for swing animation
const SHOVEL_COOLDOWN = 0;            // no cooldown, swing duration is the full cycle
const SHOVEL_RANGE = 2.5;             // tiles ahead of player
const SHOVEL_KNOCKBACK = 300;         // knockback impulse
const SHOVEL_VISUAL_HEIGHT = 1.35;    // tiles
const SHOVEL_COLLIDER_WIDTH = 0.3;    // tiles (shovel blade width)
const SHOVEL_COLLIDER_HEIGHT = 0.4;   // tiles (shovel blade height)
const SHOVEL_COLLIDER_OFFSET = 0.95;  // tiles (handle length before blade)

// Melee Constants
const IRON_DAMAGE_PER_CELL = 75;       // damage contribution per iron cell (2 HTK = 1 wave of dominance)
const MELEE_BASE_KNOCKBACK = 300;     // base knockback added to all crafted melee weapons
const MELEE_KNOCKBACK_COEFF = 22;     // tunable: knockback = base + coeff * sqrt(swingWeight) * range
const KNOCKBACK_BASE_DECAY = 200;     // px/s² - minimum constant deceleration during knockback
const KNOCKBACK_DRAG = 0.7;           // velocity-proportional drag (higher = faster decel at high speeds)
const KNOCKBACK_WALL_MIN_SPEED = 450; // px/s - minimum knockback speed to take wall impact damage
const KNOCKBACK_WALL_DMG_COEFF = 0.5; // damage per px/s of knockback speed on wall impact
const MELEE_COLLIDER_TIP_BUFFER = 0.3; // tiles - fixed extension past weapon tip
const MELEE_HIT_PADDING = 8;           // px - expands zombie AABB for melee hit detection only (0=4px inside skin)
const MELEE_SWING_SPEED_MULT = 0.7;    // global swing duration multiplier (lower = faster)
const MELEE_MIN_SWING_DURATION = 0.15; // seconds - floor so tiny weapons aren't instant
const MELEE_SWING_ARC = 230 * Math.PI / 180; // total swing arc in radians (230°)
const MELEE_SAME_DIR_COOLDOWN = 1.0;   // multiplier on swing duration for same-direction cooldown
const SCREEN_SHAKE_INTENSITY = 3;      // pixels - max random offset per axis on melee hit
const SCREEN_SHAKE_DURATION = 0.12;    // seconds - how long shake lasts per hit

// Dash / Thruster
const DASH_ACCEL = 9000;                // px/sec² - acceleration while boosting
const DASH_FUEL_MAX = 1500;             // max fuel
const DASH_FUEL_CONSUME = 1800;         // fuel consumed per second while boosting
const DASH_BURST_COST = 150;            // fuel consumed per burst before requiring re-press
const DASH_FUEL_REGEN = 300;            // fuel regenerated per second (always, unless empty cooldown)
const DASH_EMPTY_COOLDOWN = .1;       // seconds before regen starts after fuel hits 0

// Dash-strike (melee hit while dashing or in post-dash slowdown)
const DASH_STRIKE_DAMAGE_MULT = 1.5;    // damage multiplier on dash-strike hits
const DASH_STRIKE_KNOCKBACK_MULT = 1.5; // knockback multiplier (1.5x normal)
const DASH_STRIKE_INVULN = 0.15;        // seconds of invulnerability granted per dash-strike hit

// Dash slowdown (constant decel when |V| > target and not actively dashing)
const DASH_SLOW_TARGET = 195;          // px/sec - decelerate back to this speed after dashing
const DASH_SLOW_DECEL = 8000;           // px/sec² - constant deceleration rate
const DASH_SLOW_SNAP = 0;            // px/sec - snap to target when excess drops below this

// Flashlight
const FLASHLIGHT_BEAM_RANGE = 18;     // tiles - how far the beam reaches in facing direction
const FLASHLIGHT_BEAM_WIDTH = 8;      // tiles - beam width perpendicular to facing

// --- Debug Toggles ---
const DEBUG_SHOW_ZOMBIE_COUNT = true;  // show zombie count overlay on HUD

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
