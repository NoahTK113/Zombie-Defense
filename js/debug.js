// ============================================================
// ZOMBIE DEFENSE - Debug (Developer-only key bindings)
// ============================================================

function handleDebugKeys(e) {
    // F1: Force artifact corruption
    if (e.code === 'F1') {
        if (!gameState.artifactCorrupted) {
            gameState.artifactHP = 0;
            gameState.artifactCorrupted = true;
            artifactCorruptTimer = ARTIFACT_CORRUPT_NO_REGEN;
            artifactPulse = 1.0;
            artifactPulseColor = [255, 40, 40];
            if (gameState.gameMode === 'build') { gameState.gameMode = 'player'; if (camera.zoom < MIN_ZOOM_PLAYER) camera.zoom = MIN_ZOOM_PLAYER; }
            if (player.dead) gameState.gameOver = true;
        }
    }
    // F2: Skip comms/tutorial
    if (e.code === 'F2') {
        gameState.commsRelayDone = true;
        gameState.commsComplete = true;
        gameState.tutorialStep = 'done';
        if (gameState.commsOpen) { gameState.commsOpen = false; }
        comms.lines = [];
        comms.choices = null;
        comms.queue = [];
        comms.inputLocked = false;
    }
    // F3: Skip artifact intro (boot text + circles)
    if (e.code === 'F3') {
        artifactUI.firstTouch = false;
        artifactUI.flashPhase = 'none';
        artifactUI.flashTimer = 0;
        artifactUI.circlesFadeIn = 10;
        artifactUI.open = false;
        artifactUI.bootTextDone = true;
        artifactUI.bootFirstSession = false;
        gameState.hasUsedArtifact = true;
    }
    // F4: Instant start wave
    if (e.code === 'F4') {
        if (gameState.waveState === 'idle' && !gameState.artifactCorrupted) {
            advanceWave();
        }
    }
    // F5: Skip/start wave
    if (e.code === 'F5') {
        if (gameState.waveState === 'active') {
            zombies.length = 0;
            wave.zombiesSpawned = wave.zombiesTotal;
            gameState.waveState = 'idle';
            playSound('waveComplete');
        } else if (gameState.waveState === 'idle') {
            advanceWave();
        }
    }
    // F6: Force respawn
    if (e.code === 'F6') {
        if (player.dead) { respawnPlayer(); gameState.gameOver = false; }
    }
    // F7: Restore artifact
    if (e.code === 'F7') {
        gameState.artifactCorrupted = false;
        gameState.artifactHP = ARTIFACT_MAX_HP;
        artifactCorruptTimer = 0;
        gameState.gameOver = false;
    }
    // F8: Toggle zombie player targeting
    if (e.code === 'F8') { gameState.debugNoTargetPlayer = !gameState.debugNoTargetPlayer; }
    // F9: Clear crafted weapons
    if (e.code === 'F9') {
        localStorage.removeItem('zd_weapons');
        weapons.length = 0;
        weapons.push(SHOVEL_WEAPON);
        activeWeaponIndex = 0;
        weaponStorageCount = 0;
    }
    // F10: Add 1000 KJ
    if (e.code === 'F10') {
        gameState.points += 1000;
    }
    // F11: Toggle flow field debug display
    if (e.code === 'F11') {
        e.preventDefault();
        gameState.debugShowFlowField = !gameState.debugShowFlowField;
    }
    // Backquote (`): Toggle melee collider debug overlay
    if (e.code === 'Backquote') {
        gameState.debugShowColliders = !gameState.debugShowColliders;
    }
    // Ctrl+S: Save world
    if (e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault();
        saveWorld();
    }
    // Ctrl+L: Load world
    if (e.ctrlKey && e.code === 'KeyL') {
        e.preventDefault();
        loadWorld();
    }
}
