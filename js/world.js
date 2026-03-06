// ============================================================
// ZOMBIE DEFENSE - World (Tiles, Terrain, Chunks)
// ============================================================

// Pre-render textured earth tiles (multiple variants to avoid repetition)
const EARTH_TILE_VARIANTS = 16;
const earthTiles = [];
for (let v = 0; v < EARTH_TILE_VARIANTS; v++) {
    const off = document.createElement('canvas');
    off.width = TILE_SIZE;
    off.height = TILE_SIZE;
    const oc = off.getContext('2d');
    const imgData = oc.createImageData(TILE_SIZE, TILE_SIZE);
    const d = imgData.data;
    for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
            const idx = (py * TILE_SIZE + px) * 4;
            const gray = 110 + Math.floor(Math.random() * 40); // 110-149
            d[idx] = gray;
            d[idx + 1] = gray;
            d[idx + 2] = gray;
            d[idx + 3] = 255;
        }
    }
    oc.putImageData(imgData, 0, 0);
    earthTiles.push(off);
}

// Pre-render textured brick tiles
const BRICK_TILE_VARIANTS = 16;
const brickTiles = [];
for (let v = 0; v < BRICK_TILE_VARIANTS; v++) {
    const off = document.createElement('canvas');
    off.width = TILE_SIZE;
    off.height = TILE_SIZE;
    const oc = off.getContext('2d');
    const imgData = oc.createImageData(TILE_SIZE, TILE_SIZE);
    const d = imgData.data;
    for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
            const idx = (py * TILE_SIZE + px) * 4;
            const r = 140 + Math.floor(Math.random() * 30); // 140-169
            const g = 70 + Math.floor(Math.random() * 20);  // 70-89
            const b = 50 + Math.floor(Math.random() * 20);  // 50-69
            d[idx] = r;
            d[idx + 1] = g;
            d[idx + 2] = b;
            d[idx + 3] = 255;
        }
    }
    oc.putImageData(imgData, 0, 0);
    brickTiles.push(off);
}

// Pre-render artifact base tiles (dark azure with noise)
const ARTIFACT_TILE_VARIANTS = 16;
const artifactBaseTiles = [];
for (let v = 0; v < ARTIFACT_TILE_VARIANTS; v++) {
    const off = document.createElement('canvas');
    off.width = TILE_SIZE;
    off.height = TILE_SIZE;
    const oc = off.getContext('2d');
    const imgData = oc.createImageData(TILE_SIZE, TILE_SIZE);
    const d = imgData.data;
    for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
            const idx = (py * TILE_SIZE + px) * 4;
            d[idx] = 10 + Math.floor(Math.random() * 20);     // R: 10-29
            d[idx + 1] = 25 + Math.floor(Math.random() * 25); // G: 25-49
            d[idx + 2] = 55 + Math.floor(Math.random() * 35); // B: 55-89
            d[idx + 3] = 255;
        }
    }
    oc.putImageData(imgData, 0, 0);
    artifactBaseTiles.push(off);
}

// Pre-render pedestal tiles (black with subtle noise)
const PEDESTAL_TILE_VARIANTS = 16;
const pedestalTiles = [];
for (let v = 0; v < PEDESTAL_TILE_VARIANTS; v++) {
    const off = document.createElement('canvas');
    off.width = TILE_SIZE;
    off.height = TILE_SIZE;
    const oc = off.getContext('2d');
    const imgData = oc.createImageData(TILE_SIZE, TILE_SIZE);
    const d = imgData.data;
    for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
            const idx = (py * TILE_SIZE + px) * 4;
            const v2 = 12 + Math.floor(Math.random() * 18); // 12-29, very dark
            d[idx] = v2;
            d[idx + 1] = v2;
            d[idx + 2] = v2 + Math.floor(Math.random() * 5); // slight blue tint
            d[idx + 3] = 255;
        }
    }
    oc.putImageData(imgData, 0, 0);
    pedestalTiles.push(off);
}

// Generate fractal vein pattern for artifact (white on transparent — tinted at draw time)
const artifactVeinCanvas = document.createElement('canvas');
artifactVeinCanvas.width = ARTIFACT_PX;
artifactVeinCanvas.height = ARTIFACT_PX;
(function generateVeins() {
    const vc = artifactVeinCanvas.getContext('2d');
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
})();

// Generate channel vein pattern (white on transparent — tinted at draw time)
const CHANNEL_VEIN_START_Y = ARTIFACT_TY + Math.floor(ARTIFACT_SIZE / 2);
const CHANNEL_VEIN_ROWS = WORLD_H - CHANNEL_VEIN_START_Y;
const channelVeinCanvas = document.createElement('canvas');
channelVeinCanvas.width = TILE_SIZE;
channelVeinCanvas.height = CHANNEL_VEIN_ROWS * TILE_SIZE;
(function generateChannelVein() {
    const vc = channelVeinCanvas.getContext('2d');
    const centerX = TILE_SIZE / 2;
    let x = centerX, y = 0;
    const totalH = CHANNEL_VEIN_ROWS * TILE_SIZE;
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
})();

// Offscreen canvas for tinting veins (reused each frame)
const veinTintCanvas = document.createElement('canvas');
const veinTintCtx = veinTintCanvas.getContext('2d');

// Lighting overlay canvas (reused each frame)
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

// --- World Array ---
const world = new Uint8Array(WORLD_W * WORLD_H);

function tileAt(x, y) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return TILE.EARTH;
    return world[y * WORLD_W + x];
}

function setTile(x, y, type) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
    const prev = world[y * WORLD_W + x];
    world[y * WORLD_W + x] = type;
    // Recompute flow field if solidity changed and flow field is active
    if (flowField && prev !== type) {
        const wasSolid = (prev === TILE.EARTH || prev === TILE.BRICK || prev === TILE.ARTIFACT || prev === TILE.PEDESTAL);
        const nowSolid = (type === TILE.EARTH || type === TILE.BRICK || type === TILE.ARTIFACT || type === TILE.PEDESTAL);
        if (wasSolid !== nowSolid) computeFlowField();
    }
}

// 1D Perlin noise for terrain generation
const _perlinGrad = [];
const _perlinSize = 256;
(function initPerlin() {
    for (let i = 0; i < _perlinSize; i++) _perlinGrad[i] = Math.random() * 2 - 1;
})();
function perlin1D(x) {
    const xi = Math.floor(x) & (_perlinSize - 1);
    const xf = x - Math.floor(x);
    const u = xf * xf * (3 - 2 * xf); // smoothstep
    const a = _perlinGrad[xi] * xf;
    const b = _perlinGrad[(xi + 1) & (_perlinSize - 1)] * (xf - 1);
    return a + u * (b - a);
}
function terrainNoise(x) {
    // 4 octaves of Perlin noise
    return perlin1D(x * 0.01) * 16
         + perlin1D(x * 0.025) * 8
         + perlin1D(x * 0.06) * 6
         + perlin1D(x * 0.12) * 1;
}

function getGroundHeight(x) {
    const center = PEDESTAL_CENTER_X;
    const flatHalf = 6; // 12 tiles flat (6 each side)
    const blendZone = 10; // smooth transition over 10 tiles
    const distFromCenter = Math.abs(x - center);

    if (distFromCenter <= flatHalf) return GROUND_LEVEL; // flat zone

    // Blend factor: 0 at flat edge, 1 when fully outside blend zone
    const blend = Math.min(1, (distFromCenter - flatHalf) / blendZone);
    const smoothBlend = blend * blend * (3 - 2 * blend); // smoothstep

    const noise = terrainNoise(x);
    return Math.round(GROUND_LEVEL + noise * smoothBlend);
}

function generateWorld() {
    for (let x = 0; x < WORLD_W; x++) {
        const groundH = getGroundHeight(x);
        for (let y = 0; y < WORLD_H; y++) {
            if (y < groundH) {
                setTile(x, y, TILE.AIR);
            } else {
                setTile(x, y, TILE.EARTH);
            }
        }
    }
    // Place artifact at world center, sitting on ground
    for (let dy = 0; dy < ARTIFACT_SIZE; dy++) {
        for (let dx = 0; dx < ARTIFACT_SIZE; dx++) {
            setTile(ARTIFACT_TX + dx, ARTIFACT_TY + dy, TILE.ARTIFACT);
        }
    }
    // Place pedestal: cone section (widens from 5 to 20 over 15 rows)
    for (let dy = 0; dy < PEDESTAL_CONE_DEPTH; dy++) {
        const t = dy / (PEDESTAL_CONE_DEPTH - 1); // 0 at top, 1 at bottom
        const width = Math.round(PEDESTAL_TOP_W + (PEDESTAL_BOT_W - PEDESTAL_TOP_W) * t);
        const halfLeft = Math.floor(width / 2);
        const startX = PEDESTAL_CENTER_X - halfLeft;
        for (let dx = 0; dx < width; dx++) {
            setTile(startX + dx, PEDESTAL_CONE_TOP_Y + dy, TILE.PEDESTAL);
        }
    }
    // Place pedestal: column section (20 wide, from bottom of cone to world bottom)
    const columnStartY = PEDESTAL_CONE_TOP_Y + PEDESTAL_CONE_DEPTH;
    const columnHalfLeft = Math.floor(PEDESTAL_BOT_W / 2);
    const columnStartX = PEDESTAL_CENTER_X - columnHalfLeft;
    for (let y = columnStartY; y < WORLD_H; y++) {
        for (let dx = 0; dx < PEDESTAL_BOT_W; dx++) {
            setTile(columnStartX + dx, y, TILE.PEDESTAL);
        }
    }
    // Place 1-wide artifact column from bottom of artifact through pedestal to world bottom
    for (let y = GROUND_LEVEL; y < WORLD_H; y++) {
        setTile(PEDESTAL_CENTER_X, y, TILE.ARTIFACT);
    }
}

// --- Chunk system for fast rendering ---
const CHUNK_SIZE = 32; // tiles per chunk
const CHUNK_PX = CHUNK_SIZE * TILE_SIZE; // pixels per chunk
const CHUNKS_X = Math.ceil(WORLD_W / CHUNK_SIZE);
const CHUNKS_Y = Math.ceil(WORLD_H / CHUNK_SIZE);
const chunks = new Array(CHUNKS_X * CHUNKS_Y).fill(null);

function getChunkIndex(cx, cy) { return cy * CHUNKS_X + cx; }

function buildChunk(cx, cy) {
    const off = document.createElement('canvas');
    off.width = CHUNK_PX;
    off.height = CHUNK_PX;
    const oc = off.getContext('2d');

    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const wx = startX + x;
            const wy = startY + y;
            if (wx >= WORLD_W || wy >= WORLD_H) continue;
            const tile = tileAt(wx, wy);
            if (tile === TILE.AIR) continue;

            const variant = ((wx * 374761 + wy * 668265) & 0x7FFFFFFF) % EARTH_TILE_VARIANTS;
            if (tile === TILE.EARTH) {
                oc.drawImage(earthTiles[variant], x * TILE_SIZE, y * TILE_SIZE);
            } else if (tile === TILE.BRICK) {
                oc.drawImage(brickTiles[variant % BRICK_TILE_VARIANTS], x * TILE_SIZE, y * TILE_SIZE);
            } else if (tile === TILE.ARTIFACT) {
                oc.drawImage(artifactBaseTiles[variant % ARTIFACT_TILE_VARIANTS], x * TILE_SIZE, y * TILE_SIZE);
            } else if (tile === TILE.PEDESTAL) {
                oc.drawImage(pedestalTiles[variant % PEDESTAL_TILE_VARIANTS], x * TILE_SIZE, y * TILE_SIZE);
            }
        }
    }
    return off;
}

function buildAllChunks() {
    for (let cy = 0; cy < CHUNKS_Y; cy++) {
        for (let cx = 0; cx < CHUNKS_X; cx++) {
            chunks[getChunkIndex(cx, cy)] = buildChunk(cx, cy);
        }
    }
}

// Rebuild a single chunk (call when tiles change)
function rebuildChunk(cx, cy) {
    if (cx < 0 || cx >= CHUNKS_X || cy < 0 || cy >= CHUNKS_Y) return;
    chunks[getChunkIndex(cx, cy)] = buildChunk(cx, cy);
}

// Rebuild the chunk containing a specific tile
function dirtyTile(tx, ty) {
    rebuildChunk(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE));
}

// --- Physics Utilities (shared by player and zombies) ---

function isSolid(tx, ty) {
    const t = tileAt(tx, ty);
    return t === TILE.EARTH || t === TILE.BRICK || t === TILE.ARTIFACT || t === TILE.PEDESTAL;
}

// Step-up: walk up 1-tile ledges without jumping (works for player and zombies)
// Optional dirOverride: pass 1 or -1 to force direction (used when vx has been zeroed by resolveX)
function tryStepUp(e, dirOverride) {
    if (!e.onGround) return;

    const halfW = e.w / 2;
    const feetRow = Math.floor((e.y - 1) / TILE_SIZE);

    // Determine direction: use override if given, otherwise use velocity
    const dir = dirOverride !== undefined ? dirOverride : (e.vx > 0.5 ? 1 : (e.vx < -0.5 ? -1 : 0));
    if (dir === 0) return;

    // Tile column we're stepping into (1px lookahead to detect wall we're flush against)
    let stepCol;
    if (dir > 0) {
        stepCol = Math.floor((e.x + halfW + 1) / TILE_SIZE);
    } else {
        stepCol = Math.floor((e.x - halfW - 1) / TILE_SIZE);
    }

    // Must be blocked at feet level by a 1-high step
    if (!isSolid(stepCol, feetRow)) return;
    if (isSolid(stepCol, feetRow - 1)) return;

    // Verify body fits at the stepped-up position (feet on top of step)
    const newY = feetRow * TILE_SIZE;
    const headRow = Math.floor((newY - e.h) / TILE_SIZE);
    for (let ty = headRow; ty <= feetRow - 1; ty++) {
        if (isSolid(stepCol, ty)) return;
    }

    // Step up
    e.y = newY;
}

// --- World Save/Load ---
function saveWorld() {
    // Convert Uint8Array to base64 string for localStorage
    let binary = '';
    for (let i = 0; i < world.length; i++) binary += String.fromCharCode(world[i]);
    localStorage.setItem('zd_world_save', btoa(binary));
    console.log('World saved!');
}

function loadWorld() {
    const data = localStorage.getItem('zd_world_save');
    if (!data) { console.log('No saved world found'); return false; }
    const binary = atob(data);
    if (binary.length !== world.length) { console.log('Save data size mismatch'); return false; }
    for (let i = 0; i < world.length; i++) world[i] = binary.charCodeAt(i);
    buildAllChunks();
    if (typeof computeFlowField === 'function') computeFlowField();
    console.log('World loaded!');
    return true;
}
