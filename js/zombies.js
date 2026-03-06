// ============================================================
// ZOMBIE DEFENSE - Zombies & Wave System
// ============================================================

// --- Zombie State ---
const zombies = [];
let zombiesAbsorbed = 0;
let artifactHP = ARTIFACT_MAX_HP;
let artifactCorrupted = false;       // true while artifact is disabled
let artifactCorruptTimer = 0;        // counts down from 60s (no regen phase)
const ARTIFACT_CORRUPT_NO_REGEN = 60; // 1 minute of no regen
let artifactPulse = 0;              // radial pulse intensity (1→0)
let artifactPulseColor = [255, 40, 40]; // red or blue
let debugSpawnDisabled = false;
let debugNoTargetPlayer = false;

// --- Flow Field ---
// Per-tile resolution, simple solid check
// flowField[ty * WORLD_W + tx] = { dx, dy } or null
let flowField = null;
let debugShowFlowField = false;

function isFlowBlocked(tx, ty) {
    if (tx < 0 || tx >= WORLD_W || ty < 0 || ty >= WORLD_H) return true;
    return isSolid(tx, ty);
}

// Body-height-aware BFS expansion check.
// The zombie body is ~2 tiles tall, so horizontal/diagonal moves must verify
// that both columns have 2 tiles of vertical clearance at the transition height.
// Coordinates use game convention: +x = right, +y = down.
// (User notation uses +y = up, so the checks are flipped vertically in code.)
function canExpandTo(cx, cy, ddx, ddy) {
    const nx = cx + ddx;
    const ny = cy + ddy;
    // Basic check: destination must be navigable
    if (isFlowBlocked(nx, ny)) return false;

    // Vertical moves (no column transition): no extra check needed
    if (ddx === 0) return true;

    // Horizontal moves: either the row above or row below must be clear
    // in BOTH source and destination columns (2-tile body passage)
    if (ddy === 0) {
        // Check above pair (game -y = user +y)
        const aboveClear = !isFlowBlocked(cx, cy - 1) && !isFlowBlocked(nx, ny - 1);
        // Check below pair (game +y = user -y)
        const belowClear = !isFlowBlocked(cx, cy + 1) && !isFlowBlocked(nx, ny + 1);
        return aboveClear || belowClear;
    }

    // Diagonal moves: both cardinal neighbors between S and D must be clear
    // (prevents corner-cutting through solid diagonals)
    if (isFlowBlocked(cx + ddx, cy)) return false;
    if (isFlowBlocked(cx, cy + ddy)) return false;
    // Body-height: tile on opposite vertical side of S from expansion direction
    // (moving down-diag checks above S, moving up-diag checks below S)
    if (isFlowBlocked(cx, cy - ddy)) return false;
    return true;
}

function computeFlowField() {
    flowField = new Array(WORLD_W * WORLD_H).fill(null);
    const visited = new Uint8Array(WORLD_W * WORLD_H);
    const queue = [];

    // Seed BFS from all artifact tiles
    for (let dy = 0; dy < ARTIFACT_SIZE; dy++) {
        for (let dx = 0; dx < ARTIFACT_SIZE; dx++) {
            const tx = ARTIFACT_TX + dx;
            const ty = ARTIFACT_TY + dy;
            const idx = ty * WORLD_W + tx;
            visited[idx] = 1;
            flowField[idx] = { dx: 0, dy: 0, reach: true };
            queue.push(tx, ty);
        }
    }

    // 8-directional BFS
    const dirs = [
        [1,0], [-1,0], [0,1], [0,-1],
        [1,1], [1,-1], [-1,1], [-1,-1]
    ];

    // Pass 1: BFS through navigable tiles (reachable from artifact)
    // Uses body-height-aware expansion to prevent routing through gaps
    // too narrow for the zombie body (~2 tiles tall)
    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];
        for (const [ddx, ddy] of dirs) {
            const nx = cx + ddx;
            const ny = cy + ddy;
            if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
            const nIdx = ny * WORLD_W + nx;
            if (visited[nIdx]) continue;
            if (!canExpandTo(cx, cy, ddx, ddy)) continue;
            visited[nIdx] = 1;
            flowField[nIdx] = { dx: -ddx, dy: -ddy, reach: true };
            queue.push(nx, ny);
        }
    }

    // Pass 2: Enclosure breach points (iterative — handles nested enclosures)
    // Merge visited into a single "reached" array that accumulates across iterations
    const reached = new Uint8Array(WORLD_W * WORLD_H);
    for (let i = 0; i < reached.length; i++) reached[i] = visited[i];

    for (let iteration = 0; iteration < 20; iteration++) { // safety cap
        // Step A: Find enclosure perimeter — blocked tiles with both reached and unreached air neighbors
        const enclosure = [];
        for (let ty = 0; ty < WORLD_H; ty++) {
            for (let tx = 0; tx < WORLD_W; tx++) {
                if (!isFlowBlocked(tx, ty)) continue;
                let hasReached = false;
                let hasUnreached = false;
                for (const [ddx, ddy] of dirs) {
                    const nx = tx + ddx;
                    const ny = ty + ddy;
                    if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
                    if (isFlowBlocked(nx, ny)) continue;
                    if (reached[ny * WORLD_W + nx]) hasReached = true;
                    else hasUnreached = true;
                    if (hasReached && hasUnreached) break;
                }
                if (hasReached && hasUnreached) {
                    enclosure.push(tx, ty);
                }
            }
        }

        if (enclosure.length === 0) break; // no more enclosures

        // Step B: Breach points — unreached air tiles adjacent to enclosure
        const queue2 = [];
        for (let i = 0; i < enclosure.length; i += 2) {
            const sx = enclosure[i];
            const sy = enclosure[i + 1];
            for (const [ddx, ddy] of dirs) {
                const nx = sx + ddx;
                const ny = sy + ddy;
                if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
                const nIdx = ny * WORLD_W + nx;
                if (isFlowBlocked(nx, ny)) continue;
                if (reached[nIdx]) continue;
                reached[nIdx] = 1;
                flowField[nIdx] = { dx: -ddx, dy: -ddy, reach: false, breach: true };
                queue2.push(nx, ny);
            }
        }

        // Step C: BFS from breach points into remaining unreached air tiles
        let head2 = 0;
        while (head2 < queue2.length) {
            const cx = queue2[head2++];
            const cy = queue2[head2++];
            for (const [ddx, ddy] of dirs) {
                const nx = cx + ddx;
                const ny = cy + ddy;
                if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
                const nIdx = ny * WORLD_W + nx;
                if (reached[nIdx]) continue;
                if (!canExpandTo(cx, cy, ddx, ddy)) continue;
                reached[nIdx] = 1;
                flowField[nIdx] = { dx: -ddx, dy: -ddy, reach: false };
                queue2.push(nx, ny);
            }
        }
    }
}

// --- Wave System State ---
const wave = {
    number: 0,                // current wave (0 = hasn't started yet)
    state: 'idle',            // 'idle' | 'active' | 'complete'
    zombiesSpawned: 0,        // how many spawned this wave
    zombiesTotal: 0,          // total for this wave
    flyersTotal: 0,           // how many flyers this wave
    flyersSpawned: 0,         // flyers spawned so far
    spawnTimer: 0,            // timer for next spawn
    spawnInterval: 0,         // this wave's spawn interval
    completeTimer: 0,         // "WAVE COMPLETE" banner duration
    completeDuration: 3.0,    // seconds the banner shows
    // Cached per-wave stats per type (set in startWave)
    walker: { hp: ZOMBIE_BASE_HP, minSpeed: 25, maxSpeed: 65, contactDmg: ZOMBIE_CONTACT_DAMAGE, breakDPS: ZOMBIE_BREAK_DPS },
    flyer:  { hp: ZOMBIE_BASE_HP, minSpeed: 25, maxSpeed: 65, contactDmg: ZOMBIE_CONTACT_DAMAGE, breakDPS: ZOMBIE_BREAK_DPS },
};

function startWave() {
    wave.number++;
    wave.state = 'active';
    wave.zombiesSpawned = 0;
    wave.zombiesTotal = waveZombieCount(wave.number);
    wave.flyersTotal = Math.round(wave.zombiesTotal * WAVE_CONFIG.flyerRatio);
    wave.flyersSpawned = 0;
    wave.spawnTimer = 0; // spawn first zombie immediately
    wave.spawnInterval = waveSpawnInterval(wave.number);

    // Cache walker stats
    wave.walker.hp = Math.round(waveScaleStat(WAVE_CONFIG.walker.hp, wave.number));
    const wSpd = waveSpeedRange(wave.number, WAVE_CONFIG.walker.speed);
    wave.walker.minSpeed = wSpd.min;
    wave.walker.maxSpeed = wSpd.max;
    wave.walker.contactDmg = Math.round(waveScaleStat(WAVE_CONFIG.walker.contactDamage, wave.number));
    wave.walker.breakDPS = waveScaleStat(WAVE_CONFIG.walker.breakDPS, wave.number);

    // Cache flyer stats
    wave.flyer.hp = Math.round(waveScaleStat(WAVE_CONFIG.flyer.hp, wave.number));
    const fSpd = waveSpeedRange(wave.number, WAVE_CONFIG.flyer.speed);
    wave.flyer.minSpeed = fSpd.min;
    wave.flyer.maxSpeed = fSpd.max;
    wave.flyer.contactDmg = Math.round(waveScaleStat(WAVE_CONFIG.flyer.contactDamage, wave.number));
    wave.flyer.breakDPS = waveScaleStat(WAVE_CONFIG.flyer.breakDPS, wave.number);
}

function completeWave() {
    wave.state = 'idle'; // immediately ready for next wave
}

function updateWaveSystem(dt) {
    if (gameOver) return;

    if (wave.state === 'active') {
        // Check if wave is complete: all spawned AND all dead/absorbed
        if (wave.zombiesSpawned >= wave.zombiesTotal && zombies.length === 0) {
            completeWave();
        }
    }
    // 'idle' state: waiting for player to start next wave
}

// Block HP tracking (only stores damaged blocks; undamaged blocks use BLOCK_BASE_HP)
const blockHP = new Map();
function blockKey(tx, ty) { return ty * WORLD_W + tx; }
function getBlockHP(tx, ty) {
    const key = blockKey(tx, ty);
    if (blockHP.has(key)) return blockHP.get(key);
    const tile = tileAt(tx, ty);
    return BLOCK_BASE_HP[tile] || 0;
}
function damageBlock(tx, ty, dmg) {
    const key = blockKey(tx, ty);
    let hp = getBlockHP(tx, ty);
    hp -= dmg;
    if (hp <= 0) {
        blockHP.delete(key);
        setTile(tx, ty, TILE.AIR);
        dirtyTile(tx, ty);
        return true; // block destroyed
    }
    blockHP.set(key, hp);
    return false;
}

function spawnWalker() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const spawnTX = PEDESTAL_CENTER_X + side * ZOMBIE_SPAWN_DIST;
    if (spawnTX < 1 || spawnTX >= WORLD_W - 1) return;

    // Find ground at spawn column
    let groundY = GROUND_LEVEL;
    for (let y = 0; y < WORLD_H; y++) {
        if (isSolid(spawnTX, y)) { groundY = y; break; }
    }

    const stats = wave.walker;
    const speed = Math.min(
        WAVE_CONFIG.walker.speed.absoluteMax,
        stats.minSpeed + Math.random() * (stats.maxSpeed - stats.minSpeed)
    );
    const hp = stats.hp;

    zombies.push({
        type: 'walker',
        x: (spawnTX + 0.5) * TILE_SIZE,
        y: groundY * TILE_SIZE,
        w: TILE_SIZE * 0.8,
        h: TILE_SIZE * 1.8,
        vx: 0,
        vy: 0,
        speed: speed,
        hp: hp,
        maxHp: hp,
        contactDmg: stats.contactDmg,
        breakDPS: stats.breakDPS,
        facingRight: side < 0,
        onGround: false,
        state: 'walking',
        absorbTimer: 0,
        absorbImmunity: 0,
        breakTarget: null,
        failedJumps: 0,
        preJumpX: null,
        stuckTimer: 0,
        lastProgressX: (spawnTX + 0.5) * TILE_SIZE,
    });
}

function spawnFlyer() {
    // Spawn in a semicircle shell around artifact, 40 blocks radius, 0°-180°
    const radius = 40 * TILE_SIZE;
    const artifactCY = (GROUND_LEVEL - ARTIFACT_SIZE) * TILE_SIZE;
    const centerX = (PEDESTAL_CENTER_X + 0.5) * TILE_SIZE;
    // Bias spawn angle toward sides (0=right, PI=left) rather than overhead
    // Map uniform random to a distribution weighted toward 0 and PI
    const t = Math.random();
    const angle = t < 0.5
        ? Math.pow(t * 2, 2.0) * Math.PI / 2           // right side bias
        : Math.PI - Math.pow((1 - t) * 2, 2.0) * Math.PI / 2; // left side bias
    let spawnX = centerX + Math.cos(angle) * radius;
    let spawnY = artifactCY - Math.sin(angle) * radius;

    // Clamp to world bounds
    spawnX = Math.max(TILE_SIZE, Math.min((WORLD_W - 1) * TILE_SIZE, spawnX));
    spawnY = Math.max(TILE_SIZE * 2, spawnY); // keep body in bounds

    const stats = wave.flyer;
    const speed = Math.min(
        WAVE_CONFIG.flyer.speed.absoluteMax,
        stats.minSpeed + Math.random() * (stats.maxSpeed - stats.minSpeed)
    );
    const hp = stats.hp;

    zombies.push({
        type: 'flyer',
        x: spawnX,
        y: spawnY,
        w: TILE_SIZE * 0.8,
        h: TILE_SIZE * 1.8,
        vx: 0,
        vy: 0,
        speed: speed,
        hp: hp,
        maxHp: hp,
        contactDmg: stats.contactDmg,
        breakDPS: stats.breakDPS,
        facingRight: true,
        onGround: false,
        state: 'flying',
        absorbTimer: 0,
        absorbImmunity: 0,
        breakTarget: null,
    });
}

const ZOMBIE_WALL_SKIN = 4; // px inset on each side for wall collision (helps slide around corners)
function getZombieBounds(z) {
    return {
        left: z.x - z.w / 2 + ZOMBIE_WALL_SKIN,
        right: z.x + z.w / 2 - ZOMBIE_WALL_SKIN,
        top: z.y - z.h + ZOMBIE_WALL_SKIN,
        bottom: z.y
    };
}

function resolveZombieX(z) {
    const b = getZombieBounds(z);
    const tileTop = Math.floor(b.top / TILE_SIZE);
    const tileBot = Math.floor((b.bottom - 1) / TILE_SIZE);

    const tileLeft = Math.floor(b.left / TILE_SIZE);
    for (let ty = tileTop; ty <= tileBot; ty++) {
        if (isSolid(tileLeft, ty)) {
            z.x = (tileLeft + 1) * TILE_SIZE + z.w / 2;
            z.vx = 0;
            break;
        }
    }

    const b2 = getZombieBounds(z);
    const tileRight = Math.floor(b2.right / TILE_SIZE);
    for (let ty = tileTop; ty <= tileBot; ty++) {
        if (isSolid(tileRight, ty) && b2.right > tileRight * TILE_SIZE) {
            z.x = tileRight * TILE_SIZE - z.w / 2;
            z.vx = 0;
            break;
        }
    }
}

function resolveZombieY(z) {
    const b = getZombieBounds(z);
    const tileLeft = Math.floor(b.left / TILE_SIZE);
    const tileRight = Math.floor((b.right - 1) / TILE_SIZE);
    z.onGround = false;

    if (z.vy >= 0) {
        const tileBot = Math.floor(b.bottom / TILE_SIZE);
        for (let tx = tileLeft; tx <= tileRight; tx++) {
            if (isSolid(tx, tileBot)) {
                z.y = tileBot * TILE_SIZE;
                z.vy = 0;
                z.onGround = true;
                break;
            }
        }
    } else {
        const tileTop = Math.floor(b.top / TILE_SIZE);
        for (let tx = tileLeft; tx <= tileRight; tx++) {
            if (isSolid(tx, tileTop)) {
                z.y = (tileTop + 1) * TILE_SIZE + z.h;
                z.vy = 0;
                break;
            }
        }
    }
}

// Soft wall penalty for flyers: detect penetration into solid tiles
// and apply outward acceleration instead of snapping position.
// Returns true if any wall contact was detected.
const FLYER_WALL_MULT = 1.2; // penalty accel = this * zombie's own accel
function applyFlyerWallPenalty(z, dt) {
    const accel = z.speed / 0.15;
    const penaltyAccel = accel * FLYER_WALL_MULT;
    const hw = z.w / 2;
    let hitWall = false;

    // Check all solid tiles the body overlaps with (using actual body, no skin)
    const bodyLeft = z.x - hw;
    const bodyRight = z.x + hw;
    const bodyTop = z.y - z.h;
    const bodyBot = z.y;

    const tMinX = Math.floor(bodyLeft / TILE_SIZE);
    const tMaxX = Math.floor((bodyRight - 1) / TILE_SIZE);
    const tMinY = Math.floor(bodyTop / TILE_SIZE);
    const tMaxY = Math.floor((bodyBot - 1) / TILE_SIZE);

    for (let ty = tMinY; ty <= tMaxY; ty++) {
        for (let tx = tMinX; tx <= tMaxX; tx++) {
            if (!isSolid(tx, ty)) continue;
            if (tileAt(tx, ty) === TILE.ARTIFACT) continue; // let flyers enter artifact
            hitWall = true;

            // Tile bounds
            const tl = tx * TILE_SIZE;
            const tr = (tx + 1) * TILE_SIZE;
            const tt = ty * TILE_SIZE;
            const tb = (ty + 1) * TILE_SIZE;

            // Find smallest penetration axis to determine push direction
            const penL = bodyRight - tl;  // penetration from left side of tile
            const penR = tr - bodyLeft;   // penetration from right side of tile
            const penT = bodyBot - tt;    // penetration from top of tile
            const penB = tb - bodyTop;    // penetration from bottom of tile

            const minPenX = penL < penR ? -1 : 1;  // push left or right
            const minPenXVal = Math.min(penL, penR);
            const minPenY = penT < penB ? -1 : 1;  // push up or down
            const minPenYVal = Math.min(penT, penB);

            // Push along the axis with least penetration
            // Zero velocity on that axis first to prevent trampoline effect
            if (minPenXVal < minPenYVal) {
                z.vx = minPenX * penaltyAccel * dt;
            } else {
                z.vy = minPenY * penaltyAccel * dt;
            }
        }
    }
    return hitWall;
}

// Circle-based zombie-zombie collision: single unified pass
function resolveZombieCollisions() {
    const r = ZOMBIE_COLLISION_R;
    const diam = r * 2;

    for (let i = 0; i < zombies.length; i++) {
        for (let j = i + 1; j < zombies.length; j++) {
            const a = zombies[i], b = zombies[j];

            // Circle centers at body midpoint
            const ax = a.x, ay = a.y - a.h / 2;
            const bx = b.x, by = b.y - b.h / 2;

            const dx = bx - ax;
            const dy = by - ay;
            const distSq = dx * dx + dy * dy;

            // Quick reject: skip if clearly too far
            if (distSq >= diam * diam || distSq < 0.0001) continue;

            const dist = Math.sqrt(distSq);
            const overlap = diam - dist;

            // Contact normal (a -> b) with random perturbation for instability
            const perturbAngle = (Math.random() - 0.5) * 0.3;
            const rawNx = dx / dist;
            const rawNy = dy / dist;
            const cos = Math.cos(perturbAngle), sin = Math.sin(perturbAngle);
            const nx = rawNx * cos - rawNy * sin;
            const ny = rawNx * sin + rawNy * cos;

            // Soft separation: correct only a fraction of overlap per frame
            // so flow field acceleration can overcome it in tight corridors
            const soft = 0.07;
            a.x -= nx * overlap * soft;
            a.y -= ny * overlap * soft;
            b.x += nx * overlap * soft;
            b.y += ny * overlap * soft;

            // Velocity impulse along contact normal
            const relVx = a.vx - b.vx;
            const relVy = a.vy - b.vy;
            const relDotN = relVx * nx + relVy * ny;

            if (relDotN > 0) {
                const impulse = relDotN * (1 + ZOMBIE_BOUNCE) * 0.5;
                a.vx -= impulse * nx;
                a.vy -= impulse * ny;
                b.vx += impulse * nx;
                b.vy += impulse * ny;
            }
        }
    }

    // Player-zombie circle collisions (skip if dead)
    if (!player.dead) {
        const pr = ZOMBIE_COLLISION_R;
        const pcx = player.x, pcy = player.y - player.h / 2;

        for (const z of zombies) {
            if (z.state === 'absorbing') continue;
            const zx = z.x, zy = z.y - z.h / 2;
            const dx = zx - pcx;
            const dy = zy - pcy;
            const distSq = dx * dx + dy * dy;
            const minDist = pr + r;
            if (distSq >= minDist * minDist || distSq < 0.0001) continue;

            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Deal contact damage (if not invulnerable and alive)
            if (player.invulnTimer <= 0 && !player.dead) {
                player.hp -= z.contactDmg;
                player.invulnTimer = PLAYER_INVULN_TIME;
                player.damageFlash = 2.0;
                if (player.hp <= 0) {
                    player.hp = 0;
                    killPlayer();
                }
            }

            // Knockback player along collision normal (away from zombie)
            player.vx -= nx * PLAYER_DAMAGE_KNOCKBACK;
            player.vy -= ny * PLAYER_DAMAGE_KNOCKBACK;

            // Push both apart equally
            z.x += nx * overlap * 0.5;
            z.y += ny * overlap * 0.5;
            player.x -= nx * overlap * 0.5;
            player.y -= ny * overlap * 0.5;

            // Equal and opposite velocity impulse
            const relVx = player.vx - z.vx;
            const relVy = player.vy - z.vy;
            const relDotN = relVx * nx + relVy * ny;
            if (relDotN > 0) {
                const impulse = relDotN * (1 + ZOMBIE_BOUNCE) * 0.5;
                player.vx -= impulse * nx;
                player.vy -= impulse * ny;
                z.vx += impulse * nx;
                z.vy += impulse * ny;
            }
        }
    }

    // Re-resolve tile collisions after circle pushes moved zombies
    // Skip flyers — they already resolved and made deflection decisions
    for (const z of zombies) {
        if (z.type === 'flyer') continue;
        resolveZombieX(z);
        resolveZombieY(z);
    }
}

// Check if another zombie's circle is nearby ahead (jump trigger)
function isBlockedByZombie(z, dir) {
    const cx = z.x;
    const cy = z.y - z.h / 2;
    const artifactCX = (PEDESTAL_CENTER_X + 0.5) * TILE_SIZE;
    const nearCenter = Math.abs(cx - artifactCX) < 10 * TILE_SIZE;
    const scanRange = nearCenter ? 30 : 17;

    for (const other of zombies) {
        if (other === z) continue;
        const ox = other.x;
        const oy = other.y - other.h / 2;

        if (Math.abs(cy - oy) > z.h * 0.7) continue;

        const dx = ox - cx;
        if (dir > 0 && dx > 0 && dx < scanRange) return true;
        if (dir < 0 && dx < 0 && dx > -scanRange) return true;
    }
    return false;
}

// Find the nearest breakable block around a zombie
function findNearbyBreakable(z) {
    const col = Math.floor(z.x / TILE_SIZE);
    const feetRow = Math.floor((z.y - 1) / TILE_SIZE);
    const headRow = Math.floor((z.y - z.h) / TILE_SIZE);
    const dir = z.facingRight ? 1 : -1;

    const candidates = [
        { x: col + dir, y: feetRow },
        { x: col + dir, y: feetRow - 1 },
        { x: col + dir, y: feetRow - 2 },
        { x: col + dir, y: feetRow - 3 },
        { x: col, y: headRow - 1 },
        { x: col, y: feetRow + 1 },
        { x: col - dir, y: feetRow },
        { x: col - dir, y: feetRow - 1 },
    ];

    for (const c of candidates) {
        const tile = tileAt(c.x, c.y);
        if (tile === TILE.EARTH || tile === TILE.BRICK) return c;
    }
    return null;
}

// Check if zombie is adjacent to any artifact tile (within 2px)
function zombieTouchesArtifact(z) {
    const b = getZombieBounds(z);
    const tl = Math.floor((b.left - 2) / TILE_SIZE);
    const tr = Math.floor((b.right + 1) / TILE_SIZE);
    const tt = Math.floor((b.top - 2) / TILE_SIZE);
    const tb = Math.floor((b.bottom + 1) / TILE_SIZE);
    for (let ty = tt; ty <= tb; ty++) {
        for (let tx = tl; tx <= tr; tx++) {
            if (tileAt(tx, ty) === TILE.ARTIFACT) return true;
        }
    }
    return false;
}

function updateZombies(dt) {
    // Wave-gated spawning (only during active wave)
    if (!debugSpawnDisabled && wave.state === 'active' && wave.zombiesSpawned < wave.zombiesTotal) {
        wave.spawnTimer += dt;
        if (wave.spawnTimer >= wave.spawnInterval) {
            wave.spawnTimer -= wave.spawnInterval;
            // All zombies are flyers for now (walkers disabled)
            spawnFlyer();
            wave.flyersSpawned++;
            wave.zombiesSpawned++;
        }
    }

    const artifactCX = (PEDESTAL_CENTER_X + 0.5) * TILE_SIZE;

    for (const z of zombies) {
        // Absorbing zombies: freeze in place, tick timer
        if (z.state === 'absorbing') {
            z.absorbTimer += dt;
            z.vx = 0;
            if (z.type !== 'flyer') {
                z.vy += GRAVITY * dt;
                z.y += z.vy * dt;
                resolveZombieY(z);
            } else {
                z.vy = 0;
            }
            continue;
        }

        // Breaking zombies: stop, attack target block
        if (z.state === 'breaking') {
            const bt = z.breakTarget;
            const tile = tileAt(bt.x, bt.y);
            if (tile !== TILE.EARTH && tile !== TILE.BRICK) {
                z.state = z.type === 'flyer' ? 'flying' : 'walking';
                z.breakTarget = null;
                if (z.type !== 'flyer') {
                    z.failedJumps = 0;
                }
            } else {
                damageBlock(bt.x, bt.y, z.breakDPS * dt);
                z.vx = 0;
                if (z.type !== 'flyer') {
                    z.vy += GRAVITY * dt;
                    z.y += z.vy * dt;
                    resolveZombieY(z);
                } else {
                    z.vy = 0;
                }
                continue;
            }
        }

        // Tick absorb immunity
        if (z.absorbImmunity > 0) z.absorbImmunity -= dt;

        // Early artifact touch check (skip if immune from recent knockback)
        const artifactAccepting = !(artifactCorrupted && artifactCorruptTimer > 0);
        if (artifactAccepting && z.absorbImmunity <= 0 && zombieTouchesArtifact(z)) {
            z.state = 'absorbing';
            z.absorbTimer = 0;
            z.vx = 0;
            z.vy = 0;
            continue;
        }

        // ========== FLYER UPDATE ==========
        if (z.type === 'flyer') {
            const accel = z.speed / 0.15;

            // 4-point body sampling of flow field
            // Sample at center of each side — less likely to cancel than corners
            const samplePoints = [
                [z.x, z.y - z.h],                   // top-center (head)
                [z.x, z.y],                         // bottom-center (feet)
                [z.x - z.w / 2, z.y - z.h / 2],   // left-center
                [z.x + z.w / 2, z.y - z.h / 2],   // right-center
            ];

            let fdx = 0, fdy = 0, samples = 0;
            for (const [px, py] of samplePoints) {
                const stx = Math.floor(px / TILE_SIZE);
                const sty = Math.floor(py / TILE_SIZE);
                if (stx < 0 || stx >= WORLD_W || sty < 0 || sty >= WORLD_H) continue;
                const cell = flowField ? flowField[sty * WORLD_W + stx] : null;
                if (!cell) continue;
                // Normalize each sample so diagonals and cardinals contribute equally
                const clen = Math.sqrt(cell.dx * cell.dx + cell.dy * cell.dy);
                if (clen > 0) {
                    fdx += cell.dx / clen;
                    fdy += cell.dy / clen;
                }
                samples++;
            }

            // Player proximity targeting: within 5 blocks, steer toward player if closer
            const FLYER_AGGRO_RANGE = 5 * TILE_SIZE;
            const pdx = player.x - z.x;
            const pdy = (player.y - player.h / 2) - (z.y - z.h / 2); // center-to-center
            const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);
            let targetPlayer = false;

            if (!player.dead && playerDist < FLYER_AGGRO_RANGE) {
                const artifactCY = (GROUND_LEVEL - ARTIFACT_SIZE) * TILE_SIZE;
                const adx = artifactCX - z.x;
                const ady = artifactCY - (z.y - z.h / 2);
                const artifactDist = Math.sqrt(adx * adx + ady * ady);
                if (playerDist < artifactDist) {
                    targetPlayer = true;
                }
            }

            // Store resultant direction for debug rendering
            z._dbgSteerX = fdx;
            z._dbgSteerY = fdy;

            if (targetPlayer) {
                // Direct steering toward player
                z.vx += (pdx / playerDist) * accel * dt;
                z.vy += (pdy / playerDist) * accel * dt;
            } else if (samples > 0 && (fdx !== 0 || fdy !== 0)) {
                // Steer along averaged flow field direction
                const len = Math.sqrt(fdx * fdx + fdy * fdy);
                z.vx += (fdx / len) * accel * dt;
                z.vy += (fdy / len) * accel * dt;
            } else if (samples === 0) {
                // No flow field data — fallback to direct steering toward artifact
                const artifactCY = (GROUND_LEVEL - ARTIFACT_SIZE) * TILE_SIZE;
                const dx = artifactCX - z.x;
                const dy = artifactCY - z.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                    z.vx += (dx / dist) * accel * dt;
                    z.vy += (dy / dist) * accel * dt;
                }
            } else {
                // At goal — decelerate
                if (Math.abs(z.vx) < accel * dt) z.vx = 0;
                else z.vx -= Math.sign(z.vx) * accel * dt;
                if (Math.abs(z.vy) < accel * dt) z.vy = 0;
                else z.vy -= Math.sign(z.vy) * accel * dt;
            }

            // Clamp speed
            const vel = Math.sqrt(z.vx * z.vx + z.vy * z.vy);
            if (vel > z.speed) {
                z.vx = (z.vx / vel) * z.speed;
                z.vy = (z.vy / vel) * z.speed;
            }
            z.facingRight = z.vx > 0 || (z.vx === 0 && z.facingRight);

            // Move and apply soft wall penalty (no hard position snap)
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            const hitWall = applyFlyerWallPenalty(z, dt);

            // Breach breaking: if flyer is touching a wall while on a breach point,
            // find the nearest breakable block and start attacking it
            if (hitWall) {
                const cTX = Math.floor(z.x / TILE_SIZE);
                const cTY = Math.floor((z.y - z.h / 2) / TILE_SIZE);
                const cell = flowField ? flowField[cTY * WORLD_W + cTX] : null;
                if (cell && cell.breach) {
                    const target = findNearbyBreakable(z);
                    if (target) {
                        z.state = 'breaking';
                        z.breakTarget = target;
                    }
                }
            }

            continue;
        }

        // ========== WALKER UPDATE (existing logic) ==========

        // Pick target: player only when artifact is in no-regen phase, otherwise closest
        let targetX;
        if (debugNoTargetPlayer) {
            targetX = artifactCX;
        } else if (!artifactAccepting) {
            targetX = player.x;
        } else {
            const distToArtifactX = Math.abs(z.x - artifactCX);
            const distToPlayerX = Math.abs(z.x - player.x);
            targetX = distToPlayerX < distToArtifactX ? player.x : artifactCX;
        }

        // Accelerate toward target
        const accel = z.speed / 0.5;
        if (z.x < targetX - 2) {
            z.vx += accel * dt;
            if (z.vx > z.speed) z.vx = z.speed;
            z.facingRight = true;
        } else if (z.x > targetX + 2) {
            z.vx -= accel * dt;
            if (z.vx < -z.speed) z.vx = -z.speed;
            z.facingRight = false;
        } else {
            if (Math.abs(z.vx) < accel * dt) z.vx = 0;
            else z.vx -= Math.sign(z.vx) * accel * dt;
        }

        const intendedDir = z.x < targetX - 2 ? 1 : (z.x > targetX + 2 ? -1 : 0);

        // Gravity
        z.vy += GRAVITY * dt;

        // Move horizontally, resolve against walls
        z.x += z.vx * dt;
        resolveZombieX(z);

        // Obstacle scan
        if (z.onGround && intendedDir !== 0) {
            const dir = intendedDir;
            const frontCol = dir > 0
                ? Math.floor((z.x + z.w / 2 + 10) / TILE_SIZE)
                : Math.floor((z.x - z.w / 2 - 10) / TILE_SIZE);
            const feetRow = Math.floor((z.y - 1) / TILE_SIZE);

            // If artifact is directly ahead, skip scan
            const ft1 = tileAt(frontCol, feetRow);
            const ft2 = tileAt(frontCol, feetRow - 1);
            if (ft1 === TILE.ARTIFACT || ft2 === TILE.ARTIFACT) {
                // Do nothing — let zombie walk into artifact naturally
            } else {

            const p1 = isSolid(frontCol, feetRow);
            const p2 = isSolid(frontCol, feetRow - 1);
            const p3 = isSolid(frontCol, feetRow - 2);
            const p4 = isSolid(frontCol, feetRow - 3);

            let action = 'walk';
            let breakTX = frontCol, breakTY = feetRow;

            if      ( p1 && !p2 && !p3 && !p4) { action = 'step'; }
            else if ( p1 && !p2 && !p3 &&  p4) { action = 'step'; }
            else if (!p1 &&  p2 && !p3 && !p4) { action = 'jump'; }
            else if (!p1 &&  p2 &&  p3 && !p4) { action = 'jump'; }
            else if ( p1 && !p2 &&  p3 && !p4) { action = 'jump'; }
            else if ( p1 &&  p2 && !p3 && !p4) { action = 'jump'; }
            else if ( p1 &&  p2 &&  p3 && !p4) { action = 'jump'; }
            else if (!p1 &&  p2 && !p3 &&  p4) { action = 'break'; breakTY = feetRow - 1; }
            else if (!p1 &&  p2 &&  p3 &&  p4) { action = 'break'; breakTY = feetRow - 1; }
            else if ( p1 && !p2 &&  p3 &&  p4) { action = 'break'; breakTY = feetRow; }
            else if ( p1 &&  p2 && !p3 &&  p4) { action = 'break'; breakTY = feetRow; }
            else if ( p1 &&  p2 &&  p3 &&  p4) { action = 'break'; breakTY = feetRow; }

            if (action === 'walk' && isBlockedByZombie(z, dir)) {
                action = 'jump';
            }

            if (action === 'jump' && z.failedJumps > 0) {
                action = 'break';
                breakTY = p1 ? feetRow : feetRow - 1;
            }

            // Execute
            if (action === 'step') {
                const ownCol = Math.floor(z.x / TILE_SIZE);
                const headRow = Math.floor((z.y - z.h) / TILE_SIZE);
                const aboveTile = tileAt(ownCol, headRow - 1);
                if (aboveTile === TILE.EARTH || aboveTile === TILE.BRICK) {
                    z.state = 'breaking';
                    z.breakTarget = { x: ownCol, y: headRow - 1 };
                } else {
                    const prevY = z.y;
                    tryStepUp(z, intendedDir);
                    if (z.y !== prevY) {
                        z.x += intendedDir * 3;
                    } else {
                        const halfW = z.w / 2;
                        const stepCol = intendedDir > 0
                            ? Math.floor((z.x + halfW + 1) / TILE_SIZE)
                            : Math.floor((z.x - halfW - 1) / TILE_SIZE);
                        const feetRow2 = Math.floor((z.y - 1) / TILE_SIZE);
                        if (isSolid(stepCol, feetRow2)) {
                            const target = findNearbyBreakable(z);
                            if (target) {
                                z.state = 'breaking';
                                z.breakTarget = target;
                            }
                        }
                    }
                }
            } else if (action === 'jump') {
                const frontTile = tileAt(frontCol, feetRow);
                const nearArtifact = frontTile === TILE.ARTIFACT || frontTile === TILE.PEDESTAL
                    || Math.abs(z.x - artifactCX) < ARTIFACT_SIZE * TILE_SIZE;
                z.vy = nearArtifact ? -450 : -350;
                z.onGround = false;
                z.preJumpX = z.x;
            } else if (action === 'break') {
                const target = findNearbyBreakable(z);
                if (target) {
                    z.state = 'breaking';
                    z.breakTarget = target;
                }
            }
            } // end artifact skip else
        }

        // Move vertically then resolve
        z.y += z.vy * dt;
        resolveZombieY(z);

        // Detect landing after a jump
        if (z.onGround && z.preJumpX !== null) {
            const jumpFailed = Math.abs(z.x - z.preJumpX) < 5;
            if (jumpFailed) {
                z.failedJumps++;
                if (z.failedJumps >= 1) {
                    const target = findNearbyBreakable(z);
                    if (target) {
                        z.state = 'breaking';
                        z.breakTarget = target;
                        z.failedJumps = 0;
                    }
                }
            } else {
                z.failedJumps = 0;
            }
            z.preJumpX = null;
        }
    }

    // Post-movement: circle-based zombie-zombie collisions
    resolveZombieCollisions();

    // Remove fully absorbed zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (zombies[i].state === 'absorbing' && zombies[i].absorbTimer >= ABSORB_DURATION) {
            zombiesAbsorbed++;
            if (!artifactCorrupted) {
                artifactHP = Math.max(0, artifactHP - ARTIFACT_ABSORB_DAMAGE);
                if (artifactHP <= 0) {
                    artifactCorrupted = true;
                    artifactCorruptTimer = ARTIFACT_CORRUPT_NO_REGEN;
                    artifactPulse = 1.0;
                    artifactPulseColor = [255, 40, 40];
                    // Force out of build mode
                    if (gameMode === 'build') {
                        gameMode = 'player';
                        if (camera.zoom < MIN_ZOOM_PLAYER) camera.zoom = MIN_ZOOM_PLAYER;
                    }
                    // If player already dead, instant game over
                    if (player.dead) {
                        gameOver = true;
                    }
                }
            }
            zombies.splice(i, 1);
        }
    }
}
