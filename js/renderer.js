// ============================================================
// ZOMBIE DEFENSE - Renderer (Stars, Draw, HUD, Overlays)
// ============================================================

// --- Stars (generated once) ---
const stars = [];
const NUM_STARS = 600;
const SKY_PIXEL_W = WORLD_W * TILE_SIZE;
for (let i = 0; i < NUM_STARS; i++) {
    const sx = Math.random() * SKY_PIXEL_W;
    const tileX = Math.floor(sx / TILE_SIZE);
    const maxY = (getGroundHeight(tileX) - 3) * TILE_SIZE;
    if (maxY <= 20) continue;
    stars.push({
        x: sx,
        y: Math.random() * maxY,
        size: Math.floor(Math.random() * 4) + 2,
        brightness: 0.3 + Math.random() * 0.7,
    });
}


// --- Encroachment cell hash (deterministic per cell for pixelated frontier) ---
function cellHash(cx, cy) {
    let h = cx * 374761393 + cy * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296; // 0..1
}

// --- Artifact UI Drawing Helpers ---
function drawWavyLine(ctx, x1, y1, x2, y2, waves, amplitude) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.max(20, waves * 12);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const wave = Math.sin(t * waves * Math.PI * 2) * amplitude;
        ctx.lineTo(px + nx * wave, py + ny * wave);
    }
    ctx.stroke();
}

function drawIrregularCircle(ctx, cx, cy, r, time, seed) {
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const p = 1 +
            0.04 * Math.sin(angle * 5 + seed + time * 0.8) +
            0.03 * Math.sin(angle * 7 + seed * 2.3 + time * 1.1) +
            0.02 * Math.sin(angle * 11 + seed * 3.7 + time * 0.5);
        const pr = r * p;
        const px = cx + Math.cos(angle) * pr;
        const py = cy + Math.sin(angle) * pr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

// Compton scattering: electron + photon → electron + photon
function drawFeynmanCompton(ctx, cx, cy, r) {
    const v1x = cx - r * 0.3, v2x = cx + r * 0.3;
    // Internal line
    ctx.beginPath();
    ctx.moveTo(v1x, cy);
    ctx.lineTo(v2x, cy);
    ctx.stroke();
    // Incoming electron (straight, bottom-left)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.6);
    ctx.lineTo(v1x, cy);
    ctx.stroke();
    // Outgoing electron (straight, bottom-right)
    ctx.beginPath();
    ctx.moveTo(v2x, cy);
    ctx.lineTo(cx + r, cy + r * 0.6);
    ctx.stroke();
    // Incoming photon (wavy, top-left)
    drawWavyLine(ctx, cx - r, cy - r * 0.6, v1x, cy, 4, r * 0.1);
    // Outgoing photon (wavy, top-right)
    drawWavyLine(ctx, v2x, cy, cx + r, cy - r * 0.6, 4, r * 0.1);
}

// Møller scattering (t-channel): e⁻ e⁻ → e⁻ e⁻ via photon exchange
function drawFeynmanExchange(ctx, cx, cy, r) {
    const vTopX = cx, vTopY = cy - r * 0.3;
    const vBotX = cx, vBotY = cy + r * 0.3;
    // Top fermion line
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.6);
    ctx.lineTo(vTopX, vTopY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vTopX, vTopY);
    ctx.lineTo(cx + r, cy - r * 0.6);
    ctx.stroke();
    // Bottom fermion line
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.6);
    ctx.lineTo(vBotX, vBotY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vBotX, vBotY);
    ctx.lineTo(cx + r, cy + r * 0.6);
    ctx.stroke();
    // Virtual photon exchange (wavy, vertical)
    drawWavyLine(ctx, vTopX, vTopY, vBotX, vBotY, 3, r * 0.1);
}

// Pair annihilation: e⁻ e⁺ → γ γ
function drawFeynmanAnnihilation(ctx, cx, cy, r) {
    const v1x = cx - r * 0.25, v2x = cx + r * 0.25;
    // Incoming e⁻ (straight, top-left)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.6);
    ctx.lineTo(v1x, cy);
    ctx.stroke();
    // Incoming e⁺ (straight, bottom-left)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * 0.6);
    ctx.lineTo(v1x, cy);
    ctx.stroke();
    // Internal propagator
    ctx.beginPath();
    ctx.moveTo(v1x, cy);
    ctx.lineTo(v2x, cy);
    ctx.stroke();
    // Outgoing γ (wavy, top-right)
    drawWavyLine(ctx, v2x, cy, cx + r, cy - r * 0.6, 4, r * 0.1);
    // Outgoing γ (wavy, bottom-right)
    drawWavyLine(ctx, v2x, cy, cx + r, cy + r * 0.6, 4, r * 0.1);
}

// --- Rendering ---
function draw() {
    // Clear entire canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Snapped tile size in screen pixels (always a whole number)
    const tileScreen = Math.max(1, Math.round(TILE_SIZE * camera.zoom));
    const effectiveZoom = tileScreen / TILE_SIZE;

    // Visible area in world pixels
    const viewW = canvas.width / effectiveZoom;
    const viewH = canvas.height / effectiveZoom;

    const shake = getScreenShakeOffset();
    const camX = camera.x + shake.x;
    const camY = camera.y + shake.y;

    // Artifact damage ratio and vein colors (computed early for star tinting)
    const artifactDmgRatio = 1 - gameState.artifactHP / ARTIFACT_MAX_HP;
    const veinR = Math.round(100 + (255 - 100) * artifactDmgRatio);
    const veinG = Math.round(210 * (1 - artifactDmgRatio));
    const veinB = Math.round(255 * (1 - artifactDmgRatio));

    // Draw stars behind terrain and all entities
    {
        let starR, starG, starB;
        if (artifactDmgRatio > 0.01) {
            starR = Math.round(255 - (255 - veinR) * artifactDmgRatio * 0.3);
            starG = Math.round(255 - (255 - veinG) * artifactDmgRatio);
            starB = Math.round(255 - (255 - veinB) * artifactDmgRatio);
        } else if (gameState.waveState === 'active') {
            starR = 140; starG = 180; starB = 255;
        } else {
            starR = 255; starG = 255; starB = 255;
        }
        for (const star of stars) {
            const sx = (star.x - camX) * effectiveZoom;
            const sy = (star.y - camY) * effectiveZoom;
            const sr = (star.size / 2) * effectiveZoom;
            if (sx < -sr || sx > canvas.width + sr || sy < -sr || sy > canvas.height + sr) continue;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            const br = gameState.artifactCorrupted ? Math.max(star.brightness, 0.7) : star.brightness;
            ctx.fillStyle = `rgba(${starR}, ${starG}, ${starB}, ${br})`;
            ctx.fill();
        }
    }

    // Draw visible chunks (chunk canvases are in TILE_TEXELS space, world uses TILE_SIZE)
    const chunkWorldSize = CHUNK_SIZE * TILE_SIZE; // world-space size of one chunk
    const chunkScreenSize = chunkWorldSize * effectiveZoom;
    const startCX = Math.floor(camX / chunkWorldSize);
    const startCY = Math.floor(camY / chunkWorldSize);
    const endCX = Math.ceil((camX + viewW) / chunkWorldSize);
    const endCY = Math.ceil((camY + viewH) / chunkWorldSize);

    for (let cy = Math.max(0, startCY); cy <= Math.min(CHUNKS_Y - 1, endCY); cy++) {
        for (let cx = Math.max(0, startCX); cx <= Math.min(CHUNKS_X - 1, endCX); cx++) {
            const chunk = chunks[getChunkIndex(cx, cy)];
            if (!chunk) continue;
            const sx = Math.round((cx * chunkWorldSize - camX) * effectiveZoom);
            const sy = Math.round((cy * chunkWorldSize - camY) * effectiveZoom);
            ctx.drawImage(chunk, sx, sy, Math.ceil(chunkScreenSize) + 1, Math.ceil(chunkScreenSize) + 1);
        }
    }

    // Draw block-breaking flash overlay
    for (const z of zombies) {
        if (z.state === 'breaking' && z.breakTarget) {
            const tx = z.breakTarget.x, ty = z.breakTarget.y;
            const bx = Math.round((tx * TILE_SIZE - camX) * effectiveZoom);
            const by = Math.round((ty * TILE_SIZE - camY) * effectiveZoom);
            const bs = Math.round(TILE_SIZE * effectiveZoom);
            const flash = 0.25 + 0.25 * Math.sin(gameTime * 10);
            ctx.fillStyle = `rgba(255, 60, 60, ${flash.toFixed(2)})`;
            ctx.fillRect(bx, by, bs, bs);
        }
    }

    // Darken artifact tiles to jet black while corrupted
    if (gameState.artifactCorrupted) {
        const axPx = ARTIFACT_TX * TILE_SIZE;
        const ayPx = ARTIFACT_TY * TILE_SIZE;
        const sx = Math.round((axPx - camX) * effectiveZoom);
        const sy = Math.round((ayPx - camY) * effectiveZoom);
        const sw = Math.round(ARTIFACT_PX * effectiveZoom);
        const sh = Math.round(ARTIFACT_PX * effectiveZoom);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(sx, sy, sw, sh);
    }

    // Draw artifact animated overlay (pulsing fractal veins, tinted by HP)
    {
        const axPx = ARTIFACT_TX * TILE_SIZE;
        const ayPx = ARTIFACT_TY * TILE_SIZE;
        const sx = Math.round((axPx - camX) * effectiveZoom);
        const sy = Math.round((ayPx - camY) * effectiveZoom);
        const sw = Math.round(ARTIFACT_PX * effectiveZoom);
        const sh = Math.round(ARTIFACT_PX * effectiveZoom);
        if (sx + sw > 0 && sx < canvas.width && sy + sh > 0 && sy < canvas.height) {
            if (gameState.artifactCorrupted) {
                veinTintCanvas.width = assets.artifactVeins.width;
                veinTintCanvas.height = assets.artifactVeins.height;
                veinTintCtx.clearRect(0, 0, veinTintCanvas.width, veinTintCanvas.height);
                for (let ox = -1; ox <= 1; ox++) {
                    for (let oy = -1; oy <= 1; oy++) {
                        veinTintCtx.drawImage(assets.artifactVeins, ox, oy);
                    }
                }
                veinTintCtx.globalCompositeOperation = 'source-in';
                veinTintCtx.fillStyle = `rgb(${veinR}, ${veinG}, ${veinB})`;
                veinTintCtx.fillRect(0, 0, veinTintCanvas.width, veinTintCanvas.height);
                veinTintCtx.globalCompositeOperation = 'source-over';
                ctx.drawImage(veinTintCanvas, sx, sy, sw, sh);
            } else {
                const p1 = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(gameTime * 2.0));
                const p2 = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(gameTime * 1.3 + 1.0));
                const veinAlpha = p1 * p2;
                veinTintCanvas.width = assets.artifactVeins.width;
                veinTintCanvas.height = assets.artifactVeins.height;
                veinTintCtx.clearRect(0, 0, veinTintCanvas.width, veinTintCanvas.height);
                veinTintCtx.drawImage(assets.artifactVeins, 0, 0);
                veinTintCtx.globalCompositeOperation = 'source-in';
                veinTintCtx.fillStyle = `rgb(${veinR}, ${veinG}, ${veinB})`;
                veinTintCtx.fillRect(0, 0, veinTintCanvas.width, veinTintCanvas.height);
                veinTintCtx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = veinAlpha;
                ctx.drawImage(veinTintCanvas, sx, sy, sw, sh);
                ctx.globalAlpha = 1.0;
                const glowAlpha = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(gameTime * 1.5));
                ctx.fillStyle = `rgba(${veinR}, ${veinG}, ${veinB}, ${glowAlpha.toFixed(3)})`;
                ctx.fillRect(sx, sy, sw, sh);
            }
        }
    }

    // Draw ghost preview in build mode
    if (gameState.gameMode === 'build') {
        const tile = screenToTile(mouse.x, mouse.y);
        if (tile.x >= 0 && tile.x < WORLD_W && tile.y >= 0 && tile.y < WORLD_H) {
            const gx = Math.round((tile.x * TILE_SIZE - camX) * effectiveZoom);
            const gy = Math.round((tile.y * TILE_SIZE - camY) * effectiveZoom);
            const gs = Math.round(TILE_SIZE * effectiveZoom);
            const t = tileAt(tile.x, tile.y);
            if (t === TILE.AIR && !playerOccupiesTile(tile.x, tile.y) && gameState.points >= 5) {
                ctx.fillStyle = 'rgba(140, 90, 60, 0.5)';
                ctx.fillRect(gx, gy, gs, gs);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.strokeRect(gx + 0.5, gy + 0.5, gs - 1, gs - 1);
            } else if (t === TILE.EARTH || t === TILE.BRICK) {
                ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
                ctx.lineWidth = 2;
                ctx.strokeRect(gx + 1, gy + 1, gs - 2, gs - 2);
            } else if (t === TILE.AIR) {
                ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
                ctx.fillRect(gx, gy, gs, gs);
            }
        }
    }

    // Shovel target block red overlay
    if (shovelTargetBlock && gameState.gameMode === 'player' && !player.dead) {
        const stx = shovelTargetBlock.x, sty = shovelTargetBlock.y;
        const sbx = Math.round((stx * TILE_SIZE - camX) * effectiveZoom);
        const sby = Math.round((sty * TILE_SIZE - camY) * effectiveZoom);
        const sbs = Math.round(TILE_SIZE * effectiveZoom);
        const pulse = 0.2 + 0.1 * Math.sin(gameTime * 8);
        ctx.fillStyle = `rgba(255, 60, 60, ${pulse.toFixed(2)})`;
        ctx.fillRect(sbx, sby, sbs, sbs);
    }

    // Draw zombies
    for (const z of zombies) {
        const zx = Math.round((z.x - z.w / 2 - camX) * effectiveZoom);
        const zy = Math.round((z.y - z.h - camY) * effectiveZoom);
        const zw = Math.round(z.w * effectiveZoom);
        const zh = Math.round(z.h * effectiveZoom);
        if (zx + zw < 0 || zx > canvas.width || zy + zh < 0 || zy > canvas.height) continue;

        const bob = z.onGround && Math.abs(z.vx) > 1 ? Math.round(Math.sin(gameTime * 10 + z.x) * 1.5 * effectiveZoom) : 0;

        if (z.state === 'absorbing') {
            const pulse = Math.sin(z.absorbTimer * ABSORB_PULSE_HZ * Math.PI * 2);
            const t = (pulse + 1) / 2;
            const r = Math.floor(102 + t * 153);
            const g = Math.floor(102 * (1 - t));
            const bv = Math.floor(102 * (1 - t));
            ctx.fillStyle = `rgb(${r},${g},${bv})`;
        } else {
            const hpRatio = Math.max(0, z.hp / z.maxHp);
            const gr = Math.floor(102 * hpRatio);
            const rd = Math.floor(102 + (1 - hpRatio) * 100);
            ctx.fillStyle = `rgb(${rd},${gr},${gr})`;
        }
        // Red aura for flyers
        if (z.type === 'flyer') {
            ctx.shadowColor = 'rgba(255, 0, 0, 0.6)';
            ctx.shadowBlur = 12 * effectiveZoom;
        }
        ctx.fillRect(zx, zy + bob, zw, zh);
        if (z.type === 'flyer') {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // Eye (red)
        const ezSize = Math.max(2, Math.round(4 * effectiveZoom));
        const ezX = z.facingRight ? zx + zw * 0.55 : zx + zw * 0.15;
        const ezY = zy + bob + Math.round(4 * effectiveZoom);
        ctx.fillStyle = '#f00';
        ctx.fillRect(ezX, ezY, ezSize, ezSize);
        const pzSize = Math.max(1, Math.round(2 * effectiveZoom));
        ctx.fillStyle = '#900';
        ctx.fillRect(z.facingRight ? ezX + ezSize - pzSize : ezX, ezY + Math.round(1 * effectiveZoom), pzSize, pzSize);
    }

    // Draw bullets as streaks
    for (const b of bullets) {
        const bx = (b.x - camX) * effectiveZoom;
        const by = (b.y - camY) * effectiveZoom;
        const br = BULLET_RADIUS * effectiveZoom;
        if (bx < -br * 20 || bx > canvas.width + br * 20 || by < -br * 20 || by > canvas.height + br * 20) continue;
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const streakLen = Math.max(18, 36 * effectiveZoom);
        const nx = b.vx / speed, ny = b.vy / speed;
        const tailX = bx - nx * streakLen, tailY = by - ny * streakLen;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, 2 * effectiveZoom);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }

    // Draw death particles
    for (const p of particles) {
        const px = (p.x - camX) * effectiveZoom;
        const py = (p.y - camY) * effectiveZoom;
        const ps = p.size * effectiveZoom;
        if (px < -ps || px > canvas.width + ps || py < -ps || py > canvas.height + ps) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(2)})`;
        ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
    }

    // Draw player (skip if dead)
    if (!player.dead) {
    const isIntroLying = intro.active && (intro.phase === 'fadein' || intro.phase === 'lying' || intro.phase === 'blink' || intro.phase === 'standup_prompt');
    const isIntroStanding = intro.active && intro.phase === 'standing';

    if (isIntroLying || isIntroStanding) {
        let rotAngle;
        if (isIntroStanding) {
            const t = Math.min(1, intro.standTimer / intro.standDuration);
            const ease = 1 - Math.pow(1 - t, 2);
            rotAngle = (-Math.PI / 2) * (1 - ease);
        } else {
            rotAngle = -Math.PI / 2;
        }

        const pw = Math.round(player.w * effectiveZoom);
        const ph = Math.round(player.h * effectiveZoom);
        const pivotSX = (player.x - camX) * effectiveZoom;
        const lyingFactor = Math.abs(rotAngle) / (Math.PI / 2);
        const groundOffset = lyingFactor * (pw / 2);
        const pivotSY = (player.y - camY) * effectiveZoom - groundOffset;

        ctx.save();
        ctx.translate(pivotSX, pivotSY);
        ctx.rotate(rotAngle);

        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-pw / 2, -ph, pw, ph);

        const showEye = isIntroStanding || (intro.phase === 'blink' && intro.blinkOpen) || intro.phase === 'standup_prompt';
        if (showEye) {
            const eyeSize = Math.max(2, Math.round(4 * effectiveZoom));
            const eyeX = -pw / 2 + pw * 0.55;
            const eyeY = -ph + Math.round(4 * effectiveZoom);
            ctx.fillStyle = '#fff';
            ctx.fillRect(eyeX, eyeY, eyeSize, eyeSize);
            const pupilSize = Math.max(1, Math.round(2 * effectiveZoom));
            ctx.fillStyle = '#000';
            ctx.fillRect(eyeX + eyeSize - pupilSize, eyeY + Math.round(1 * effectiveZoom), pupilSize, pupilSize);
        }
        ctx.restore();
    } else {
        const px = Math.round((player.x - player.w / 2 - camX) * effectiveZoom);
        const py = Math.round((player.y - player.h - camY) * effectiveZoom);
        const pw = Math.round(player.w * effectiveZoom);
        const ph = Math.round(player.h * effectiveZoom);

        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(px, py, pw, ph);

        const aim = physicsScreenToWorld(mouse.x, mouse.y);
        const aimingRight = aim.x >= player.x;

        ctx.fillStyle = '#fff';
        const eyeSize = Math.max(2, Math.round(4 * effectiveZoom));
        const eyeX = aimingRight ? px + pw * 0.55 : px + pw * 0.15;
        const eyeY = py + Math.round(4 * effectiveZoom);
        ctx.fillRect(eyeX, eyeY, eyeSize, eyeSize);
        ctx.fillStyle = '#000';
        const pupilSize = Math.max(1, Math.round(2 * effectiveZoom));
        ctx.fillRect(aimingRight ? eyeX + eyeSize - pupilSize : eyeX, eyeY + Math.round(1 * effectiveZoom), pupilSize, pupilSize);

        // Draw weapon (only during swing)
        if (gameState.gameMode === 'player' && shovelSwingTimer > 0) {
            // Pivot at player center-shoulder (matches combat.js)
            const handX = px + pw * 0.5;
            const handY = py + ph * 0.55;
            const weapon = getActiveWeapon();

            ctx.save();
            ctx.translate(handX, handY);

            // Directional swing with inertia: hermite easing, arc centered on aim
            const progress = 1 - shovelSwingTimer / meleeSwingDuration;
            const canvasAim = meleeAimAngle - Math.PI / 2;
            const halfArc = MELEE_SWING_ARC / 2;
            const startAngle = meleeSwingCW ? canvasAim - halfArc : canvasAim + halfArc;
            const endAngle = meleeSwingCW ? canvasAim + halfArc : canvasAim - halfArc;
            const easedProgress = swingEase(progress);
            const angle = startAngle + (endAngle - startAngle) * easedProgress;
            ctx.rotate(angle);

            // Grip offset: weapon extends to meleeGripDist from pivot (choke-up support)
            const armOffsetBase = 1.0 * TILE_SIZE;
            const fullTip = armOffsetBase + weapon.colliderOffset * TILE_SIZE + weapon.colliderHeight * TILE_SIZE;
            const chokeShift = (fullTip - meleeGripDist) * effectiveZoom;
            const armOffset = armOffsetBase * effectiveZoom - chokeShift;
            ctx.translate(0, armOffset);

            if (weapon.sprite && weapon.sprite.complete) {
                // Draw crafted weapon sprite (flipped: handle at hand, head outward)
                const weapH = weapon.visualHeight * TILE_SIZE * effectiveZoom;
                const spriteAspect = weapon.sprite.width / weapon.sprite.height;
                const weapW = weapH * spriteAspect;
                ctx.save();
                ctx.scale(1, -1);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(weapon.sprite, -weapW / 2, -weapH, weapW, weapH);
                ctx.imageSmoothingEnabled = true;
                ctx.restore();
            } else {
                // Built-in shovel drawing
                const handleLen = 18 * effectiveZoom;
                const bladeW = 6 * effectiveZoom;
                const bladeH = 8 * effectiveZoom;
                ctx.fillStyle = '#999';
                ctx.fillRect(-1.5 * effectiveZoom, 0, 3 * effectiveZoom, handleLen);
                ctx.fillStyle = '#999';
                ctx.fillRect(-bladeW / 2, handleLen - 1, bladeW, bladeH);
                ctx.fillStyle = '#bbb';
                ctx.fillRect(-bladeW / 2, handleLen + bladeH - 2 * effectiveZoom, bladeW, 2 * effectiveZoom);
            }

            ctx.restore();
        }
    }
    }

    // --- Swing trail ---
    drawSwingTrail(ctx, camX, camY, effectiveZoom);

    // --- Lighting overlay ---
    drawLighting(camX, camY, effectiveZoom);

    // --- Debug: Melee collider overlay ---
    if (gameState.debugShowColliders && debugCollider) {
        ctx.save();
        const dc = debugCollider;
        const sx = (dc.cx - camX) * effectiveZoom;
        const sy = (dc.cy - camY) * effectiveZoom;
        ctx.translate(sx, sy);
        ctx.rotate(dc.angle);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.strokeRect(-dc.halfW * effectiveZoom, -dc.halfH * effectiveZoom, dc.halfW * 2 * effectiveZoom, dc.halfH * 2 * effectiveZoom);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.fillRect(-dc.halfW * effectiveZoom, -dc.halfH * effectiveZoom, dc.halfW * 2 * effectiveZoom, dc.halfH * 2 * effectiveZoom);
        ctx.restore();
    }

    // Damage vignette
    if (player.damageFlash > 0) {
        const intensity = Math.min(1, player.damageFlash / 2.0);
        const rVal = Math.floor(180 * intensity);
        ctx.globalCompositeOperation = 'lighter';
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const innerR = Math.min(cx, cy) * 0.4;
        const outerR = Math.sqrt(cx * cx + cy * cy);
        const vGrad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        vGrad.addColorStop(0, `rgba(${rVal}, 0, 0, 0)`);
        vGrad.addColorStop(1, `rgba(${rVal}, 0, 0, 1)`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
    }

    // Build mode flash
    if (buildFlash > 0) {
        const flashAlpha = Math.min(1, buildFlash) * 0.7;
        ctx.fillStyle = `rgba(200, 220, 255, ${flashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Artifact corruption/restoration radial pulse
    if (artifactPulse > 0) {
        const pulseIntensity = Math.min(1, artifactPulse);
        const pr = artifactPulseColor[0], pg = artifactPulseColor[1], pb = artifactPulseColor[2];
        const artSX = ((ARTIFACT_CENTER_X + 0.5) * TILE_SIZE - camX) * effectiveZoom;
        const artSY = ((ARTIFACT_TY + ARTIFACT_SIZE / 2) * TILE_SIZE - camY) * effectiveZoom;
        const maxR = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
        const ringProgress = 1 - pulseIntensity;
        const ringCenter = maxR * ringProgress * 0.8;
        const ringWidth = maxR * 0.3;
        const pGrad = ctx.createRadialGradient(artSX, artSY, Math.max(0, ringCenter - ringWidth / 2), artSX, artSY, ringCenter + ringWidth / 2);
        const alpha = (pulseIntensity * 0.6).toFixed(3);
        pGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, 0)`);
        pGrad.addColorStop(0.4, `rgba(${pr}, ${pg}, ${pb}, ${alpha})`);
        pGrad.addColorStop(0.6, `rgba(${pr}, ${pg}, ${pb}, ${alpha})`);
        pGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0)`);
        ctx.fillStyle = pGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Intro Sequence Overlays ---
    if (intro.active) {
        if (intro.phase === 'standup_prompt') {
            ctx.save();
            ctx.font = 'bold 32px Jura, sans-serif';
            ctx.textAlign = 'center';
            const pulse = 0.5 + 0.5 * Math.sin(gameTime * 3);
            ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
            ctx.fillText('Press E to stand up', canvas.width / 2, 80);
            ctx.restore();
        }

        if (intro.fadeOpacity > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${intro.fadeOpacity.toFixed(3)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // --- On-screen prompts (drawn BEFORE interfaces so they appear behind) ---

    // Artifact proximity prompt
    if (!intro.active && gameState.commsComplete && gameState.gameMode === 'player' && !player.dead && !gameState.artifactCorrupted && !artifactUI.open && artifactUI.flashPhase === 'none' && isNearArtifact()) {
        ctx.save();
        ctx.font = 'bold 32px Jura, sans-serif';
        ctx.textAlign = 'center';
        const pulse = 0.6 + 0.4 * Math.sin(gameTime * 3);
        ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
        const promptText = artifactUI.firstTouch ? 'Press E to touch artifact' : 'Press E to use artifact';
        ctx.fillText(promptText, canvas.width / 2, 80);
        ctx.restore();
    }

    // "Press E to return to body" prompt in build mode
    if (!intro.active && gameState.gameMode === 'build') {
        ctx.save();
        ctx.font = 'bold 32px Jura, sans-serif';
        ctx.textAlign = 'center';
        const pulse = 0.6 + 0.4 * Math.sin(gameTime * 3);
        ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
        ctx.fillText('Press E to return to body', canvas.width / 2, 80);
        ctx.restore();
    }

    // Tutorial prompts
    if (!intro.active && gameState.tutorialStep === 'flashlight') {
        ctx.save();
        ctx.font = 'bold 32px Jura, sans-serif';
        ctx.textAlign = 'center';
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 3);
        ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
        ctx.fillText('Press F for flashlight', canvas.width / 2, 80);
        ctx.restore();
    } else if (!intro.active && gameState.tutorialStep === 'comms') {
        ctx.save();
        ctx.font = 'bold 32px Jura, sans-serif';
        ctx.textAlign = 'center';
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 3);
        ctx.fillStyle = `rgba(200, 220, 255, ${pulse.toFixed(2)})`;
        ctx.fillText('Press C to open comms', canvas.width / 2, 80);
        ctx.restore();
    }

    // --- Crafting Interface ---
    if (gameState.craftingOpen) {
        drawCrafting();
    }

    // --- Comms Device UI (tablet) ---
    if (gameState.commsOpen) {
        const tabW = Math.round(canvas.width * 0.4);
        const tabH = Math.round(canvas.height * 0.6);
        const tabX = Math.round((canvas.width - tabW) / 2);
        const tabY = Math.round((canvas.height - tabH) / 2 + canvas.height * 0.05);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Metal frame
        const frameThickness = 8;
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(tabX - frameThickness, tabY - frameThickness, tabW + frameThickness * 2, tabH + frameThickness * 2);
        ctx.fillStyle = '#7a7a7a';
        ctx.fillRect(tabX - frameThickness, tabY - frameThickness, tabW + frameThickness * 2, 3);
        ctx.fillRect(tabX - frameThickness, tabY - frameThickness, 3, tabH + frameThickness * 2);
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(tabX - frameThickness, tabY + tabH + frameThickness - 3, tabW + frameThickness * 2, 3);
        ctx.fillRect(tabX + tabW + frameThickness - 3, tabY - frameThickness, 3, tabH + frameThickness * 2);

        // Black screen
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(tabX, tabY, tabW, tabH);

        // Scanline effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        for (let sy = tabY; sy < tabY + tabH; sy += 3) {
            ctx.fillRect(tabX, sy, tabW, 1);
        }

        // Screen content
        ctx.save();
        ctx.beginPath();
        ctx.rect(tabX + 6, tabY + 6, tabW - 12, tabH - 12);
        ctx.clip();

        // Header
        ctx.font = '11px monospace';
        ctx.fillStyle = '#556677';
        ctx.textAlign = 'center';
        ctx.fillText('Cirrus Group Interstellar Comms Network', tabX + tabW / 2, tabY + 28);

        // Status indicator
        if (comms.status) {
            ctx.textAlign = 'right';
            ctx.font = '10px monospace';
            ctx.fillStyle = comms.statusColor;
            ctx.fillText(comms.status, tabX + tabW - 16, tabY + 28);
        }

        // Separator
        ctx.strokeStyle = '#334455';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tabX + 16, tabY + 36);
        ctx.lineTo(tabX + tabW - 16, tabY + 36);
        ctx.stroke();

        // Choice area height calculation
        const lineHeight = 18;
        const choiceWrapMax = COMMS_MAX_CHARS - 2;
        let choiceAreaHeight = 24;
        let wrappedChoiceLines = null;
        if (comms.choices) {
            wrappedChoiceLines = comms.choices.options.map(opt => commsWrapText(opt, choiceWrapMax));
            let totalLines = 0;
            wrappedChoiceLines.forEach(w => totalLines += w.length);
            choiceAreaHeight = totalLines * lineHeight + 16;
        }

        // Message lines
        const lineStartY = tabY + 54;
        const maxMsgBottom = tabY + tabH - choiceAreaHeight - 8;
        const maxVisibleLines = Math.floor((maxMsgBottom - lineStartY) / lineHeight);
        const startLine = Math.max(0, comms.lines.length - maxVisibleLines);
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        for (let i = startLine; i < comms.lines.length; i++) {
            const line = comms.lines[i];
            const ly = lineStartY + (i - startLine) * lineHeight;
            if (ly > maxMsgBottom) break;
            ctx.fillStyle = line.color;
            ctx.fillText(line.text, tabX + 16, ly);
        }

        // Blinking cursor
        if (comms.inputLocked && comms.queue.length > 0) {
            const cursorLine = Math.min(comms.lines.length - startLine, maxVisibleLines);
            const cursorY = lineStartY + cursorLine * lineHeight;
            if (cursorY <= maxMsgBottom && Math.floor(gameTime * 3) % 2 === 0) {
                ctx.fillStyle = '#77aacc';
                ctx.fillText('_', tabX + 16, cursorY);
            }
        }

        // Choice prompt
        if (comms.choices && wrappedChoiceLines) {
            let totalLines = 0;
            wrappedChoiceLines.forEach(w => totalLines += w.length);
            const choiceBaseY = tabY + tabH - 12 - totalLines * lineHeight;
            ctx.font = '13px monospace';
            let cy = choiceBaseY;
            for (let i = 0; i < comms.choices.options.length; i++) {
                const isSelected = i === comms.choices.selected;
                const lines = wrappedChoiceLines[i];
                for (let j = 0; j < lines.length; j++) {
                    const prefix = j === 0 ? (isSelected ? '> ' : '  ') : '  ';
                    ctx.fillStyle = isSelected ? '#ffffff' : '#666666';
                    ctx.fillText(prefix + lines[j], tabX + 20, cy);
                    cy += lineHeight;
                }
            }
        }

        // Close hint
        if (!comms.choices && !comms.inputLocked) {
            ctx.textAlign = 'center';
            ctx.font = '11px monospace';
            ctx.fillStyle = '#444444';
            ctx.fillText('C to close', tabX + tabW / 2, tabY + tabH - 12);
        }

        ctx.restore();
    }

    // --- HUD (KJ, round, weapon) ---
    drawHUD();

    // Debug: Flow field overlay (per-tile, body-aware)
    if (gameState.debugShowFlowField && flowField) {
        ctx.save();
        ctx.font = `${Math.max(8, Math.round(12 * effectiveZoom))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const artCX = ARTIFACT_CENTER_X;
        const artCY = ARTIFACT_TY + Math.floor(ARTIFACT_SIZE / 2);
        const range = 30;
        const minTX = Math.max(0, artCX - range);
        const maxTX = Math.min(WORLD_W - 1, artCX + range);
        const minTY = Math.max(0, artCY - range);
        const maxTY = Math.min(WORLD_H - 1, artCY + range);
        for (let ty = minTY; ty <= maxTY; ty++) {
            for (let tx = minTX; tx <= maxTX; tx++) {
                const sx = Math.round((tx * TILE_SIZE - camX) * effectiveZoom);
                const sy = Math.round((ty * TILE_SIZE - camY) * effectiveZoom);
                const sw = Math.round(TILE_SIZE * effectiveZoom);
                if (sx + sw < 0 || sx > canvas.width || sy + sw < 0 || sy > canvas.height) continue;
                if (isSolid(tx, ty)) continue;
                const f = flowField[ty * WORLD_W + tx];
                const cx = sx + sw / 2;
                const cy = sy + sw / 2;
                if (!f) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                    ctx.fillText('X', cx, cy);
                } else if (f.dx === 0 && f.dy === 0) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
                    ctx.fillText('O', cx, cy);
                } else if (f.breach) {
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
                    ctx.fillText('B', cx, cy);
                } else {
                    const arrows = {
                        '1,0': '\u2192', '-1,0': '\u2190', '0,1': '\u2193', '0,-1': '\u2191',
                        '1,1': '\u2198', '1,-1': '\u2197', '-1,1': '\u2199', '-1,-1': '\u2196'
                    };
                    const key = `${f.dx},${f.dy}`;
                    ctx.fillStyle = f.reach ? 'rgba(0, 200, 255, 0.7)' : 'rgba(255, 165, 0, 0.7)';
                    ctx.fillText(arrows[key] || '?', cx, cy);
                }
            }
        }
        // Draw flyer sample points and their flow directions
        const arrows = {
            '1,0': '\u2192', '-1,0': '\u2190', '0,1': '\u2193', '0,-1': '\u2191',
            '1,1': '\u2198', '1,-1': '\u2197', '-1,1': '\u2199', '-1,-1': '\u2196',
            '0,0': 'O'
        };
        for (const z of zombies) {
            if (z.type !== 'flyer') continue;
            const pts = [
                { px: z.x, py: z.y - z.h, label: 'H' },
                { px: z.x, py: z.y, label: 'F' },
                { px: z.x - z.w / 2, py: z.y - z.h / 2, label: 'L' },
                { px: z.x + z.w / 2, py: z.y - z.h / 2, label: 'R' },
            ];
            for (const pt of pts) {
                const sx = Math.round((pt.px - camX) * effectiveZoom);
                const sy = Math.round((pt.py - camY) * effectiveZoom);
                // Draw sample point dot
                ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
                ctx.beginPath();
                ctx.arc(sx, sy, 3 * effectiveZoom, 0, Math.PI * 2);
                ctx.fill();
                // Draw flow direction at this point
                const stx = Math.floor(pt.px / TILE_SIZE);
                const sty = Math.floor(pt.py / TILE_SIZE);
                if (stx >= 0 && stx < WORLD_W && sty >= 0 && sty < WORLD_H) {
                    const cell = flowField[sty * WORLD_W + stx];
                    if (cell) {
                        const key = `${cell.dx},${cell.dy}`;
                        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
                        ctx.fillText(arrows[key] || '?', sx + 6 * effectiveZoom, sy);
                    } else {
                        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
                        ctx.fillText('X', sx + 6 * effectiveZoom, sy);
                    }
                }
            }
        }

        // Draw resultant acceleration vector above each flyer
        for (const z of zombies) {
            if (z.type !== 'flyer') continue;
            if (z._dbgSteerX === undefined) continue;
            const sdx = z._dbgSteerX;
            const sdy = z._dbgSteerY;
            const headX = Math.round((z.x - camX) * effectiveZoom);
            const headY = Math.round((z.y - z.h - camY) * effectiveZoom);
            const aboveY = headY - 10 * effectiveZoom;
            if (sdx === 0 && sdy === 0) {
                ctx.fillStyle = 'rgba(255, 100, 255, 0.9)';
                ctx.fillText('STOP', headX, aboveY);
            } else {
                const len = Math.sqrt(sdx * sdx + sdy * sdy);
                const nx = sdx / len;
                const ny = sdy / len;
                const lineLen = 20 * effectiveZoom;
                const endX = headX + nx * lineLen;
                const endY = aboveY + ny * lineLen;
                ctx.strokeStyle = 'rgba(255, 100, 255, 0.9)';
                ctx.lineWidth = 2 * effectiveZoom;
                ctx.beginPath();
                ctx.moveTo(headX, aboveY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                // Arrowhead
                const aSize = 5 * effectiveZoom;
                const ax = -nx * aSize;
                const ay = -ny * aSize;
                ctx.fillStyle = 'rgba(255, 100, 255, 0.9)';
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX + ax - ay * 0.5, endY + ay + ax * 0.5);
                ctx.lineTo(endX + ax + ay * 0.5, endY + ay - ax * 0.5);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // Debug HUD (bottom-right)
    ctx.save();
    ctx.font = '14px Jura, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ff44';
    const dbx = canvas.width - 10;
    ctx.fillText(`[F1] Skip Intro  [F2] Skip Comms  [F3] Skip Artifact  [F4] Start Wave  [F5] Wave Skip  [F6] Respawn  [F7] Restore  [F8] Target: ${gameState.debugNoTargetPlayer ? 'OFF' : 'ON'}  [F9] Clear Weapons  [F10] +1000 KJ  [F11] FlowField: ${gameState.debugShowFlowField ? 'ON' : 'OFF'}  [\`] Colliders: ${gameState.debugShowColliders ? 'ON' : 'OFF'}  [Ctrl+S] Save  [Ctrl+L] Load`, dbx, canvas.height - 10);
    ctx.restore();

    // --- Dark background for boot text and circles fadein ---
    if (artifactUI.flashPhase === 'boot_text' || artifactUI.flashPhase === 'circles_fadein') {
        ctx.fillStyle = '#051025';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.4;
        for (let nx = 0; nx < canvas.width; nx += 256) {
            for (let ny = 0; ny < canvas.height; ny += 256) {
                ctx.drawImage(assets.noise, nx, ny);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- Circles during circles_fadein or full open ---
    if (artifactUI.flashPhase === 'circles_fadein' || artifactUI.open) {
        ctx.save();

        // If fully open, draw solid background + noise (no cell-by-cell needed)
        if (artifactUI.open && artifactUI.flashPhase === 'none') {
            ctx.fillStyle = '#051025';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 0.4;
            for (let nx = 0; nx < canvas.width; nx += 256) {
                for (let ny = 0; ny < canvas.height; ny += 256) {
                    ctx.drawImage(assets.noise, nx, ny);
                }
            }
            ctx.globalAlpha = 1.0;
        }

        // Get circle positions (triangular: 1 top, 2 bottom)
        const uiCircles = getArtifactUICircles();
        const t = gameTime;
        const conduitAvailable = !gameState.artifactCorrupted;
        const isFadingIn = artifactUI.flashPhase === 'circles_fadein';

        // Staggered fade-in: circle 0 at 0s, circle 1 at 0.8s, circle 2 at 1.6s, each takes 1.2s
        const fadeStagger = [0, 0.8, 1.6];
        const fadeDuration = 1.2;

        // Draw each circle
        for (let i = 0; i < 3; i++) {
            const c = uiCircles[i];

            // Per-circle alpha during fade-in
            let circleAlpha = 1.0;
            if (isFadingIn) {
                const elapsed = artifactUI.circlesFadeIn - fadeStagger[i];
                if (elapsed <= 0) continue; // not visible yet
                const rawAlpha = Math.min(1, elapsed / fadeDuration);
                // Pulse while fading in: gentle throb
                const pulseFade = 0.7 + 0.3 * Math.sin(elapsed * 4);
                circleAlpha = rawAlpha * pulseFade;
            }
            ctx.globalAlpha = circleAlpha;

            const isHovered = artifactUI.open && artifactUI.hovered === i;
            const isDimmed = (i === 2 && !conduitAvailable);
            const pulse = 0.5 + 0.3 * Math.sin(t * 2 + i * 2.1);
            const baseAlpha = isDimmed ? 0.2 : (isHovered ? 0.9 : (0.4 + pulse * 0.3));

            // Glow behind circle when hovered
            if (isHovered && !isDimmed) {
                const glowGrad = ctx.createRadialGradient(c.x, c.y, c.r * 0.3, c.x, c.y, c.r * 1.5);
                const glowColor = i === 2 ? '255, 80, 80' : '100, 210, 255';
                glowGrad.addColorStop(0, `rgba(${glowColor}, 0.15)`);
                glowGrad.addColorStop(1, `rgba(${glowColor}, 0)`);
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.r * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Irregular circle outline (static - use seed only, no time)
            ctx.strokeStyle = `rgba(100, 210, 255, ${baseAlpha.toFixed(2)})`;
            ctx.lineWidth = isHovered && !isDimmed ? 3 : 2;
            drawIrregularCircle(ctx, c.x, c.y, c.r, 0, i * 17.3);
            ctx.stroke();

            // Feynman diagram inside
            ctx.strokeStyle = `rgba(100, 210, 255, ${(baseAlpha * 0.85).toFixed(2)})`;
            ctx.lineWidth = isHovered && !isDimmed ? 2.5 : 2;
            const dr = c.r * 0.6;
            if (i === 0) drawFeynmanCompton(ctx, c.x, c.y, dr);
            else if (i === 1) drawFeynmanExchange(ctx, c.x, c.y, dr);
            else drawFeynmanAnnihilation(ctx, c.x, c.y, dr);

            // Label above circle
            let label;
            if (i === 0) label = 'Build';
            else if (i === 1) label = 'Craft';
            else {
                // Conduit label changes based on state
                if (gameState.waveState === 'idle' && gameState.waveNumber === 0) label = 'Advance State';
                else if (gameState.waveState === 'idle') label = 'Resume Advance';
                else if (gameState.waveState === 'countdown') label = 'Pause Advance';
                else if (gameState.waveState === 'active' && gameState.waveAutoAdvance) label = 'Pause Advance';
                else if (gameState.waveState === 'active') label = 'Resume Advance';
                else label = 'Advance State';
            }
            ctx.font = '22px Jura, sans-serif';
            ctx.fillStyle = `rgba(100, 210, 255, ${baseAlpha.toFixed(2)})`;
            ctx.textAlign = 'center';
            ctx.fillText(label, c.x, c.y - c.r - 24);
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    // --- Artifact UI text (top-left area) ---
    if (artifactUI.flashPhase === 'boot_text' || artifactUI.flashPhase === 'circles_fadein' || artifactUI.open) {
        ctx.save();
        const bootFontSize = 23;
        const bootLineH = 36;
        const bootX = 100;
        const bootY = 100;
        ctx.font = `${bootFontSize}px Jura, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(100, 210, 255, 0.6)';

        if (artifactUI.bootFirstSession) {
            // First session: show boot sequence (typed out during boot_text, full after)
            const bootSeq = [
                { text: 'Mass-Energy Reassignment Reactor' },
                { text: 'Device ID #004.2' },
                { text: 'Scanning for Operator...' },
                { text: 'Local Biological Network(s) Detected: 1' },
                { text: 'Binding...' },
                { text: 'SUCCESSFUL', append: true, preDelay: 1.0 },
                { text: 'Energy Storage Low, E = 500 KJ' },
                { text: 'Limiter Reset To STATE = 1' },
                { text: 'Exercise Caution During State Advancement' },
            ];
            const typeDuration = 0.75;
            const lineGap = 0.3;
            const isTyping = artifactUI.flashPhase === 'boot_text';
            let displayLine = 0;
            let cumTime = 0;
            for (let i = 0; i < bootSeq.length; i++) {
                const entry = bootSeq[i];
                if (i > 0 && !entry.append) displayLine++;
                const entryStart = cumTime + (entry.preDelay || 0);
                if (isTyping) {
                    const elapsed = artifactUI.bootTextTimer - entryStart;
                    if (elapsed < 0) { cumTime = entryStart + typeDuration + lineGap; continue; }
                    const progress = Math.min(1, elapsed / typeDuration);
                    const charCount = Math.floor(progress * entry.text.length);
                    if (charCount > 0) {
                        if (entry.append) {
                            const prevText = bootSeq[i - 1].text + ' ';
                            const prevWidth = ctx.measureText(prevText).width;
                            ctx.fillText(entry.text.substring(0, charCount), bootX + prevWidth, bootY + displayLine * bootLineH);
                        } else {
                            ctx.fillText(entry.text.substring(0, charCount), bootX, bootY + displayLine * bootLineH);
                        }
                    }
                } else {
                    // Boot done, show full text
                    if (entry.append) {
                        const prevText = bootSeq[i - 1].text + ' ';
                        const prevWidth = ctx.measureText(prevText).width;
                        ctx.fillText(entry.text, bootX + prevWidth, bootY + displayLine * bootLineH);
                    } else {
                        ctx.fillText(entry.text, bootX, bootY + displayLine * bootLineH);
                    }
                }
                cumTime = entryStart + typeDuration + lineGap;
            }
        } else {
            // Subsequent opens: persistent status lines
            const currentWave = gameState.waveNumber || 0;
            ctx.fillText('Mass-Energy Reassignment Reactor', bootX, bootY);
            ctx.fillText('Device ID #004.2', bootX, bootY + bootLineH);
            ctx.fillText(`E = ${Math.floor(gameState.points)} KJ`, bootX, bootY + bootLineH * 2);
            ctx.fillText(`S = ${currentWave}`, bootX, bootY + bootLineH * 3);
        }
        ctx.restore();
    }

    // --- Flash overlays (white flash, fade to game, fade to interface) ---
    if (artifactUI.flashPhase === 'white') {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (artifactUI.flashPhase === 'fade_to_game') {
        const alpha = artifactUI.flashTimer / 1.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha).toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (artifactUI.flashPhase === 'fade') {
        const alpha = artifactUI.flashTimer / 1.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha).toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Controls tutorial overlay
    drawControlsOverlay();

    // Pause overlay
    if (gameState.paused) drawPauseMenu();

    // Game over overlay
    if (gameState.gameOver) drawGameOver();
}
