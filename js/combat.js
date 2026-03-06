// ============================================================
// ZOMBIE DEFENSE - Combat (Bullets, Particles, Shooting)
// ============================================================

const bullets = [];
const particles = [];
let shootCooldown = 0;
let zombiesKilled = 0;

// Melee weapon state
let shovelCooldown = 0;
let shovelSwingTimer = 0;
let shovelSwingDir = 1; // 1 = right, -1 = left
let shovelTargetBlock = null; // { x, y } tile coords of currently targeted block
let meleeSwingDuration = SHOVEL_SWING_DURATION; // stored at swing start for animation
const meleeHitSet = new Set(); // zombie refs already hit this swing

function spawnBlockHitParticles(tx, ty, tileType) {
    const cx = (tx + 0.5) * TILE_SIZE;
    const cy = (ty + 0.5) * TILE_SIZE;
    const count = 5;
    const isEarth = tileType === TILE.EARTH;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 80;
        const size = 2 + Math.random() * 3;
        particles.push({
            x: cx + (Math.random() - 0.5) * TILE_SIZE * 0.6,
            y: cy + (Math.random() - 0.5) * TILE_SIZE * 0.6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 50,
            size: size,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.6,
            r: isEarth ? 100 + Math.floor(Math.random() * 40) : 140 + Math.floor(Math.random() * 40),
            g: isEarth ? 70 + Math.floor(Math.random() * 30) : 100 + Math.floor(Math.random() * 30),
            b: isEarth ? 40 + Math.floor(Math.random() * 20) : 80 + Math.floor(Math.random() * 20),
        });
    }
}

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
    player.facingRight = nx > 0;
}

function spawnDeathParticles(z) {
    const cx = z.x;
    const cy = z.y - z.h / 2;
    for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 140;
        const size = 3 + Math.random() * 5;
        const isRed = Math.random() < 0.3;
        const r = isRed ? 180 + Math.floor(Math.random() * 75) : 80 + Math.floor(Math.random() * 40);
        const g = isRed ? 20 + Math.floor(Math.random() * 30) : 80 + Math.floor(Math.random() * 40);
        const b = isRed ? 20 + Math.floor(Math.random() * 30) : 80 + Math.floor(Math.random() * 40);
        particles.push({
            x: cx + (Math.random() - 0.5) * z.w,
            y: cy + (Math.random() - 0.5) * z.h * 0.6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 80,
            size: size,
            life: DEATH_PARTICLE_LIFE,
            maxLife: DEATH_PARTICLE_LIFE,
            r: r, g: g, b: b,
        });
    }
}

function spawnPlayerDeathParticles() {
    const cx = player.x;
    const cy = player.y - player.h / 2;
    const count = 12;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 160;
        const size = 3 + Math.random() * 6;
        const isRed = Math.random() < 0.3;
        const r = isRed ? 180 + Math.floor(Math.random() * 75) : 30 + Math.floor(Math.random() * 30);
        const g = isRed ? 20 + Math.floor(Math.random() * 30) : 160 + Math.floor(Math.random() * 60);
        const b = isRed ? 20 + Math.floor(Math.random() * 30) : 60 + Math.floor(Math.random() * 50);
        particles.push({
            x: cx + (Math.random() - 0.5) * player.w,
            y: cy + (Math.random() - 0.5) * player.h * 0.6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 100,
            size: size,
            life: DEATH_PARTICLE_LIFE * 1.5,
            maxLife: DEATH_PARTICLE_LIFE * 1.5,
            r: r, g: g, b: b,
        });
    }
}

function spawnHitParticles(x, y, bvx, bvy) {
    const count = 3;
    const bLen = Math.sqrt(bvx * bvx + bvy * bvy);
    const bnx = bLen > 0 ? bvx / bLen : 0;
    const bny = bLen > 0 ? bvy / bLen : -1;
    for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 2.5;
        const speed = 40 + Math.random() * 80;
        const vx = -bnx * speed + spread * 60;
        const vy = -bny * speed + (Math.random() - 0.5) * 60 - 30;
        const size = 2 + Math.random() * 3;
        const isRed = Math.random() < 0.5;
        particles.push({
            x: x, y: y,
            vx: vx, vy: vy,
            size: size,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.6,
            r: isRed ? 180 + Math.floor(Math.random() * 75) : 80 + Math.floor(Math.random() * 30),
            g: isRed ? 20 : 70 + Math.floor(Math.random() * 30),
            b: isRed ? 20 : 70 + Math.floor(Math.random() * 30),
        });
    }
}

function shovelSwing() {
    if (shovelCooldown > 0 || shovelSwingTimer > 0 || player.dead || gameMode !== 'player') return;

    const weapon = getActiveWeapon();
    shovelCooldown = 0;
    shovelSwingTimer = weapon.speed;
    meleeSwingDuration = weapon.speed;
    meleeHitSet.clear();

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
        }
    }
}

function updateBullets(dt) {
    // Update shovel target block preview (shovel only)
    if (gameMode === 'player' && !player.dead && !interfaceOpen && !getActiveWeapon().sprite) {
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
    if (mouse.leftDown && gameMode === 'player' && !player.dead && !interfaceOpen) {
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
            zombiesKilled++;
            points += 100;
            zombies.splice(i, 1);
        }
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += GRAVITY * 0.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}
