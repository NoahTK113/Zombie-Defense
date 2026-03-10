// ============================================================
// ZOMBIE DEFENSE - World (Tiles, Terrain, Chunks)
// ============================================================


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
        const wasSolid = (prev === TILE.EARTH || prev === TILE.BRICK || prev === TILE.ARTIFACT);
        const nowSolid = (type === TILE.EARTH || type === TILE.BRICK || type === TILE.ARTIFACT);
        if (wasSolid !== nowSolid) {
            computeFlowField();
            invalidatePlayerFlowField();
        }
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
    const center = ARTIFACT_CENTER_X;
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
}

// --- Chunk system for fast rendering ---
const CHUNK_SIZE = 32; // tiles per chunk
const CHUNK_PX = CHUNK_SIZE * TILE_TEXELS; // pixels per chunk (render resolution)
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

            let hash = (wx * 374761) ^ (wy * 668265);
            hash = ((hash >>> 16) ^ hash) * 0x45d9f3b | 0;
            hash = ((hash >>> 16) ^ hash) * 0x45d9f3b | 0;
            hash = ((hash >>> 16) ^ hash) & 0x7FFFFFFF;
            if (tile === TILE.EARTH) {
                const src = assets.earth[hash % assets.earth.length];
                oc.drawImage(src, 0, 0, src.width, src.height, x * TILE_TEXELS, y * TILE_TEXELS, TILE_TEXELS, TILE_TEXELS);
            } else if (tile === TILE.BRICK) {
                const src = assets.brick[hash % assets.brick.length];
                oc.drawImage(src, 0, 0, src.width, src.height, x * TILE_TEXELS, y * TILE_TEXELS, TILE_TEXELS, TILE_TEXELS);
            } else if (tile === TILE.ARTIFACT) {
                const src = assets.artifactBase[hash % assets.artifactBase.length];
                oc.drawImage(src, 0, 0, src.width, src.height, x * TILE_TEXELS, y * TILE_TEXELS, TILE_TEXELS, TILE_TEXELS);
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
