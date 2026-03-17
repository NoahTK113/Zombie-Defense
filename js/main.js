// ============================================================
// ZOMBIE DEFENSE - Main (Game State, Update Loop, Init)
// ============================================================

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

// --- Local State (per-frame timers, not in gameState) ---
let buildFlash = 0;
let gameTime = 0;
let lastTime = 0;

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
    if (gameState.gameOver) {
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
    // Health regen
    if (!player.dead && player.hp < PLAYER_MAX_HP) {
        player.hp = Math.min(PLAYER_MAX_HP, player.hp + 15 * dt);
    }
    // Artifact UI flash sequence + corruption/regen
    updateArtifact(dt);

    updatePlayer(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateParticles(dt);

    // Camera follows player in player mode
    if (gameState.gameMode === 'player') {
        const targetX = player.x - (canvas.width / camera.zoom) / 2;
        const targetY = (player.y - player.h / 2) - (canvas.height / camera.zoom) / 2;
        camera.x += (targetX - camera.x) * Math.min(1, CAMERA_FOLLOW_SPEED * dt);
        camera.y += (targetY - camera.y) * Math.min(1, CAMERA_FOLLOW_SPEED * dt);
    }

    clampCamera();
}

// --- Game Loop ---
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    if (!gameState.gameOver && !gameState.paused) gameTime += dt;

    if (!gameState.paused) update(dt);
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
    const spawnTX = ARTIFACT_CENTER_X + 5;
    const groundY = getGroundHeight(spawnTX);
    player.x = (spawnTX + 0.5) * TILE_SIZE;
    player.y = groundY * TILE_SIZE;
}

// Start camera centered on player (account for zoom)
camera.x = player.x - (canvas.width / camera.zoom) / 2;
camera.y = (player.y - player.h / 2) - (canvas.height / camera.zoom) / 2;
clampCamera();
requestAnimationFrame(gameLoop);
