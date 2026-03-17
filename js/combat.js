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
let shovelSwingDir = 1; // 1 = right, -1 = left (kept for facing)
let meleeAimAngle = 0;  // angle from player to cursor, stored at swing start
let meleeSwingCW = true; // true = clockwise, false = counter-clockwise
let meleeLastSwingCW = null; // direction of last completed swing (null = no history)
let meleeGripDist = 0;      // how far weapon extends from pivot this swing (choke-up)
let shovelTargetBlock = null; // { x, y } tile coords of currently targeted block
let meleeSwingDuration = SHOVEL_SWING_DURATION; // stored at swing start for animation
const meleeHitSet = new Set(); // zombie refs already hit this swing
let debugCollider = null; // exposed for debug overlay: { cx, cy, halfW, halfH, angle }

// Swing easing: cubic hermite spline from 0→1 with asymmetric velocity
// startVel/endVel are fractions of average velocity (0.2 = 20% of peak)
// Peak velocity shifts slightly past midpoint due to lower start than end
const SWING_START_VEL = 0.2;
const SWING_END_VEL = 0.3;
function swingEase(t) {
    const t2 = t * t, t3 = t2 * t;
    // Hermite basis: h(t) = d0*(t³-2t²+t) + (-2t³+3t²) + d1*(t³-t²)
    return SWING_START_VEL * (t3 - 2 * t2 + t) + (-2 * t3 + 3 * t2) + SWING_END_VEL * (t3 - t2);
}
// Derivative of swingEase for angular velocity scaling
function swingEaseVel(t) {
    const t2 = t * t;
    return SWING_START_VEL * (3 * t2 - 4 * t + 1) + (-6 * t2 + 6 * t) + SWING_END_VEL * (3 * t2 - 2 * t);
}

// Screen shake state
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

function triggerScreenShake(intensity, duration) {
    screenShakeTimer = duration;
    screenShakeIntensity = Math.max(screenShakeIntensity, intensity);
}

function updateScreenShake(dt) {
    if (screenShakeTimer > 0) screenShakeTimer -= dt;
    if (screenShakeTimer <= 0) { screenShakeIntensity = 0; screenShakeTimer = 0; }
}

function getScreenShakeOffset() {
    if (screenShakeTimer <= 0) return { x: 0, y: 0 };
    const t = screenShakeTimer; // decays naturally since intensity stays constant
    const mag = screenShakeIntensity * (screenShakeTimer > 0 ? 1 : 0);
    return {
        x: (Math.random() - 0.5) * 2 * mag,
        y: (Math.random() - 0.5) * 2 * mag,
    };
}

// Swing trail: records weapon tip positions for fading arc effect
const SWING_TRAIL_FADE = 0.2; // seconds for trail points to fade out
const swingTrail = []; // { x, y, age } in world coords

// Raycast from player center toward cursor, find first solid block within range
function getShovelTargetBlock() {
    const aim = physicsScreenToWorld(mouse.x, mouse.y);
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


function shootBullet() {
    const aim = physicsScreenToWorld(mouse.x, mouse.y);
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

function shovelSwing(clockwise = true) {
    if (shovelSwingTimer > 0 || player.dead || gameState.gameMode !== 'player') return;
    // Same-direction cooldown; opposite direction skips it
    if (shovelCooldown > 0 && meleeLastSwingCW === clockwise) return;

    const weapon = getActiveWeapon();
    shovelCooldown = 0;
    const dur = Math.max(MELEE_MIN_SWING_DURATION, weapon.speed * MELEE_SWING_SPEED_MULT);
    shovelSwingTimer = dur;
    meleeSwingDuration = dur;
    meleeHitSet.clear();
    swingTrail.length = 0;
    meleeSwingCW = clockwise;
    playSoundStretched('meleeSwing', dur, 0.3);

    // Swing toward cursor — store aim angle for directional arc
    const aim = physicsScreenToWorld(mouse.x, mouse.y);
    const pivotX = player.x;
    const pivotY = player.y - player.h * 0.45;
    const dx = aim.x - pivotX;
    const dy = aim.y - pivotY;
    meleeAimAngle = Math.atan2(dy, dx);
    const swingRight = aim.x >= player.x;
    player.facingRight = swingRight;
    shovelSwingDir = swingRight ? 1 : -1;

    // Choke-up: cursor distance sets collider center, not tip
    const cursorDist = Math.sqrt(dx * dx + dy * dy);
    const armOffset = 1.0 * TILE_SIZE;
    const meleeHPx = weapon.colliderHeight * TILE_SIZE;
    const tipBuffer = MELEE_COLLIDER_TIP_BUFFER * TILE_SIZE;
    const halfCollider = (meleeHPx + tipBuffer) / 2;
    const fullTip = armOffset + weapon.colliderOffset * TILE_SIZE + meleeHPx;
    const minGrip = armOffset + meleeHPx; // at minimum, weapon head must clear the hand
    meleeGripDist = Math.max(minGrip, Math.min(fullTip, cursorDist + halfCollider));

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

// Rotated rectangle vs axis-aligned bounding box (SAT with 4 axes)
function rotatedRectOverlapsAABB(rectCX, rectCY, halfW, halfH, angle, aabb) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Rotated rect corners (world space)
    const ax0 = -halfW, ay0 = -halfH;
    const ax1 =  halfW, ay1 = -halfH;
    const ax2 =  halfW, ay2 =  halfH;
    const ax3 = -halfW, ay3 =  halfH;
    const rcX = [
        rectCX + cos * ax0 - sin * ay0,
        rectCX + cos * ax1 - sin * ay1,
        rectCX + cos * ax2 - sin * ay2,
        rectCX + cos * ax3 - sin * ay3,
    ];
    const rcY = [
        rectCY + sin * ax0 + cos * ay0,
        rectCY + sin * ax1 + cos * ay1,
        rectCY + sin * ax2 + cos * ay2,
        rectCY + sin * ax3 + cos * ay3,
    ];
    // AABB corners
    const bx = [aabb.left, aabb.right, aabb.right, aabb.left];
    const by = [aabb.top, aabb.top, aabb.bottom, aabb.bottom];
    // 4 separating axes: 2 from rotated rect edges, 2 world axes
    const axes = [
        { x: cos, y: sin },    // rotated rect local X
        { x: -sin, y: cos },   // rotated rect local Y
        { x: 1, y: 0 },        // world X
        { x: 0, y: 1 },        // world Y
    ];
    for (const axis of axes) {
        let minA = Infinity, maxA = -Infinity;
        let minB = Infinity, maxB = -Infinity;
        for (let i = 0; i < 4; i++) {
            const pa = rcX[i] * axis.x + rcY[i] * axis.y;
            if (pa < minA) minA = pa;
            if (pa > maxA) maxA = pa;
            const pb = bx[i] * axis.x + by[i] * axis.y;
            if (pb < minB) minB = pb;
            if (pb > maxB) maxB = pb;
        }
        if (maxA < minB || maxB < minA) return false; // separated
    }
    return true;
}

function updateMeleeCollider() {
    if (shovelSwingTimer <= 0) { debugCollider = null; return; }

    const weapon = getActiveWeapon();
    const progress = 1 - shovelSwingTimer / meleeSwingDuration;

    // Directional swing with inertia: cosine easing, arc centered on aim
    // Weapon extends along local +Y, so canvas angle for aim = aimAngle - PI/2
    const canvasAim = meleeAimAngle - Math.PI / 2;
    const halfArc = MELEE_SWING_ARC / 2;
    const startAngle = meleeSwingCW ? canvasAim - halfArc : canvasAim + halfArc;
    const endAngle = meleeSwingCW ? canvasAim + halfArc : canvasAim - halfArc;
    // Hermite easing: starts at 20% peak velocity, ends at 30% peak velocity
    // Peak shifts slightly past midpoint due to asymmetric start/end
    const easedProgress = swingEase(progress);
    const angle = startAngle + (endAngle - startAngle) * easedProgress;

    // Pivot at player center-shoulder (direction-independent)
    const pivotX = player.x;
    const pivotY = player.y - player.h * 0.45;

    // Collider uses meleeGripDist (choke-up) instead of full weapon tip
    const armOffset = 1.0 * TILE_SIZE;
    const meleeHPx = weapon.colliderHeight * TILE_SIZE;
    const tipBuffer = MELEE_COLLIDER_TIP_BUFFER * TILE_SIZE;
    const fullTipDist = armOffset + weapon.colliderOffset * TILE_SIZE + meleeHPx;
    const gripScale = meleeGripDist / fullTipDist; // knockback scales with effective reach
    const weaponTip = meleeGripDist + tipBuffer;
    const fullLength = meleeHPx + tipBuffer;
    const halfH = fullLength / 2;
    const centerDist = weaponTip - halfH; // collider covers weapon head + tip buffer only

    // Canvas rotate() is clockwise, so local +Y after rotation maps to
    // (-sin(angle), cos(angle)) in world space
    const colliderCX = pivotX - Math.sin(angle) * centerDist;
    const colliderCY = pivotY + Math.cos(angle) * centerDist;

    const halfW = (weapon.colliderWidth * TILE_SIZE) / 2;

    // Expose for debug overlay
    debugCollider = { cx: colliderCX, cy: colliderCY, halfW, halfH, angle };

    // Record swing trail point at visual weapon tip (exclude collider buffer)
    const visualTip = weaponTip - tipBuffer;
    const tipX = pivotX - Math.sin(angle) * visualTip;
    const tipY = pivotY + Math.cos(angle) * visualTip;
    swingTrail.push({ x: tipX, y: tipY, age: 0 });

    // Test against all zombies using their AABB (same as bullet hits)
    for (const z of zombies) {
        if (meleeHitSet.has(z)) continue;

        const zb = getZombieBounds(z);
        zb.left -= MELEE_HIT_PADDING;
        zb.right += MELEE_HIT_PADDING;
        zb.top -= MELEE_HIT_PADDING;
        zb.bottom += MELEE_HIT_PADDING;
        if (rotatedRectOverlapsAABB(colliderCX, colliderCY, halfW, halfH, angle, zb)) {
            // Dash-strike: active during thrust or post-dash slowdown window
            const isDashStrike = player.dashSlowActive;
            const dmgMult = isDashStrike ? DASH_STRIKE_DAMAGE_MULT : 1;
            const kbMult = isDashStrike ? DASH_STRIKE_KNOCKBACK_MULT : 1;

            z.hp -= weapon.damage * dmgMult;
            // Knockback scaled by instantaneous angular velocity from easing curve
            // Peak velocity is past midpoint; normalize so peak = 1
            const peakVel = swingEaseVel(0.5); // approximate peak (slightly off due to asymmetry)
            const angVelScale = Math.min(1, swingEaseVel(progress) / peakVel);
            // Direction: 45° between swing tangent and radial (outward from pivot)
            const swingSign = meleeSwingCW ? 1 : -1;
            const kx = swingSign * -Math.cos(angle) + -Math.sin(angle);
            const ky = swingSign * -Math.sin(angle) + Math.cos(angle);
            const kLen = Math.sqrt(kx * kx + ky * ky) || 1;
            z.knockVx += (kx / kLen) * weapon.knockback * angVelScale * gripScale * kbMult;
            z.knockVy += (ky / kLen) * weapon.knockback * angVelScale * gripScale * kbMult;
            // Knock absorbing zombies out of absorption
            if (z.state === 'absorbing') {
                z.state = z.type === 'flyer' ? 'flying' : 'walking';
                z.absorbTimer = 0;
                z.absorbImmunity = 0.3; // brief immunity so knockback can move them away
            }
            meleeHitSet.add(z);

            if (isDashStrike) {
                player.invulnTimer = Math.max(player.invulnTimer, DASH_STRIKE_INVULN);
                // dashStrikeHit stub — falls back to meleeHit until .wav is added
                if (soundElements['dashStrikeHit']) playSound('dashStrikeHit');
                else playSound('meleeHit');
            } else {
                playSound('meleeHit');
            }
            triggerScreenShake(SCREEN_SHAKE_INTENSITY, SCREEN_SHAKE_DURATION);
        }
    }
}

// Draw swing trail — called by renderer after weapon, before lighting
// Draws a single tapered filled shape that fades out with age
function drawSwingTrail(ctx, camX, camY, effectiveZoom) {
    if (swingTrail.length < 2) return;
    ctx.save();

    // Build two edge paths: offset perpendicular to trail direction on each side
    // Width tapers from thick (newest) to zero (oldest)
    const maxW = 4 * effectiveZoom;
    const points = [];
    for (let i = 0; i < swingTrail.length; i++) {
        const p = swingTrail[i];
        points.push({
            sx: (p.x - camX) * effectiveZoom,
            sy: (p.y - camY) * effectiveZoom,
            t: 1 - p.age / SWING_TRAIL_FADE, // 1 = newest, 0 = fully faded
        });
    }

    // Compute perpendicular normals at each point
    const leftEdge = [];
    const rightEdge = [];
    for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const dx = next.sx - prev.sx;
        const dy = next.sy - prev.sy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const w = maxW * points[i].t * 0.5;
        leftEdge.push({ x: points[i].sx + nx * w, y: points[i].sy + ny * w });
        rightEdge.push({ x: points[i].sx - nx * w, y: points[i].sy - ny * w });
    }

    // Draw filled shape: left edge forward, right edge backward
    ctx.beginPath();
    ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
    for (let i = 1; i < leftEdge.length; i++) {
        ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
    }
    for (let i = rightEdge.length - 1; i >= 0; i--) {
        ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
    }
    ctx.closePath();

    // Overall alpha based on newest point (trail fades as all points age out)
    const peakAlpha = points[points.length - 1].t * 0.35;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, peakAlpha)})`;
    ctx.fill();

    ctx.restore();
}

function updateBullets(dt) {
    // Update shovel target block preview (shovel only)
    if (gameState.gameMode === 'player' && !player.dead && !isInterfaceOpen() && !getActiveWeapon().sprite) {
        shovelTargetBlock = getShovelTargetBlock();
    } else {
        shovelTargetBlock = null;
    }

    // Age and cull swing trail
    for (let i = swingTrail.length - 1; i >= 0; i--) {
        swingTrail[i].age += dt;
        if (swingTrail[i].age >= SWING_TRAIL_FADE) swingTrail.splice(i, 1);
    }

    // Cooldowns and screen shake
    updateScreenShake(dt);
    if (shootCooldown > 0) shootCooldown -= dt;
    if (shovelCooldown > 0) shovelCooldown -= dt;

    // Per-frame melee collider check BEFORE timer decrement (so final frame isn't skipped)
    updateMeleeCollider();

    if (shovelSwingTimer > 0) {
        shovelSwingTimer -= dt;
        if (shovelSwingTimer <= 0) {
            // Swing just finished — start same-direction cooldown
            meleeLastSwingCW = meleeSwingCW;
            shovelCooldown = meleeSwingDuration * MELEE_SAME_DIR_COOLDOWN;
        }
    }

    // Melee: left click = counter-clockwise, right click = clockwise
    if (gameState.gameMode === 'player' && !player.dead && !isInterfaceOpen()) {
        if (mouse.leftDown) shovelSwing(false);
        else if (mouse.rightDown) shovelSwing(true);
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
                        z.knockVx += (b.vx / bLen) * ZOMBIE_KNOCKBACK;
                        z.knockVy += (b.vy / bLen) * ZOMBIE_KNOCKBACK * 0.3;
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

