// ============================================================
// ZOMBIE DEFENSE - HUD (KJ Counter, Round, Weapon Display, Controls)
// ============================================================

// --- Controls Button Geometry (upper-right corner) ---
const CONTROLS_BTN = { w: 28, h: 28, margin: 12 };

function getControlsBtnRect() {
    return {
        x: canvas.width - CONTROLS_BTN.w - CONTROLS_BTN.margin,
        y: CONTROLS_BTN.margin,
        w: CONTROLS_BTN.w,
        h: CONTROLS_BTN.h
    };
}

function drawHUD() {
    // --- KJ Counter + Round Counter (center-left, shown after first artifact use) ---
    if (gameState.hasUsedArtifact && !intro.active) {
        ctx.save();
        const hudX = 20;
        const hudY = canvas.height / 2 - 20;
        ctx.font = 'bold 22px Jura, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(100, 210, 255, 0.9)';
        ctx.fillText(`${gameState.points} KJ`, hudX, hudY);
        ctx.font = '16px Jura, sans-serif';
        ctx.fillStyle = 'rgba(100, 210, 255, 0.7)';
        ctx.fillText(`Round ${wave.number}`, hudX, hudY + 22);
        ctx.restore();
    }

    // --- Weapon HUD (left side, 1/4 up from bottom) ---
    if (!intro.active && gameState.gameMode === 'player' && !player.dead) {
        ctx.save();
        const hudX = 20;
        const hudY = Math.round(canvas.height * 0.75);
        const weapon = getActiveWeapon();

        if (weapon.sprite && weapon.sprite.complete) {
            // Draw crafted weapon sprite as icon
            const iconH = 32;
            const spriteAspect = weapon.sprite.width / weapon.sprite.height;
            const iconW = iconH * spriteAspect;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(weapon.sprite, hudX, hudY - 8, iconW, iconH);
            ctx.imageSmoothingEnabled = true;
            // Weapon name
            ctx.font = '14px Jura, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
            ctx.fillText(weapon.name, hudX + iconW + 8, hudY + 12);
        } else {
            // Built-in shovel pictogram
            const iconX = hudX;
            const iconY = hudY;
            ctx.fillStyle = '#999';
            ctx.fillRect(iconX, iconY + 5, 24, 4);
            ctx.fillStyle = '#999';
            ctx.fillRect(iconX + 24, iconY, 14, 14);
            ctx.fillStyle = '#bbb';
            ctx.fillRect(iconX + 36, iconY, 2, 14);
            // Weapon name
            ctx.font = '14px Jura, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
            ctx.fillText(weapon.name, hudX + 44, hudY + 12);
        }

        // Weapon slot indicator (if multiple weapons)
        if (weapons.length > 1) {
            ctx.font = '11px Jura, sans-serif';
            ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
            ctx.fillText(`[Q] ${activeWeaponIndex + 1}/${weapons.length}`, hudX, hudY + 28);
        }

        ctx.restore();
    }

    // --- Controls Button (upper-right "?" icon) ---
    if (!intro.active) {
        ctx.save();
        const btn = getControlsBtnRect();
        ctx.fillStyle = 'rgba(20, 30, 50, 0.6)';
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.font = 'bold 18px Jura, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(100, 210, 255, 0.8)';
        ctx.fillText('?', btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.restore();
    }
}

// --- Controls Panel (compact, upper-right quadrant) ---
function drawControlsOverlay() {
    if (!gameState.controlsOpen) return;
    ctx.save();

    const btn = getControlsBtnRect();
    const panelW = 240;
    const lineH = 18;
    const controls = [
        ['WASD', 'Move'],
        ['W / Space', 'Jump'],
        ['Left Click', 'Attack'],
        ['E', 'Artifact'],
        ['F', 'Flashlight'],
        ['Q', 'Swap Weapon'],
        ['H', 'Start Wave'],
        ['Tab', 'Comms'],
        ['Esc', 'Pause'],
        null,
        ['Left Click', 'Place / Dig'],
        ['Right Drag', 'Pan'],
        ['Scroll', 'Zoom'],
    ];
    const panelH = 30 + controls.length * lineH + 6;
    const panelX = btn.x + btn.w - panelW;
    const panelY = btn.y + btn.h + 4;

    // Panel background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.strokeStyle = 'rgba(100, 210, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.font = 'bold 13px Jura, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(100, 210, 255, 0.9)';
    ctx.fillText('Controls', panelX + panelW / 2, panelY + 16);

    // Controls list
    const startY = panelY + 30;
    const keyX = panelX + 10;
    const descX = panelX + 110;

    for (let i = 0; i < controls.length; i++) {
        const entry = controls[i];
        const y = startY + i * lineH;

        if (entry === null) {
            // Build mode divider
            ctx.strokeStyle = 'rgba(100, 210, 255, 0.2)';
            ctx.beginPath();
            ctx.moveTo(panelX + 10, y + 2);
            ctx.lineTo(panelX + panelW - 10, y + 2);
            ctx.stroke();
            ctx.font = '10px Jura, sans-serif';
            ctx.fillStyle = 'rgba(100, 210, 255, 0.5)';
            ctx.textAlign = 'left';
            ctx.fillText('BUILD MODE', keyX, y + 13);
            continue;
        }

        const [key, desc] = entry;
        ctx.font = 'bold 11px Jura, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(180, 210, 255, 0.85)';
        ctx.fillText(key, keyX, y + 13);

        ctx.font = '11px Jura, sans-serif';
        ctx.fillStyle = 'rgba(180, 210, 255, 0.5)';
        ctx.fillText(desc, descX, y + 13);
    }

    ctx.restore();
}

// --- Controls Click Handler ---
function controlsHandleClick(mx, my) {
    const btn = getControlsBtnRect();
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        gameState.controlsOpen = !gameState.controlsOpen;
        return true;
    }
    // Click outside panel closes it
    if (gameState.controlsOpen) {
        gameState.controlsOpen = false;
    }
    return false;
}
