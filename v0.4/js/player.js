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

    // Horizontal input (acceleration-based, 0→max in 0.5 seconds)
    const playerAccel = player.speed / 0.5;
    const moveLeft = keys['KeyA'] || keys['ArrowLeft'];
    const moveRight = keys['KeyD'] || keys['ArrowRight'];
    if (moveLeft && !moveRight) {
        player.vx -= playerAccel * dt;
        if (player.vx < -player.speed) player.vx = -player.speed;
        player.facingRight = false;
    } else if (moveRight && !moveLeft) {
        player.vx += playerAccel * dt;
        if (player.vx > player.speed) player.vx = player.speed;
        player.facingRight = true;
    } else {
        // No input: decelerate to stop
        if (Math.abs(player.vx) < playerAccel * dt) player.vx = 0;
        else player.vx -= Math.sign(player.vx) * playerAccel * dt;
    }

    // Jump
    if ((keys['KeyW'] || keys['Space'] || keys['ArrowUp']) && player.onGround) {
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
    if (code === 'KeyQ' && weapons.length > 1) {
        activeWeaponIndex = (activeWeaponIndex + 1) % weapons.length;
    }
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
    player.x = (PEDESTAL_CENTER_X + 0.5) * TILE_SIZE;
    player.y = ARTIFACT_TY * TILE_SIZE; // feet on top of artifact
}
