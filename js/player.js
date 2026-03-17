// ============================================================
// ZOMBIE DEFENSE - Player
// ============================================================

const player = {
    x: (ARTIFACT_TX + ARTIFACT_SIZE + INTRO_SPAWN_OFFSET) * TILE_SIZE + TILE_SIZE / 2,
    y: (GROUND_LEVEL) * TILE_SIZE,       // feet on ground (adjusted at init for terrain)
    w: TILE_SIZE * 0.8,
    h: TILE_SIZE * 1.8,
    vx: 0,
    vy: 0,
    speed: 200,
    jumpForce: -440,
    onGround: false,
    facingRight: true,
    hp: PLAYER_MAX_HP,
    invulnTimer: 0,
    dead: false,
    respawnTimer: 0,
    damageFlash: 0,
    dashFuel: DASH_FUEL_MAX,
    dashEmptyCooldown: 0,
    dashSlowActive: false,
    dashKeyUsed: false,
    dashBurstUsed: 0,
};

function getPlayerBounds() {
    return {
        left: player.x - player.w / 2,
        right: player.x + player.w / 2,
        top: player.y - player.h,
        bottom: player.y,
    };
}

function playerOccupiesTile(tx, ty) {
    const b = getPlayerBounds();
    const tl = tx * TILE_SIZE;
    const tr = (tx + 1) * TILE_SIZE;
    const tt = ty * TILE_SIZE;
    const tb = (ty + 1) * TILE_SIZE;
    return b.left < tr && b.right > tl && b.top < tb && b.bottom > tt;
}

function updatePlayer(dt) {
    if (gameState.gameOver) return;
    // Dead: tick respawn timer, skip all movement
    if (player.dead) {
        if (gameState.artifactCorrupted) {
            // Artifact corrupted + player dead = game over
            gameState.gameOver = true;
            return;
        }
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
            respawnPlayer();
        }
        return;
    }

    // Build mode: freeze player, only apply gravity + resolve
    if (gameState.gameMode === 'build') {
        player.vx = 0;
        player.vy += GRAVITY * dt;
        player.y += player.vy * dt;
        resolvePlayerY();
        return;
    }

    // Interface open: no input, decelerate to stop, keep physics
    if (isInterfaceOpen()) {
        const decel = player.speed / 0.5;
        if (Math.abs(player.vx) < decel * dt) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * decel * dt;
        player.vy += GRAVITY * dt;
        player.x += player.vx * dt;
        resolvePlayerX();
        player.y += player.vy * dt;
        resolvePlayerY();
        return;
    }

    // === Acceleration-based movement: WD + friction + dash ===

    const playerAccel = player.speed / 0.5; // 400 px/sec²
    const moveLeft = keys['KeyA'] || keys['ArrowLeft'];
    const moveRight = keys['KeyD'] || keys['ArrowRight'];
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

    // --- Component 1: WD walking input (zeroed when at or above walking speed) ---
    let wdAx = 0;
    if (Math.abs(player.vx) < player.speed) {
        if (moveLeft && !moveRight) {
            wdAx = -playerAccel;
            player.facingRight = false;
        } else if (moveRight && !moveLeft) {
            wdAx = playerAccel;
            player.facingRight = true;
        } else {
            // No input: decelerate to stop (only below walking speed)
            if (Math.abs(player.vx) < playerAccel * dt) player.vx = 0;
            else wdAx = -Math.sign(player.vx) * playerAccel;
        }
    } else {
        // Above walking speed: still update facing direction
        if (moveLeft && !moveRight) player.facingRight = false;
        else if (moveRight && !moveLeft) player.facingRight = true;
    }

    // --- Component 2: Dash thruster (Shift + direction, fuel-limited) ---
    let dashAx = 0, dashAy = 0;
    let activelyDashing = false;
    const shifting = keys['ShiftLeft'] || keys['ShiftRight'];

    // Require shift+direction release between dashes
    if (!shifting || (!moveLeft && !moveRight && !(keys['KeyW'] || keys['ArrowUp'] || keys['Space']) && !(keys['KeyS'] || keys['ArrowDown']))) {
        player.dashKeyUsed = false;
        player.dashBurstUsed = 0;
    }

    if (shifting && !player.dashKeyUsed && player.dashFuel > 0 && player.dashEmptyCooldown <= 0) {
        // Build dash direction from held keys
        let ddx = 0, ddy = 0;
        if (moveLeft) ddx -= 1;
        if (moveRight) ddx += 1;
        if (keys['KeyW'] || keys['ArrowUp'] || keys['Space']) ddy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) ddy += 1;

        if (ddx !== 0 || ddy !== 0) {
            const dlen = Math.sqrt(ddx * ddx + ddy * ddy);
            dashAx = (ddx / dlen) * DASH_ACCEL;
            dashAy = (ddy / dlen) * DASH_ACCEL;
            activelyDashing = true;
            player.dashSlowActive = true;

            // Consume fuel
            const fuelUsed = DASH_FUEL_CONSUME * dt;
            player.dashFuel -= fuelUsed;
            player.dashBurstUsed += fuelUsed;

            if (player.dashFuel <= 0) {
                player.dashFuel = 0;
                player.dashEmptyCooldown = DASH_EMPTY_COOLDOWN;
                player.dashKeyUsed = true;
            } else if (player.dashBurstUsed >= DASH_BURST_COST) {
                player.dashKeyUsed = true;
            }
        }
    }

    // Fuel regen (only when not actively dashing)
    if (!activelyDashing) {
        if (player.dashEmptyCooldown > 0) {
            player.dashEmptyCooldown -= dt;
        } else if (player.dashFuel < DASH_FUEL_MAX) {
            player.dashFuel = Math.min(DASH_FUEL_MAX, player.dashFuel + DASH_FUEL_REGEN * dt);
        }
    }

    // Walking deceleration extends above player.speed when no input and not dashing
    if (Math.abs(player.vx) >= player.speed && !moveLeft && !moveRight && !activelyDashing) {
        wdAx = -Math.sign(player.vx) * playerAccel;
    }

    // --- Component 3: Dash slowdown (constant decel when above target and not thrusting) ---
    let slowAx = 0, slowAy = 0;
    if (!activelyDashing && player.dashSlowActive) {
        if (speed <= DASH_SLOW_TARGET) {
            // Reached target speed — disarm slowdown
            player.dashSlowActive = false;
        } else {
            const excess = speed - DASH_SLOW_TARGET;
            if (excess < DASH_SLOW_SNAP) {
                // Snap: scale velocity down to target speed
                const scale = DASH_SLOW_TARGET / speed;
                player.vx *= scale;
                player.vy *= scale;
                player.dashSlowActive = false;
            } else {
                // Constant deceleration opposing velocity (subtract gravity from Y to avoid double-decel)
                slowAx = -(player.vx / speed) * DASH_SLOW_DECEL;
                slowAy = -(player.vy / speed) * DASH_SLOW_DECEL - GRAVITY;
            }
        }
    }

    // --- Sum accelerations and integrate velocity ---
    player.vx += (wdAx + dashAx + slowAx) * dt;
    player.vy += (dashAy + slowAy) * dt;

    // Jump (instant impulse, not an acceleration)
    if ((keys['Space'] || keys['ArrowUp']) && player.onGround) {
        player.vy = player.jumpForce;
        player.onGround = false;
    }

    // Gravity
    player.vy += GRAVITY * dt;

    // Move horizontally then resolve (with step-up for 1-tile ledges)
    player.x += player.vx * dt;
    tryStepUp(player);
    resolvePlayerX();

    // Move vertically then resolve
    player.y += player.vy * dt;
    resolvePlayerY();
}

function resolvePlayerX() {
    const b = getPlayerBounds();
    const tileTop = Math.floor(b.top / TILE_SIZE);
    const tileBot = Math.floor((b.bottom - 1) / TILE_SIZE);

    // Check left
    const tileLeft = Math.floor(b.left / TILE_SIZE);
    for (let ty = tileTop; ty <= tileBot; ty++) {
        if (isSolid(tileLeft, ty)) {
            player.x = (tileLeft + 1) * TILE_SIZE + player.w / 2;
            player.vx = 0;
            break;
        }
    }

    // Recheck right after potential correction
    const b2 = getPlayerBounds();
    const tileRight = Math.floor((b2.right - 1) / TILE_SIZE);
    for (let ty = tileTop; ty <= tileBot; ty++) {
        if (isSolid(tileRight + (b2.right % TILE_SIZE === 0 ? 0 : 0), ty) && Math.floor(b2.right / TILE_SIZE) !== Math.floor((b2.left) / TILE_SIZE)) {
            // Only collide if right edge actually enters a new tile
            const rightTile = Math.floor(b2.right / TILE_SIZE);
            if (isSolid(rightTile, ty) && b2.right > rightTile * TILE_SIZE) {
                player.x = rightTile * TILE_SIZE - player.w / 2;
                player.vx = 0;
                break;
            }
        }
    }
}

function resolvePlayerY() {
    const b = getPlayerBounds();
    const tileLeft = Math.floor(b.left / TILE_SIZE);
    const tileRight = Math.floor((b.right - 1) / TILE_SIZE);

    player.onGround = false;

    if (player.vy >= 0) {
        // Falling — check below
        const tileBot = Math.floor(b.bottom / TILE_SIZE);
        for (let tx = tileLeft; tx <= tileRight; tx++) {
            if (isSolid(tx, tileBot)) {
                player.y = tileBot * TILE_SIZE;
                player.vy = 0;
                player.onGround = true;
                break;
            }
        }
    } else {
        // Rising — check above
        const tileTop = Math.floor(b.top / TILE_SIZE);
        for (let tx = tileLeft; tx <= tileRight; tx++) {
            if (isSolid(tx, tileTop)) {
                player.y = (tileTop + 1) * TILE_SIZE + player.h;
                player.vy = 0;
                break;
            }
        }
    }
}

// --- Player Input Handler (called by input.js router) ---
function playerHandleKey(code) {
    if (player.dead || gameState.gameOver) return;
    if (code === 'KeyF') {
        gameState.flashlightOn = !gameState.flashlightOn;
        playSound(gameState.flashlightOn ? 'flashlightOn' : 'flashlightOff');
        if (gameState.tutorialStep === 'flashlight') gameState.tutorialStep = 'comms';
    }
    // Weapon cycling moved to Tab in input.js
    if (code === 'KeyE') {
        artifactHandleKey(code);
    }
}

function killPlayer() {
    player.dead = true;
    player.respawnTimer = PLAYER_RESPAWN_TIME;
    gameState.gameMode = 'player'; // force out of build mode
    spawnPlayerDeathParticles();
    playSound('playerDeath');
}

function respawnPlayer() {
    player.dead = false;
    player.hp = PLAYER_MAX_HP;
    player.invulnTimer = 1.0; // brief invuln after respawn
    playSound('playerRespawn');
    player.vx = 0;
    player.vy = 0;
    // Spawn on top of the artifact
    player.x = (ARTIFACT_CENTER_X + 0.5) * TILE_SIZE;
    player.y = ARTIFACT_TY * TILE_SIZE; // feet on top of artifact
}
