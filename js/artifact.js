// ============================================================
// ZOMBIE DEFENSE - Artifact (Hub, Corruption, UI, Building Mode)
// ============================================================

// --- Artifact Working State (per-frame timers / UI animation — NOT in gameState) ---
let artifactCorruptTimer = 0;        // counts down from 60s (no regen phase)
const ARTIFACT_CORRUPT_NO_REGEN = 60; // 1 minute of no regen
let artifactPulse = 0;              // radial pulse intensity (1→0)
let artifactPulseColor = [255, 40, 40]; // red or blue

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

// Advance to next wave: increment number, set active, init spawns.
// Artifact owns wave initiation; zombies just reads gameState.waveNumber.

function advanceWave() {
    gameState.waveNumber++;
    gameState.waveState = 'active';
    gameState.waveCountdown = 0;
    initWaveSpawns();
    playSound('waveStart');
}

function artifactUISelectCircle(index) {
    if (index === 0) {
        // Build mode
        artifactUI.open = false;
        artifactUI.hovered = -1;
        gameState.gameMode = 'build';
        buildFlash = 1.0;
    } else if (index === 1) {
        // Crafting interface
        artifactUI.open = false;
        artifactUI.hovered = -1;
        gameState.craftingOpen = true;
    } else if (index === 2) {
        // Conduit - wave advancement
        if (gameState.artifactCorrupted) return;
        if (gameState.waveState === 'idle') {
            // Start first wave or resume auto-advance
            artifactUI.open = false;
            artifactUI.hovered = -1;
            gameState.waveAutoAdvance = true;
            advanceWave();
        } else if (gameState.waveState === 'countdown') {
            // Pause auto-advance
            artifactUI.open = false;
            artifactUI.hovered = -1;
            gameState.waveAutoAdvance = false;
            gameState.waveState = 'idle';
            gameState.waveCountdown = 0;
        } else if (gameState.waveState === 'active') {
            // Toggle auto-advance off during active wave
            artifactUI.open = false;
            artifactUI.hovered = -1;
            gameState.waveAutoAdvance = !gameState.waveAutoAdvance;
        }
    }
}

function isNearArtifact() {
    const artifactCX = (ARTIFACT_CENTER_X + 0.5) * TILE_SIZE;
    const artifactCY = (ARTIFACT_TY + ARTIFACT_SIZE / 2) * TILE_SIZE;
    const dx = player.x - artifactCX;
    const dy = (player.y - player.h / 2) - artifactCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (ARTIFACT_SIZE / 2 + 2) * TILE_SIZE;
}

// --- Artifact Input Handlers (called by input.js router) ---
function artifactHandleKey(code) {
    // ESC closes artifact UI unconditionally (matches crafting behavior)
    if (code === 'Escape' && artifactUI.open) {
        artifactUI.open = false;
        artifactUI.hovered = -1;
        artifactUI.flashPhase = 'none';
        artifactUI.bootFirstSession = false;
        return;
    }
    if (code !== 'KeyE') return;
    if (player.dead || gameState.artifactCorrupted || gameState.gameOver || gameState.commsOpen || gameState.craftingOpen || !gameState.commsComplete) return;

    // Block E during intro sequence
    const inSequence = artifactUI.flashPhase === 'circles_fadein' || artifactUI.flashPhase === 'white';
    if (inSequence) {
        // Do nothing, sequence is playing out
    } else if (artifactUI.open) {
        // Close artifact interface
        artifactUI.open = false;
        artifactUI.hovered = -1;
        artifactUI.flashPhase = 'none';
        artifactUI.bootFirstSession = false;
    } else if (gameState.gameMode === 'player' && isNearArtifact()) {
        gameState.hasUsedArtifact = true;
        if (artifactUI.firstTouch) {
            // First touch: white flash → boot text → circles
            artifactUI.firstTouch = false;
            artifactUI.open = true;
            player.vx = 0;
            player.vy = 0;
            artifactUI.flashPhase = 'white';
            artifactUI.flashTimer = 0.5;
        } else {
            // Subsequent: open interface directly
            player.vx = 0;
            player.vy = 0;
            artifactUI.open = true;
            artifactUI.hovered = -1;
        }
    } else if (gameState.gameMode === 'build') {
        gameState.gameMode = 'player';
        buildFlash = 1.0;
        if (camera.zoom < MIN_ZOOM_PLAYER) {
            camera.zoom = MIN_ZOOM_PLAYER;
        }
    }
}

function artifactHandleClick(x, y) {
    if (artifactUI.flashPhase === 'none') {
        const circles = getArtifactUICircles();
        for (let i = 0; i < circles.length; i++) {
            const dx = x - circles[i].x;
            const dy = y - circles[i].y;
            if (dx * dx + dy * dy <= circles[i].r * circles[i].r) {
                artifactUISelectCircle(i);
                break;
            }
        }
    }
}

function artifactHandleMouseMove(x, y) {
    if (artifactUI.open && artifactUI.flashPhase === 'none') {
        const circles = getArtifactUICircles();
        artifactUI.hovered = -1;
        for (let i = 0; i < circles.length; i++) {
            const dx = x - circles[i].x;
            const dy = y - circles[i].y;
            if (dx * dx + dy * dy <= circles[i].r * circles[i].r) {
                artifactUI.hovered = i;
                break;
            }
        }
    }
}

// --- Build Mode Handlers (called by input.js router) ---
function doBuildAction(tx, ty) {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;
    const t = tileAt(tx, ty);
    if (t === TILE.AIR && !playerOccupiesTile(tx, ty) && gameState.points >= 50) {
        setTile(tx, ty, TILE.BRICK);
        dirtyTile(tx, ty);
        gameState.points -= 50;
        playSound('blockPlace');
    } else if (t === TILE.EARTH && gameState.points >= 50) {
        setTile(tx, ty, TILE.AIR);
        dirtyTile(tx, ty);
        gameState.points -= 50;
        playSound('blockDig');
    } else if (t === TILE.BRICK) {
        setTile(tx, ty, TILE.AIR);
        dirtyTile(tx, ty);
        gameState.points += 50;
        playSound('blockDig');
    }
}

function buildHandleClick(mx, my) {
    const tile = screenToTile(mx, my);
    doBuildAction(tile.x, tile.y);
    mouse.lastBuildTX = tile.x;
    mouse.lastBuildTY = tile.y;
}

function buildHandleDrag(mx, my) {
    const tile = screenToTile(mx, my);
    if (tile.x !== mouse.lastBuildTX || tile.y !== mouse.lastBuildTY) {
        doBuildAction(tile.x, tile.y);
        mouse.lastBuildTX = tile.x;
        mouse.lastBuildTY = tile.y;
    }
}

// --- Corruption Trigger (called by zombies when absorption completes) ---
function artifactOnZombieAbsorbed() {
    if (!gameState.artifactCorrupted) {
        gameState.artifactHP = Math.max(0, gameState.artifactHP - ARTIFACT_ABSORB_DAMAGE);
        if (gameState.artifactHP <= 0) {
            gameState.artifactCorrupted = true;
            artifactCorruptTimer = ARTIFACT_CORRUPT_NO_REGEN;
            artifactPulse = 1.0;
            artifactPulseColor = [255, 40, 40];
            // Force out of build mode
            if (gameState.gameMode === 'build') {
                gameState.gameMode = 'player';
                if (camera.zoom < MIN_ZOOM_PLAYER) camera.zoom = MIN_ZOOM_PLAYER;
            }
            // If player already dead, instant game over
            if (player.dead) {
                gameState.gameOver = true;
            }
        }
    }
}

// --- Artifact Update (UI flash sequence + corruption/regen) ---
function updateArtifact(dt) {
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
        }
    } else if (artifactUI.flashPhase === 'fade') {
        artifactUI.flashTimer -= dt;
        if (artifactUI.flashTimer <= 0) {
            artifactUI.flashPhase = 'none';
            artifactUI.flashTimer = 0;
        }
    }

    // Artifact corruption / regen
    if (artifactPulse > 0) artifactPulse -= dt * 0.8;
    if (gameState.artifactCorrupted) {
        if (artifactCorruptTimer > 0) {
            artifactCorruptTimer -= dt;
        } else {
            gameState.artifactHP = Math.min(ARTIFACT_MAX_HP, gameState.artifactHP + ARTIFACT_REGEN * dt);
            if (gameState.artifactHP >= ARTIFACT_MAX_HP) {
                gameState.artifactCorrupted = false;
                artifactPulse = 1.0;
                artifactPulseColor = [100, 210, 255];
                // Revert all zombies to artifact flow field
                for (const z of zombies) {
                    z.usePlayerField = false;
                }
            }
        }
    } else if (gameState.artifactHP < ARTIFACT_MAX_HP) {
        gameState.artifactHP = Math.min(ARTIFACT_MAX_HP, gameState.artifactHP + ARTIFACT_REGEN * dt);
    }
}
