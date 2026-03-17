// ============================================================
// ZOMBIE DEFENSE - Lighting (Darkness Mask, Flashlight, Artifact Light)
// ============================================================

function drawLighting(camX, camY, effectiveZoom) {
    if (lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
        lightCanvas.width = canvas.width;
        lightCanvas.height = canvas.height;
    }

    lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.fillStyle = `rgba(0, 0, 0, ${LIGHT_DARKNESS})`;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    lightCtx.globalCompositeOperation = 'destination-out';

    const lightWorldX = (ARTIFACT_CENTER_X + 0.5) * TILE_SIZE;
    const lightWorldY = (ARTIFACT_TY + ARTIFACT_SIZE / 2) * TILE_SIZE;
    const lsx = (lightWorldX - camX) * effectiveZoom;
    const lsy = (lightWorldY - camY) * effectiveZoom;

    const outerR = (LIGHT_RADIUS + LIGHT_FALLOFF) * TILE_SIZE * effectiveZoom;
    const innerStop = LIGHT_RADIUS / (LIGHT_RADIUS + LIGHT_FALLOFF);

    const grad = lightCtx.createRadialGradient(lsx, lsy, 0, lsx, lsy, outerR);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(innerStop, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    lightCtx.fillStyle = grad;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Flashlight (single directional oval, offset in facing direction)
    if (gameState.flashlightOn && !player.dead) {
        const plx = (player.x - camX) * effectiveZoom;
        const ply = ((player.y - player.h * 0.4) - camY) * effectiveZoom;
        const aim = physicsScreenToWorld(mouse.x, mouse.y);
        const flashDir = aim.x >= player.x ? 1 : -1;

        const beamLen = FLASHLIGHT_BEAM_RANGE * TILE_SIZE * effectiveZoom;
        const beamW = FLASHLIGHT_BEAM_WIDTH * TILE_SIZE * effectiveZoom;
        const offsetX = flashDir * beamLen * 0.3;

        lightCtx.save();
        lightCtx.translate(plx + offsetX, ply);
        lightCtx.scale(1.0, beamW / beamLen);

        const fGrad = lightCtx.createRadialGradient(0, 0, 0, 0, 0, beamLen * 0.7);
        fGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        fGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.6)');
        fGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
        fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightCtx.fillStyle = fGrad;
        lightCtx.beginPath();
        lightCtx.arc(0, 0, beamLen * 0.7, 0, Math.PI * 2);
        lightCtx.fill();

        lightCtx.restore();
    }

    lightCtx.fillStyle = `rgba(0, 0, 0, ${LIGHT_AMBIENT})`;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Punch tiny holes at star positions
    lightCtx.globalCompositeOperation = 'destination-out';
    for (const star of stars) {
        const sx = (star.x - camX) * effectiveZoom;
        const sy = (star.y - camY) * effectiveZoom;
        const sr = (star.size / 2) * effectiveZoom;
        if (sx < -sr || sx > canvas.width + sr || sy < -sr || sy > canvas.height + sr) continue;
        const br = gameState.artifactCorrupted ? Math.max(star.brightness, 0.7) : star.brightness;
        lightCtx.beginPath();
        lightCtx.arc(sx, sy, sr + 0.5, 0, Math.PI * 2);
        lightCtx.fillStyle = `rgba(0, 0, 0, ${br})`;
        lightCtx.fill();
    }
    lightCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(lightCanvas, 0, 0);
}
