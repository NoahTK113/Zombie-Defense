// ============================================================
// ZOMBIE DEFENSE - Input (Keyboard, Mouse Event Router)
// ============================================================

const keys = {};
const mouse = { x: 0, y: 0, leftDown: false, rightDown: false, justClicked: false, dragStartX: 0, dragStartY: 0, camStartX: 0, camStartY: 0, lastBuildTX: -1, lastBuildTY: -1 };

function screenToTile(sx, sy) {
    const tileScreen = Math.max(1, Math.round(TILE_SIZE * camera.zoom));
    const effectiveZoom = tileScreen / TILE_SIZE;
    const worldX = camera.x + sx / effectiveZoom;
    const worldY = camera.y + sy / effectiveZoom;
    return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
}

window.addEventListener('keydown', e => {
    keys[e.code] = true;

    // Block browser F-key defaults when game has focus
    if (e.code.startsWith('F') && !isNaN(e.code.slice(1))) e.preventDefault();

    // --- Crafting input handling (when crafting is open, capture keys) ---
    if (gameState.craftingOpen) {
        craftKeyDown(e.code);
        return;
    }

    // --- Tab: comms open/close (works across all states including intro) ---
    if (e.code === 'Tab') {
        e.preventDefault();
        commsHandleInput(e.code);
        return;
    }

    // --- Comms input handling (when comms is open, capture keys) ---
    if (gameState.commsOpen) {
        commsHandleInput(e.code);
        return;
    }

    // --- Intro-specific key handling ---
    if (intro.active) {
        introHandleKey(e.code);
        return;
    }

    // Block all input during boot text sequence
    if (artifactUI.flashPhase === 'boot_text') return;

    // --- Artifact UI open: E or ESC to close, block everything else ---
    if (artifactUI.open) {
        artifactHandleKey(e.code);
        return;
    }

    if (e.code === 'Escape') {
        pauseHandleKey(e.code);
        return;
    }
    if (gameState.paused) return;

    // Player-mode key actions (flashlight, weapon swap, artifact interaction)
    playerHandleKey(e.code);
    // Debug keys and save/load (F1-F11, Ctrl+S/L)
    handleDebugKeys(e);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    // Crafting interface mouse handling
    if (gameState.craftingOpen) {
        craftMouseMove(mouse.x, mouse.y);
        canvas.style.cursor = 'default';
        return;
    }

    // Artifact UI hover detection
    artifactHandleMouseMove(mouse.x, mouse.y);

    // Left-click drag to place/dig (build mode only)
    if (mouse.leftDown && gameState.gameMode === 'build') {
        buildHandleDrag(mouse.x, mouse.y);
    }

    // Right-click drag to pan (build mode only)
    if (mouse.rightDown && gameState.gameMode === 'build') {
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
        // Controls button / overlay click handling
        if (controlsHandleClick(mouse.x, mouse.y)) {
            mouse.justClicked = false;
            return;
        }
        // Crafting interface click handling
        if (gameState.craftingOpen) {
            mouse.justClicked = false;
            craftMouseDown(0, mouse.x, mouse.y);
            return;
        }
        // Artifact UI click handling
        if (artifactUI.open) {
            mouse.justClicked = false; // consume all clicks while UI is open
            artifactHandleClick(mouse.x, mouse.y);
            return;
        }
        if (gameState.gameMode === 'build') {
            buildHandleClick(mouse.x, mouse.y);
        }
    }
    if (e.button === 1) {
        e.preventDefault();
        if (gameState.craftingOpen) {
            craftMouseDown(1, mouse.x, mouse.y);
            return;
        }
    }
    if (e.button === 2) {
        mouse.rightDown = true;
        if (gameState.craftingOpen) {
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
        if (gameState.craftingOpen) craftMouseUp(0);
    }
    if (e.button === 1) {
        if (gameState.craftingOpen) craftMouseUp(1);
    }
    if (e.button === 2) {
        mouse.rightDown = false;
        if (gameState.craftingOpen) craftMouseUp(2);
    }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (gameState.craftingOpen) {
        craftWheel(e.deltaY, mouse.x, mouse.y);
        return;
    }
    const worldX = camera.x + mouse.x / camera.zoom;
    const worldY = camera.y + mouse.y / camera.zoom;

    const zoomFactor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    const minZoom = gameState.gameMode === 'build' ? MIN_ZOOM_BUILD : MIN_ZOOM_PLAYER;
    camera.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, camera.zoom * zoomFactor));

    camera.x = worldX - mouse.x / camera.zoom;
    camera.y = worldY - mouse.y / camera.zoom;
    clampCamera();
}, { passive: false });
