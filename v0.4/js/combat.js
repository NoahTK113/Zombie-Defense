// ============================================================
// ZOMBIE DEFENSE - Combat (Bullets, Particles, Shooting)
// ============================================================

const bullets = [];
let shootCooldown = 0;
// zombiesKilled now lives in gameState
// particles array and spawn functions now live in particles.js

// Melee weapon state
let shovelCooldown = 0;
let shovelSwingTimer = 0;
let shovelSwingDir = 1; // 1 = right, -1 = left
let shovelTargetBlock = null; // { x, y } tile coords of currently targeted block
let meleeSwingDuration = SHOVEL_SWING_DURATION; // stored at swing start for animation
const meleeHitSet = new Set(); // zombie refs already hit this swing

// Raycast from player center toward cursor, find first solid block within range
function getShovelTargetBlock() {
    const aim = screenToWorld(mouse.x, mouse.y);
    const startX = player.x;
    const startY = player.y - player.h / 2;
    const dx = aim.x - startX;
    const dy = aim.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return null;
    const nx = dx / dist;
    const ny = dy / dist;
    const maxDist = getActiveWeapon().range * TILE_SIZE;
    const step = TILE_SIZE * 0.4;
    for (let d = TILE_SIZE * 0.5; d <= maxDist; d += step) {
        const wx = startX + nx * d;
        const wy = startY + ny * d;
        const tx = Math.floor(wx / TILE_SIZE);
        const ty = Math.floor(wy / TILE_SIZE);
        if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) continue;
        const tile = tileAt(tx, ty);
        if (tile === TILE.EARTH || tile === TILE.BRICK) {
            return { x: tx, y: ty };
        }
    }
    return null;
}

function screenToWorld(sx, sy) {
    const tileScreen = Math.max(1, Math.round(TILE_SIZE * camera.zoom));
    const effectiveZoom = tileScreen / TILE_SIZE;
    return { x: camera.x + sx / effectiveZoom, y: camera.y + sy / effectiveZoom };
}

function shootBullet() {
    const aim = screenToWorld(mouse.x, mouse.y);
    const startX = player.x;
    const startY = player.y - player.h / 2; // shoot from chest level
    const dx = aim.x - startX;
    const dy = aim.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const nx = dx / dist;
    const ny = dy / dist;
    bullets.push({
        x: startX, y: startY,
        vx: nx * BULLET_SPEED, vy: ny * BULLET_SPEED,
        pen: PISTOL_PENETRATION,
    });
    playSound('pistolShot');
    player.facingRight = nx > 0;
}

function shovelSwing() {
    if (shovelCooldown > 0 || shovelSwingTimer > 0 || player.dead || gameState.gameMode !== 'player') return;

    const weapon = getActiveWeapon();
    shovelCooldown = 0;
    shovelSwingTimer = weapon.speed;
    meleeSwingDuration = weapon.speed;
    meleeHitSet.clear();
    playSoundStretched('meleeSwing', weapon.speed, 0.3);

    // Swing toward cursor
    const aim = screenToWorld(mouse.x, mouse.y);
    const swingRight = aim.x >= player.x;
    player.facingRight = swingRight;
    shovelSwingDir = swingRight ? 1 : -1;

    // Hit the block targeted by cursor raycast (shovel only)
    if (!weapon.sprite) {
        const target = getShovelTargetBlock();
        if (target) {
            const tile = tileAt(target.x, target.y);
            spawnBlockHitParticles(target.x, target.y, tile);
            playSound('blockDig');
            damageBlock(target.x, target.y, weapon.blockDamage);
        }
    }

    // Run collider check immediately so first frame of swing can hit
    updateMeleeCollider();
}

// Rotated rectangle vs circle overlap test
function rotatedRectOverlapsCircle(rectCX, rectCY, halfW, halfH, angle, circleX, circleY, circleR) {
    // Transform circle center into the rotated rect's local space
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const dx = circleX - rectCX;
    const dy = circleY - rectCY;
    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;

    // Find closest point on rect to circle center (in local space)
    const closestX = Math.max(-halfW, Math.min(halfW, localX));
    const closestY = Math.max(-halfH, Math.min(halfH, localY));

    const distX = localX - closestX;
    const distY = localY - closestY;
    return (distX * distX + distY * distY) <= circleR * circleR;
}

function updateMeleeCollider() {
    if (shovelSwingTimer <= 0) return;

    const weapon = getActiveWeapon();
    const dir = shovelSwingDir;
    const progress = 1 - shovelSwingTimer / meleeSwingDuration;

    // Same angle math as renderer
    const startAngle = dir > 0 ? -Math.PI : Math.PI;
    const endAngle = 0;
    const angle = startAngle + (endAngle - startAngle) * progress;

    // Pivot point: matches renderer (hand position in world coords)
    // Renderer: handX = px + (aimingRight ? pw*0.8 : pw*0.2), handY = py + ph*0.55
    // px is player left edge = player.x - player.w/2, so:
    //   aimingRight: pivotX = (player.x - w/2) + w*0.8 = player.x + w*0.3
    //   aimingLeft:  pivotX = (player.x - w/2) + w*0.2 = player.x - w*0.3
    // py is player top = player.y - player.h, so:
    //   pivotY = (player.y - h) + h*0.55 = player.y - h*0.45
    const aimingRight = dir > 0;
    const pivotX = player.x + (aimingRight ? player.w * 0.3 : -player.w * 0.3);
    const pivotY = player.y - player.h * 0.45;

    // Arm offset + collider offset (handle length) + half collider height = center distance
    const armOffset = 1.0 * TILE_SIZE;
    const colliderOffsetPx = weapon.colliderOffset * TILE_SIZE;
    const colliderHalfH = (weapon.colliderHeight * TILE_SIZE) / 2;
    const centerDist = armOffset + colliderOffsetPx + colliderHalfH;

    // Canvas rotate() is clockwise, so local +Y after rotation maps to
    // (-sin(angle), cos(angle)) in world space
    const colliderCX = pivotX - Math.sin(angle) * centerDist;
    const colliderCY = pivotY + Math.cos(angle) * centerDist;

    const halfW = (weapon.colliderWidth * TILE_SIZE) / 2;
    const halfH = colliderHalfH;

    // Test against all zombies using their circle collider
    const zr = ZOMBIE_COLLISION_R;
    for (const z of zombies) {
        if (meleeHitSet.has(z)) continue;

        // Zombie circle center at body midpoint (same as resolveZombieCollisions)
        const zcx = z.x;
        const zcy = z.y - z.h / 2;

        if (rotatedRectOverlapsCircle(colliderCX, colliderCY, halfW, halfH, angle, zcx, zcy, zr)) {
            z.hp -= weapon.damage;
            const knockDir = z.x > player.x ? 1 : -1;
            z.vx += knockDir * weapon.knockback;
            z.vy -= weapon.knockback * 0.3;
            // Knock absorbing zombies out of absorption
            if (z.state === 'absorbing') {
                z.state = z.type === 'flyer' ? 'flying' : 'walking';
                z.absorbTimer = 0;
                z.absorbImmunity = 0.3; // brief immunity so knockback can move them away
            }
            meleeHitSet.add(z);
            playSound('meleeHit');
        }
    }
}

function updateBullets(dt) {
    // Update shovel target block preview (shovel only)
    if (gameState.gameMode === 'player' && !player.dead && !isInterfaceOpen() && !getActiveWeapon().sprite) {
        shovelTargetBlock = getShovelTargetBlock();
    } else {
        shovelTargetBlock = null;
    }

    // Cooldowns
    if (shootCooldown > 0) shootCooldown -= dt;
    if (shovelCooldown > 0) shovelCooldown -= dt;

    // Per-frame melee collider check BEFORE timer decrement (so final frame isn't skipped)
    updateMeleeCollider();

    if (shovelSwingTimer > 0) shovelSwingTimer -= dt;

    // Melee: shovel swing on left click or hold
    if (mouse.leftDown && gameState.gameMode === 'player' && !player.dead && !isInterfaceOpen()) {
        shovelSwing();
    }
    mouse.justClicked = false;

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const moveX = b.vx * dt;
        const moveY = b.vy * dt;
        const dist = Math.sqrt(moveX * moveX + moveY * moveY);
        const stepSize = TILE_SIZE * 0.6;
        const steps = Math.max(1, Math.ceil(dist / stepSize));
        const sx = moveX / steps, sy = moveY / steps;
        let removed = false;

        for (let s = 0; s < steps; s++) {
            b.x += sx;
            b.y += sy;

            if (b.x < 0 || b.x > WORLD_W * TILE_SIZE || b.y < 0 || b.y > WORLD_H * TILE_SIZE) {
                removed = true; break;
            }

            const tx = Math.floor(b.x / TILE_SIZE);
            const ty = Math.floor(b.y / TILE_SIZE);
            const bt = tileAt(tx, ty);
            if (bt === TILE.EARTH || bt === TILE.BRICK) {
                removed = true; break;
            }

            for (const z of zombies) {
                const zb = getZombieBounds(z);
                if (b.x >= zb.left && b.x <= zb.right && b.y >= zb.top && b.y <= zb.bottom) {
                    z.hp -= PISTOL_DAMAGE;
                    const bLen = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                    if (bLen > 0) {
                        z.vx += (b.vx / bLen) * ZOMBIE_KNOCKBACK;
                        z.vy += (b.vy / bLen) * ZOMBIE_KNOCKBACK * 0.3;
                    }
                    // Knock absorbing zombies out of absorption
                    if (z.state === 'absorbing') {
                        z.state = z.type === 'flyer' ? 'flying' : 'walking';
                        z.absorbTimer = 0;
                        z.absorbImmunity = 0.3;
                    }
                    spawnHitParticles(b.x, b.y, b.vx, b.vy);
                    playSound('bulletHit');
                    b.pen--;
                    if (b.pen <= 0) break;
                }
            }
            if (b.pen <= 0) { removed = true; break; }
        }
        if (removed || b.pen <= 0) {
            bullets.splice(i, 1);
        }
    }

    // Kill zombies with 0 HP
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (zombies[i].hp <= 0) {
            spawnDeathParticles(zombies[i]);
            playSound('zombieDeath');
            gameState.zombiesKilled++;
            gameState.points += 100;
            zombies.splice(i, 1);
        }
    }
}

