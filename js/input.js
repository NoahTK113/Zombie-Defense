// ============================================================
// ZOMBIE DEFENSE - Input (Keyboard, Mouse, Build Actions)
// ============================================================

const keys = {};
const mouse = { x: 0, y: 0, leftDown: false, rightDown: false, justClicked: false, dragStartX: 0, dragStartY: 0, camStartX: 0, camStartY: 0, lastBuildTX: -1, lastBuildTY: -1 };
let flashlightOn = false;

function isNearArtifact() {
    const artifactCX = (PEDESTAL_CENTER_X + 0.5) * TILE_SIZE;
    const artifactCY = (ARTIFACT_TY + ARTIFACT_SIZE / 2) * TILE_SIZE;
    const dx = player.x - artifactCX;
    const dy = (player.y - player.h / 2) - artifactCY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (ARTIFACT_SIZE / 2 + 2) * TILE_SIZE;
}

function screenToTile(sx, sy) {
    const tileScreen = Math.max(1, Math.round(TILE_SIZE * camera.zoom));
    const effectiveZoom = tileScreen / TILE_SIZE;
    const worldX = camera.x + sx / effectiveZoom;
    const worldY = camera.y + sy / effectiveZoom;
    return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
}

// Build action: place/dig/break at a tile (shared by click and drag)
function doBuildAction(tx, ty) {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return;
    const t = tileAt(tx, ty);
    if (t === TILE.AIR && !playerOccupiesTile(tx, ty) && points >= 50) {
        setTile(tx, ty, TILE.BRICK);
        dirtyTile(tx, ty);
        points -= 50;
    } else if (t === TILE.EARTH && points >= 50) {
        setTile(tx, ty, TILE.AIR);
        dirtyTile(tx, ty);
        points -= 50;
    } else if (t === TILE.BRICK) {
        setTile(tx, ty, TILE.AIR);
        dirtyTile(tx, ty);
    }
}

window.addEventListener('keydown', e => {
    keys[e.code] = true;

    // Block browser F-key defaults when game has focus
    if (e.code.startsWith('F') && !isNaN(e.code.slice(1))) e.preventDefault();

    // --- Crafting input handling (when crafting is open, capture keys) ---
    if (craftingOpen) {
        if (e.code === 'Escape' || e.code === 'KeyE') {
            e.preventDefault();
            craftingOpen = false;
            interfaceOpen = false;
            craft.mouseDown = false;
            craft.mouseRightDown = false;
            return;
        }
        craftKeyDown(e.code);
        return;
    }

    // --- Comms input handling (when comms is open, capture keys) ---
    if (commsOpen) {
        if (e.code === 'Tab') {
            e.preventDefault();
            if (!comms.inputLocked) {
                commsOpen = false;
                interfaceOpen = false;
            }
            return;
        }
        commsHandleInput(e.code);
        return;
    }

    // --- Tab: open comms device ---
    if (e.code === 'Tab') {
        e.preventDefault();
        if (!intro.active && !gameOver) {
            commsOpen = true;
            interfaceOpen = true;
            if (tutorialStep === 'comms') tutorialStep = 'done';
            if (!commsRelayDone) { commsStartRelaySequence(); }
        }
        return;
    }

    // --- Intro-specific key handling ---
    if (intro.active) {
        if (e.code === 'KeyE' && intro.phase === 'standup_prompt') {
            intro.phase = 'standing';
            intro.standTimer = 0;
        }
        // Debug: press F1 to skip intro entirely
        if (e.code === 'F1') {
            intro.active = false;
            intro.phase = 'done';
            commsOpen = false;
            interfaceOpen = false;
            intro.fadeOpacity = 0;
            commsRelayDone = true;
            commsComplete = true;
            tutorialStep = 'done';
        }
        return;
    }

    // Block all input during boot text sequence
    if (artifactUI.flashPhase === 'boot_text') return;

    if (e.code === 'Escape' && !gameOver) {
        paused = !paused;
        return;
    }
    if (e.code === 'KeyF' && !player.dead && !gameOver && !interfaceOpen) {
        flashlightOn = !flashlightOn;
        if (tutorialStep === 'flashlight') tutorialStep = 'comms';
    }
    if (e.code === 'KeyQ' && !player.dead && !gameOver && !interfaceOpen && weapons.length > 1) {
        activeWeaponIndex = (activeWeaponIndex + 1) % weapons.length;
    }
    if (e.code === 'KeyE' && !player.dead && !artifactCorrupted && !gameOver && !interfaceOpen && commsComplete) {
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
        } else if (gameMode === 'player' && isNearArtifact()) {
            hasUsedArtifact = true;
            if (artifactUI.firstTouch) {
                // First touch: white flash → boot text → circles
                artifactUI.firstTouch = false;
                artifactUI.flashPhase = 'white';
                artifactUI.flashTimer = 0.5;
            } else {
                // Subsequent: open interface directly
                player.vx = 0;
                player.vy = 0;
                artifactUI.open = true;
                artifactUI.hovered = -1;
            }
        } else if (gameMode === 'build') {
            gameMode = 'player';
            buildFlash = 1.0;
            if (camera.zoom < MIN_ZOOM_PLAYER) {
                camera.zoom = MIN_ZOOM_PLAYER;
            }
        }
    }
    // Debug keys (F1-F9)
    if (e.code === 'F1') {
        if (!artifactCorrupted) {
            artifactHP = 0;
            artifactCorrupted = true;
            artifactCorruptTimer = ARTIFACT_CORRUPT_NO_REGEN;
            artifactPulse = 1.0;
            artifactPulseColor = [255, 40, 40];
            if (gameMode === 'build') { gameMode = 'player'; if (camera.zoom < MIN_ZOOM_PLAYER) camera.zoom = MIN_ZOOM_PLAYER; }
            if (player.dead) gameOver = true;
        }
    }
    if (e.code === 'F2') {
        commsRelayDone = true;
        commsComplete = true;
        tutorialStep = 'done';
        if (commsOpen) { commsOpen = false; interfaceOpen = false; }
        comms.lines = [];
        comms.choices = null;
        comms.queue = [];
        comms.inputLocked = false;
    }
    if (e.code === 'F3') {
        // Skip artifact intro (boot text + circles)
        artifactUI.firstTouch = false;
        artifactUI.flashPhase = 'none';
        artifactUI.flashTimer = 0;
        artifactUI.circlesFadeIn = 10;
        artifactUI.open = false;
        artifactUI.bootTextDone = true;
        artifactUI.bootFirstSession = false;
        hasUsedArtifact = true;
    }
    if (e.code === 'F4') {
        // Instant start wave (no need to visit artifact)
        if (wave.state === 'idle' && !artifactCorrupted) {
            startWave();
        }
    }
    if (e.code === 'F5') {
        if (wave.state === 'active') {
            zombies.length = 0;
            wave.zombiesSpawned = wave.zombiesTotal;
            completeWave();
        } else if (wave.state === 'idle') {
            startWave();
        }
    }
    if (e.code === 'F6') {
        if (player.dead) { respawnPlayer(); gameOver = false; }
    }
    if (e.code === 'F7') {
        artifactCorrupted = false;
        artifactHP = ARTIFACT_MAX_HP;
        artifactCorruptTimer = 0;
        gameOver = false;
    }
    if (e.code === 'F8') { debugNoTargetPlayer = !debugNoTargetPlayer; }
    if (e.code === 'F9') {
        // Clear all crafted weapons from inventory and localStorage
        localStorage.removeItem('zd_weapons');
        weapons.length = 0;
        weapons.push(SHOVEL_WEAPON);
        activeWeaponIndex = 0;
        weaponStorageCount = 0;
    }
    if (e.code === 'F10') {
        points += 1000;
    }
    if (e.code === 'F11') {
        e.preventDefault();
        debugShowFlowField = !debugShowFlowField;
    }
    // World save/load
    if (e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault();
        saveWorld();
    }
    if (e.ctrlKey && e.code === 'KeyL') {
        e.preventDefault();
        loadWorld();
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    // Crafting interface mouse handling
    if (craftingOpen) {
        craftMouseMove(mouse.x, mouse.y);
        canvas.style.cursor = 'default';
        return;
    }

    // Artifact UI hover detection
    if (artifactUI.open && artifactUI.flashPhase === 'none') {
        const circles = getArtifactUICircles();
        artifactUI.hovered = -1;
        for (let i = 0; i < circles.length; i++) {
            const dx = mouse.x - circles[i].x;
            const dy = mouse.y - circles[i].y;
            if (dx * dx + dy * dy <= circles[i].r * circles[i].r) {
                artifactUI.hovered = i;
                break;
            }
        }
    }

    // Left-click drag to place/dig (build mode only)
    if (mouse.leftDown && gameMode === 'build') {
        const tile = screenToTile(mouse.x, mouse.y);
        if (tile.x !== mouse.lastBuildTX || tile.y !== mouse.lastBuildTY) {
            doBuildAction(tile.x, tile.y);
            mouse.lastBuildTX = tile.x;
            mouse.lastBuildTY = tile.y;
        }
    }

    // Right-click drag to pan (build mode only)
    if (mouse.rightDown && gameMode === 'build') {
        const dx = e.clientX - mouse.dragStartX;
        const dy = e.clientY - mouse.dragStartY;
        camera.x = mouse.camStartX - dx / camera.zoom;
        camera.y = mouse.camStartY - dy / camera.zoom;
        clampCamera();
    }

    // Cursor style
    canvas.style.cursor = (artifactUI.open && artifactUI.hovered >= 0) ? 'pointer' : 'crosshair';
});

canvas.addEventListener('mousedown', e => {
    // Block mouse input during boot text sequence
    if (artifactUI.flashPhase === 'boot_text') return;
    if (e.button === 0) {
        mouse.leftDown = true;
        mouse.justClicked = true;
        // Crafting interface click handling
        if (craftingOpen) {
            mouse.justClicked = false;
            craftMouseDown(0, mouse.x, mouse.y);
            return;
        }
        // Artifact UI click handling
        if (artifactUI.open) {
            mouse.justClicked = false; // consume all clicks while UI is open
            if (artifactUI.flashPhase === 'none') {
                const circles = getArtifactUICircles();
                for (let i = 0; i < circles.length; i++) {
                    const dx = mouse.x - circles[i].x;
                    const dy = mouse.y - circles[i].y;
                    if (dx * dx + dy * dy <= circles[i].r * circles[i].r) {
                        artifactUISelectCircle(i);
                        break;
                    }
                }
            }
            return;
        }
        if (gameMode === 'build') {
            const tile = screenToTile(mouse.x, mouse.y);
            doBuildAction(tile.x, tile.y);
            mouse.lastBuildTX = tile.x;
            mouse.lastBuildTY = tile.y;
        }
    }
    if (e.button === 1) {
        e.preventDefault();
        if (craftingOpen) {
            craftMouseDown(1, mouse.x, mouse.y);
            return;
        }
    }
    if (e.button === 2) {
        mouse.rightDown = true;
        if (craftingOpen) {
            craftMouseDown(2, mouse.x, mouse.y);
            return;
        }
        mouse.dragStartX = e.clientX;
        mouse.dragStartY = e.clientY;
        mouse.camStartX = camera.x;
        mouse.camStartY = camera.y;
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 0) {
        mouse.leftDown = false;
        mouse.lastBuildTX = -1;
        mouse.lastBuildTY = -1;
        if (craftingOpen) craftMouseUp(0);
    }
    if (e.button === 1) {
        if (craftingOpen) craftMouseUp(1);
    }
    if (e.button === 2) {
        mouse.rightDown = false;
        if (craftingOpen) craftMouseUp(2);
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (craftingOpen) {
        craftWheel(e.deltaY, mouse.x, mouse.y);
        return;
    }
    const worldX = camera.x + mouse.x / camera.zoom;
    const worldY = camera.y + mouse.y / camera.zoom;

    const zoomFactor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    const minZoom = gameMode === 'build' ? MIN_ZOOM_BUILD : MIN_ZOOM_PLAYER;
    camera.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, camera.zoom * zoomFactor));

    camera.x = worldX - mouse.x / camera.zoom;
    camera.y = worldY - mouse.y / camera.zoom;
    clampCamera();
}, { passive: false });
