// ============================================================
// ZOMBIE DEFENSE - Assets (Centralized sprites and visual data)
// ============================================================

const assets = {};

// --- Tile Variant Generator ---
function generateTileVariants(count, rBase, rRange, gBase, gRange, bBase, bRange) {
    const tiles = [];
    for (let v = 0; v < count; v++) {
        const off = document.createElement('canvas');
        off.width = TILE_SIZE;
        off.height = TILE_SIZE;
        const oc = off.getContext('2d');
        const imgData = oc.createImageData(TILE_SIZE, TILE_SIZE);
        const d = imgData.data;
        for (let py = 0; py < TILE_SIZE; py++) {
            for (let px = 0; px < TILE_SIZE; px++) {
                const idx = (py * TILE_SIZE + px) * 4;
                d[idx]     = rBase + Math.floor(Math.random() * rRange);
                d[idx + 1] = gBase + Math.floor(Math.random() * gRange);
                d[idx + 2] = bBase + Math.floor(Math.random() * bRange);
                d[idx + 3] = 255;
            }
        }
        oc.putImageData(imgData, 0, 0);
        tiles.push(off);
    }
    return tiles;
}

// --- Noise Texture Generator ---
function generateNoiseTexture(size) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = Math.floor(Math.random() * 20);
        d[i]     = Math.floor(v * 0.3);
        d[i + 1] = Math.floor(v * 0.5);
        d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
}

// --- Fractal Vein Pattern ---
function generateArtifactVeins() {
    const c = document.createElement('canvas');
    c.width = ARTIFACT_PX;
    c.height = ARTIFACT_PX;
    const vc = c.getContext('2d');
    function drawBranch(x, y, angle, length, width, depth) {
        if (depth <= 0 || length < 2) return;
        const steps = Math.ceil(length / 2);
        let cx = x, cy = y;
        for (let i = 0; i < steps; i++) {
            const nx = cx + Math.cos(angle) * 2;
            const ny = cy + Math.sin(angle) * 2;
            vc.strokeStyle = `rgba(255, 255, 255, ${0.15 + depth * 0.09})`;
            vc.lineWidth = width;
            vc.lineCap = 'round';
            vc.beginPath();
            vc.moveTo(cx, cy);
            vc.lineTo(nx, ny);
            vc.stroke();
            cx = nx; cy = ny;
            angle += (Math.random() - 0.5) * 0.4;
        }
        drawBranch(cx, cy, angle + (Math.random() - 0.5) * 0.3, length * 0.7, width * 0.8, depth - 1);
        if (Math.random() < 0.5) {
            const fork = angle + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8);
            drawBranch(cx, cy, fork, length * 0.5, width * 0.6, depth - 1);
        }
    }
    const cx = ARTIFACT_PX / 2, cy = ARTIFACT_PX / 2;
    for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i + (Math.random() - 0.5) * 0.3;
        drawBranch(cx, cy, a, 20 + Math.random() * 15, 2.5, 7);
    }
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 15;
        drawBranch(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, a, 10 + Math.random() * 10, 1.5, 5);
    }
    return c;
}

// --- Channel Vein Pattern ---
function generateChannelVeins() {
    const startY = ARTIFACT_TY + Math.floor(ARTIFACT_SIZE / 2);
    const rows = WORLD_H - startY;
    const c = document.createElement('canvas');
    c.width = TILE_SIZE;
    c.height = rows * TILE_SIZE;
    const vc = c.getContext('2d');
    const centerX = TILE_SIZE / 2;
    let x = centerX, y = 0;
    const totalH = rows * TILE_SIZE;
    while (y < totalH) {
        const nx = x + (Math.random() - 0.5) * 3;
        const ny = y + 2;
        const clampedX = Math.max(3, Math.min(TILE_SIZE - 3, nx));
        vc.strokeStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.4})`;
        vc.lineWidth = 2.5 + Math.random() * 1.5;
        vc.lineCap = 'round';
        vc.beginPath();
        vc.moveTo(x, y);
        vc.lineTo(clampedX, ny);
        vc.stroke();
        x = clampedX;
        y = ny;
    }
    return c;
}

// --- Initialize All Assets ---
// Earth: procedurally generated rock textures at TILE_TEXELS resolution
assets.earth = generateRockTiles(32);
// Brick: R 140-169, G 70-89, B 50-69
assets.brick = generateTileVariants(16, 140, 30, 70, 20, 50, 20);
// Artifact base: R 10-29, G 25-49, B 55-89
assets.artifactBase = generateTileVariants(16, 10, 20, 25, 25, 55, 35);
// Pedestal: very dark 12-29 with slight blue tint
assets.pedestal = generateTileVariants(16, 12, 18, 12, 18, 12, 23);
// Fractal vein pattern (128x128, white on transparent)
assets.artifactVeins = generateArtifactVeins();
// Channel vein pattern (20px wide, extends down from artifact)
assets.channelVeins = generateChannelVeins();
// Noise texture (256x256, blue-tinted — shared by renderer and crafting)
assets.noise = generateNoiseTexture(256);
