// ============================================================
// ZOMBIE DEFENSE - Main (Game State, Update Loop, Init)
// ============================================================

// --- Weapon Inventory ---
const weapons = [];
let activeWeaponIndex = 0;

const SHOVEL_WEAPON = {
    name: 'Emergency Shovel',
    damage: SHOVEL_DAMAGE,
    blockDamage: SHOVEL_BLOCK_DAMAGE,
    speed: SHOVEL_SWING_DURATION,
    range: SHOVEL_RANGE,
    knockback: SHOVEL_KNOCKBACK,
    sprite: null,       // null = use built-in shovel drawing
    visualHeight: 1.35, // tiles
    colliderWidth: 0.3, // tiles (shovel blade width)
    colliderHeight: 0.4, // tiles (shovel blade height)
    colliderOffset: 0.95, // tiles (handle length before blade)
};

function getActiveWeapon() {
    return weapons[activeWeaponIndex] || SHOVEL_WEAPON;
}

function loadWeaponsFromStorage() {
    const prevActive = weapons[activeWeaponIndex];
    const prevName = prevActive ? prevActive.name : null;
    weapons.length = 0;
    weapons.push(SHOVEL_WEAPON);
    const saved = JSON.parse(localStorage.getItem('zd_weapons') || '[]');
    for (const data of saved) {
        const img = new Image();
        img.src = data.sprite;
        weapons.push({
            name: data.name,
            damage: data.damage,
            blockDamage: data.damage,
            speed: data.speed,
            range: data.range,
            knockback: SHOVEL_KNOCKBACK,
            sprite: img,
            visualHeight: data.visualHeight || 1.35,
            colliderWidth: data.colliderWidth || 0,
            colliderHeight: data.colliderHeight || 0,
            colliderOffset: data.colliderOffset || 0,
        });
    }
    // Preserve active weapon selection after reload
    if (prevName) {
        const idx = weapons.findIndex(w => w.name === prevName);
        activeWeaponIndex = idx >= 0 ? idx : 0;
    }
    weaponStorageCount = saved.length;
}

// Hot-reload: check localStorage for new weapons every 3 seconds
let weaponStorageCount = 0;
let weaponCheckTimer = 0;
const WEAPON_CHECK_INTERVAL = 3.0;

function checkForNewWeapons(dt) {
    weaponCheckTimer += dt;
    if (weaponCheckTimer < WEAPON_CHECK_INTERVAL) return;
    weaponCheckTimer = 0;
    const saved = JSON.parse(localStorage.getItem('zd_weapons') || '[]');
    if (saved.length !== weaponStorageCount) {
        loadWeaponsFromStorage();
    }
}

// --- Camera ---
const camera = { x: 0, y: 0, zoom: 1.25 };

function clampCamera() {
    const viewW = canvas.width / camera.zoom;
    const viewH = canvas.height / camera.zoom;
    const maxX = WORLD_W * TILE_SIZE - viewW;
    const maxY = WORLD_H * TILE_SIZE - viewH;
    camera.x = Math.max(0, Math.min(camera.x, maxX));
    camera.y = Math.max(0, Math.min(camera.y, maxY));
}

// --- Shared Game State ---
let gameOver = false;
let paused = false;
let points = 500;
let gameMode = 'player'; // 'player' or 'build'
let buildFlash = 0;
let gameTime = 0;
let lastTime = 0;
let hasUsedArtifact = false; // KJ counter appears after first artifact interaction
let interfaceOpen = false;   // true when any UI overlay is open (comms, crafting, etc.)
let commsOpen = false;       // true when comms tablet is visible
let craftingOpen = false;    // true when crafting interface is visible
let commsComplete = false;   // true after initial comms conversation finishes
let tutorialStep = 'none';  // 'none' | 'flashlight' | 'comms' | 'done'

// --- Artifact Interface State ---
const artifactUI = {
    open: false,
    firstTouch: true,       // true until player touches artifact for the first time
    flashTimer: 0,          // countdown for white flash on first touch
    // flashPhase: 'none' | 'white' | 'fade_to_game' | 'encroaching' | 'circles_fadein' | 'fade' (subsequent visits)
    flashPhase: 'none',
    hovered: -1,            // which circle is hovered (-1 = none, 0/1/2)
    encroachProgress: 0,    // 0..1 how much of screen is covered
    encroachDuration: 5,    // seconds for full encroachment
    circlesFadeIn: 0,       // 0..1 opacity of circles during fadein
    // Circle layout (computed on open, in screen pixels)
    circles: [],
    // Boot text (first-touch startup sequence)
    bootTextTimer: 0,       // elapsed time since encroaching started
    bootTextDone: false,    // true after first boot sequence completes
    bootFirstSession: true, // true until player closes artifact UI for the first time
};

function getArtifactUICircles() {
    const w = canvas.width;
    const h = canvas.height;
    const r = Math.min(w, h) * 0.16;
    const spread = w * 0.2;
    const topY = h * 0.32;
    const botY = h * 0.68;
    return [
        { x: w / 2,            y: topY, r: r },   // build mode (top)
        { x: w / 2 - spread,   y: botY, r: r },   // crafting (bottom-left)
        { x: w / 2 + spread,   y: botY, r: r },   // conduit (bottom-right)
    ];
}

function artifactUISelectCircle(index) {
    if (index === 0) {
        // Build mode
        artifactUI.open = false;
        artifactUI.hovered = -1;
        gameMode = 'build';
        buildFlash = 1.0;
    } else if (index === 1) {
        // Crafting interface
        artifactUI.open = false;
        artifactUI.hovered = -1;
        craftingOpen = true;
        interfaceOpen = true;
    } else if (index === 2) {
        // Conduit - start wave
        if (wave.state === 'idle' && !artifactCorrupted) {
            artifactUI.open = false;
            artifactUI.hovered = -1;
            startWave();
        }
    }
}

// --- Update ---
function update(dt) {
    // Hot-reload crafted weapons from localStorage
    checkForNewWeapons(dt);

    // Comms system always ticks (timed sequences need dt even during intro)
    updateComms(dt);

    // Intro sequence: only run intro logic, skip normal gameplay
    if (intro.active) {
        updateIntro(dt);
        return;
    }

    // Game over: only tick particles for visual effect, freeze everything else
    if (gameOver) {
        updateParticles(dt);
        if (artifactPulse > 0) artifactPulse -= dt * 0.8;
        return;
    }

    // Wave system tick
    updateWaveSystem(dt);

    // Tick invuln timer
    if (player.invulnTimer > 0) player.invulnTimer -= dt;
    if (player.damageFlash > 0) player.damageFlash -= dt;
    if (buildFlash > 0) buildFlash -= dt * 2.0;
    // Artifact UI flash sequence
    if (artifactUI.flashPhase === 'white') {
        artifactUI.flashTimer -= dt;
        if (artifactUI.flashTimer <= 0) {
            if (!artifactUI.bootTextDone) {
                // First touch: white → boot text
                artifactUI.flashPhase = 'boot_text';
                artifactUI.bootTextTimer = 0;
            } else {
                // Subsequent: white → fade to interface
                artifactUI.flashPhase = 'fade';
                artifactUI.flashTimer = 1.5;
            }
        }
    } else if (artifactUI.flashPhase === 'boot_text') {
        artifactUI.bootTextTimer += dt;
        // 9 entries * (0.75s type + 0.3s gap) + 1.0s pause before SUCCESSFUL + buffer
        const bootTotalDuration = 9 * 1.05 + 1.0 + 0.5;
        if (artifactUI.bootTextTimer >= bootTotalDuration) {
            artifactUI.bootTextDone = true;
            artifactUI.flashPhase = 'circles_fadein';
            artifactUI.flashTimer = 1.0;
            artifactUI.circlesFadeIn = 0;
        }
    } else if (artifactUI.flashPhase === 'circles_fadein') {
        artifactUI.circlesFadeIn += dt;
        // 3 circles staggered: 0s, 0.8s, 1.6s start, each takes 1.2s to fade in
        const totalDuration = 1.6 + 1.2; // last circle start + its fade duration
        if (artifactUI.circlesFadeIn >= totalDuration) {
            artifactUI.circlesFadeIn = totalDuration;
            artifactUI.flashPhase = 'none';
            artifactUI.bootTextDone = true;
            artifactUI.open = true; // now fully interactive
        }
    } else if (artifactUI.flashPhase === 'fade') {
        artifactUI.flashTimer -= dt;
        if (artifactUI.flashTimer <= 0) {
            artifactUI.flashPhase = 'none';
            artifactUI.flashTimer = 0;
        }
    }
    // Health regen
    if (!player.dead && player.hp < PLAYER_MAX_HP) {
        player.hp = Math.min(PLAYER_MAX_HP, player.hp + 15 * dt);
    }
    // Artifact corruption / regen
    if (artifactPulse > 0) artifactPulse -= dt * 0.8;
    if (artifactCorrupted) {
        if (artifactCorruptTimer > 0) {
            artifactCorruptTimer -= dt;
        } else {
            artifactHP = Math.min(ARTIFACT_MAX_HP, artifactHP + ARTIFACT_REGEN * dt);
            if (artifactHP >= ARTIFACT_MAX_HP) {
                artifactCorrupted = false;
                artifactPulse = 1.0;
                artifactPulseColor = [100, 210, 255];
            }
        }
    } else if (artifactHP < ARTIFACT_MAX_HP) {
        artifactHP = Math.min(ARTIFACT_MAX_HP, artifactHP + ARTIFACT_REGEN * dt);
    }

    updatePlayer(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateParticles(dt);

    // Camera follows player in player mode
    if (gameMode === 'player') {
        const targetX = player.x - (canvas.width / camera.zoom) / 2;
        const targetY = (player.y - player.h / 2) - (canvas.height / camera.zoom) / 2;
        camera.x += (targetX - camera.x) * Math.min(1, 8 * dt);
        camera.y += (targetY - camera.y) * Math.min(1, 8 * dt);
    }

    clampCamera();
}

// --- Game Loop ---
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    if (!gameOver && !paused) gameTime += dt;

    if (!paused) update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// --- Init ---
loadWeaponsFromStorage();
generateWorld();
buildAllChunks();
computeFlowField();

// Place player near artifact (TODO: rebuild spawn flattening later)
{
    const spawnTX = PEDESTAL_CENTER_X + 5;
    const groundY = getGroundHeight(spawnTX);
    player.x = (spawnTX + 0.5) * TILE_SIZE;
    player.y = groundY * TILE_SIZE;
}

// Start camera centered on player (account for zoom)
camera.x = player.x - (canvas.width / camera.zoom) / 2;
camera.y = (player.y - player.h / 2) - (canvas.height / camera.zoom) / 2;
clampCamera();
requestAnimationFrame(gameLoop);
