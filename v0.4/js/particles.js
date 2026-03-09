// ============================================================
// ZOMBIE DEFENSE - Particles (Shared particle system)
// ============================================================

const particles = [];

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
