// ============================================================
// ZOMBIE DEFENSE - Crafting System
// ============================================================

// --- Crafting Layout Constants ---
const CRAFT_GRID_COLS = 20;
const CRAFT_GRID_ROWS = 20;
const CRAFT_CELL_SIZE = 36;
const CRAFT_GRID_W = CRAFT_GRID_COLS * CRAFT_CELL_SIZE;
const CRAFT_GRID_H = CRAFT_GRID_ROWS * CRAFT_CELL_SIZE;
const CRAFT_SIDE_GAP = 30;
const CRAFT_PALETTE_ITEM_H = 36;
const CRAFT_PALETTE_ITEM_W = 180;
const CRAFT_PREVIEW_W = CRAFT_GRID_W;
const CRAFT_STATS_GAP = 20;
const CRAFT_STATS_W = 200;
const CRAFT_PANEL_W = CRAFT_PALETTE_ITEM_W + CRAFT_SIDE_GAP + CRAFT_GRID_W + CRAFT_SIDE_GAP + CRAFT_PREVIEW_W;
const CRAFT_PANEL_H = CRAFT_GRID_H;

// Game-scale constants for sprite preview
const CRAFT_TILES_PER_CELL = 0.27;
const CRAFT_GAME_TILE = TILE_SIZE;
const CRAFT_PLAYER_W = TILE_SIZE * 0.8;
const CRAFT_PLAYER_H = TILE_SIZE * 1.8;

// --- Materials ---
const CRAFT_MATERIALS = [
    { id: 'steel',      name: 'Steel',          color: '#8a8a8a', unlockWave: 0 },
    { id: 'composite',  name: 'Composite',      color: '#3a3a3a', unlockWave: 0 },
    { id: 'powercell',  name: 'Power Cell',     color: '#c87533', unlockWave: 0 },
    { id: 'emitter',    name: 'Emitter',        color: '#ccaa22', unlockWave: 0 },
    { id: 'plasma',     name: 'Plasma Cell',    color: '#44bbff', unlockWave: 0 },
    { id: 'crystal',    name: 'Energy Crystal', color: '#aa44ff', unlockWave: 0 },
    { id: 'titanium',   name: 'Titanium',       color: '#c0c8d0', unlockWave: 0 },
    { id: 'darksteel',  name: 'Dark Steel',     color: '#2a2a40', unlockWave: 0 },
    { id: 'voidglass',  name: 'Void Glass',     color: '#1a3050', unlockWave: 0 },
    { id: 'mirror',     name: 'Mirror',         color: '#e0e8f0', unlockWave: 0, edgePlacement: true },
    { id: 'lens',       name: 'Lens',           color: '#88ccee', unlockWave: 0 },
    { id: 'diag',       name: 'Diag Mirror',    color: '#e0e8f0', unlockWave: 0, isDiagonal: true },
];

// --- Crafting State ---
const craft = {
    grid: [],
    selectedMaterial: null,
    hoveredCell: null,
    hoveredPalette: -1,
    eraseMode: false,
    mouseDown: false,
    mouseRightDown: false,
    weaponResult: null,
    lastHandleCell: null,
    establishedWeaponCell: null,
    steelBBox: null,
    exportedSprite: null,
    exportedWeapon: null,
    exportBtnRect: null,
    saveBtnRect: null,
    activeRays: [],  // rays from all active emitters (independent of weapon validation)
    // Edge mirrors: hEdges[r][c] = true means mirror on bottom edge of cell (r,c)
    //               vEdges[r][c] = true means mirror on right edge of cell (r,c)
    hEdges: [],  // horizontal mirrors (CRAFT_GRID_ROWS-1 x CRAFT_GRID_COLS)
    vEdges: [],  // vertical mirrors   (CRAFT_GRID_ROWS x CRAFT_GRID_COLS-1)
    hoveredEdge: null, // { type: 'h'|'v', r, c } or null
    // Grid zoom/pan
    gridZoom: 1,
    gridPanX: 0, // offset in grid pixels (before zoom)
    gridPanY: 0,
    gridPanning: false, // true during middle-mouse drag
    gridPanStartX: 0, gridPanStartY: 0, // mouse start for panning
    gridPanOrigX: 0, gridPanOrigY: 0,   // pan offset at drag start
    // Layout (recalculated on draw)
    panelX: 0, panelY: 0,
    paletteX: 0, paletteTop: 0,
    gridPad: 0, gridTop: 0,
    previewX: 0, previewTop: 0,
    statsX: 0, statsTop: 0,
};

// Initialize crafting grid
for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
    craft.grid[r] = [];
    for (let c = 0; c < CRAFT_GRID_COLS; c++) {
        craft.grid[r][c] = null;
    }
}
// Initialize edge mirror grids
for (let r = 0; r < CRAFT_GRID_ROWS - 1; r++) {
    craft.hEdges[r] = [];
    for (let c = 0; c < CRAFT_GRID_COLS; c++) craft.hEdges[r][c] = false;
}
for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
    craft.vEdges[r] = [];
    for (let c = 0; c < CRAFT_GRID_COLS - 1; c++) craft.vEdges[r][c] = false;
}

// --- Layout ---
function craftRecalcLayout() {
    craft.panelX = Math.floor((canvas.width - CRAFT_PANEL_W) / 2);
    craft.panelY = Math.floor((canvas.height - CRAFT_PANEL_H) / 2);
    craft.paletteX = craft.panelX;
    craft.paletteTop = craft.panelY;
    craft.gridPad = craft.panelX + CRAFT_PALETTE_ITEM_W + CRAFT_SIDE_GAP;
    craft.gridTop = craft.panelY;
    craft.previewX = craft.gridPad + CRAFT_GRID_W + CRAFT_SIDE_GAP;
    craft.previewTop = craft.panelY;
    craft.statsX = craft.panelX + CRAFT_PANEL_W + CRAFT_STATS_GAP;
    craft.statsTop = craft.panelY;
}

// --- Helpers ---
function craftGetAvailableMaterials() {
    const currentWave = gameState.waveNumber || 0;
    return CRAFT_MATERIALS.filter(m => m.unlockWave <= currentWave);
}

function craftGetMaterial(id) {
    if (id === 'diag_fwd' || id === 'diag_back') id = 'diag';
    return CRAFT_MATERIALS.find(m => m.id === id) || null;
}

function craftGetGridCell(mx, my) {
    const gx = mx - craft.gridPad;
    const gy = my - craft.gridTop;
    if (gx < 0 || gy < 0 || gx >= CRAFT_GRID_W || gy >= CRAFT_GRID_H) return null;
    return { c: Math.floor(gx / CRAFT_CELL_SIZE), r: Math.floor(gy / CRAFT_CELL_SIZE) };
}

// Find nearest grid edge to mouse position (for mirror placement).
// Returns { type: 'h'|'v', r, c } or null.
// 'h' edge at (r,c) = horizontal line between row r and r+1 at column c
// 'v' edge at (r,c) = vertical line between column c and c+1 at row r
const CRAFT_EDGE_SNAP_DIST = 8; // pixels from edge line to snap
function craftGetNearestEdge(mx, my) {
    const gx = mx - craft.gridPad;
    const gy = my - craft.gridTop;
    if (gx < 0 || gy < 0 || gx >= CRAFT_GRID_W || gy >= CRAFT_GRID_H) return null;

    // Position within the cell
    const cellC = Math.floor(gx / CRAFT_CELL_SIZE);
    const cellR = Math.floor(gy / CRAFT_CELL_SIZE);
    const localX = gx - cellC * CRAFT_CELL_SIZE;
    const localY = gy - cellR * CRAFT_CELL_SIZE;

    // Distance to each internal edge
    let bestDist = CRAFT_EDGE_SNAP_DIST;
    let best = null;

    // Bottom edge of this cell (horizontal edge between row cellR and cellR+1)
    if (cellR < CRAFT_GRID_ROWS - 1) {
        const d = Math.abs(localY - CRAFT_CELL_SIZE);
        if (d < bestDist) { bestDist = d; best = { type: 'h', r: cellR, c: cellC }; }
    }
    // Top edge of this cell (horizontal edge between row cellR-1 and cellR)
    if (cellR > 0) {
        const d = Math.abs(localY);
        if (d < bestDist) { bestDist = d; best = { type: 'h', r: cellR - 1, c: cellC }; }
    }
    // Right edge of this cell (vertical edge between col cellC and cellC+1)
    if (cellC < CRAFT_GRID_COLS - 1) {
        const d = Math.abs(localX - CRAFT_CELL_SIZE);
        if (d < bestDist) { bestDist = d; best = { type: 'v', r: cellR, c: cellC }; }
    }
    // Left edge of this cell (vertical edge between col cellC-1 and cellC)
    if (cellC > 0) {
        const d = Math.abs(localX);
        if (d < bestDist) { bestDist = d; best = { type: 'v', r: cellR, c: cellC - 1 }; }
    }

    return best;
}

function craftGetPaletteIndex(mx, my) {
    const available = craftGetAvailableMaterials();
    const px = mx - craft.paletteX;
    const py = my - craft.paletteTop;
    if (px < 0 || px >= CRAFT_PALETTE_ITEM_W || py < 0) return -1;
    const idx = Math.floor(py / CRAFT_PALETTE_ITEM_H);
    if (idx >= available.length) return -1;
    return idx;
}

function craftUpdateHover(mx, my) {
    craft.hoveredPalette = craftGetPaletteIndex(mx, my);
    const mat = craft.selectedMaterial ? craftGetMaterial(craft.selectedMaterial) : null;
    if (mat && mat.edgePlacement) {
        craft.hoveredCell = null;
        craft.hoveredEdge = craftGetNearestEdge(mx, my);
    } else {
        craft.hoveredCell = craftGetGridCell(mx, my);
        craft.hoveredEdge = null;
    }
}

function craftHitButton(btn, mx, my) {
    return btn && mx >= btn.x && mx <= btn.x + btn.w &&
           my >= btn.y && my <= btn.y + btn.h;
}

// --- Actions ---
function craftHandlePaint(mx, my) {
    if (!craft.selectedMaterial || craft.eraseMode) { craftHandleErase(mx, my); return; }
    const mat = craftGetMaterial(craft.selectedMaterial);
    if (mat && mat.edgePlacement) {
        // Edge placement (mirrors)
        const edge = craftGetNearestEdge(mx, my);
        if (edge) {
            const edges = edge.type === 'h' ? craft.hEdges : craft.vEdges;
            if (!edges[edge.r][edge.c]) {
                edges[edge.r][edge.c] = true;
                craftAnalyzeGrid();
            }
        }
        return;
    }
    const cell = craftGetGridCell(mx, my);
    if (cell && cell.r >= 0 && cell.r < CRAFT_GRID_ROWS && cell.c >= 0 && cell.c < CRAFT_GRID_COLS) {
        let matToPlace = craft.selectedMaterial;
        if (mat && mat.isDiagonal) {
            // Determine diagonal orientation from cursor position within cell
            const gx = mx - craft.gridPad;
            const gy = my - craft.gridTop;
            const localX = gx - cell.c * CRAFT_CELL_SIZE;
            const localY = gy - cell.r * CRAFT_CELL_SIZE;
            const halfCell = CRAFT_CELL_SIZE / 2;
            // Upper-right or lower-left quadrant → '/' (fwd)
            // Upper-left or lower-right quadrant → '\' (back)
            const rightHalf = localX > halfCell;
            const topHalf = localY < halfCell;
            matToPlace = (rightHalf === topHalf) ? 'diag_fwd' : 'diag_back';
        }
        if (craft.grid[cell.r][cell.c] !== matToPlace) {
            craft.grid[cell.r][cell.c] = matToPlace;
            craftAnalyzeGrid();
        }
    }
}

function craftHandleErase(mx, my) {
    // Try erasing an edge mirror first if near one
    const edge = craftGetNearestEdge(mx, my);
    if (edge) {
        const edges = edge.type === 'h' ? craft.hEdges : craft.vEdges;
        if (edges[edge.r][edge.c]) {
            edges[edge.r][edge.c] = false;
            craftAnalyzeGrid();
            return;
        }
    }
    const cell = craftGetGridCell(mx, my);
    if (cell && cell.r >= 0 && cell.r < CRAFT_GRID_ROWS && cell.c >= 0 && cell.c < CRAFT_GRID_COLS) {
        if (craft.grid[cell.r][cell.c] !== null) {
            craft.grid[cell.r][cell.c] = null;
            craftAnalyzeGrid();
        }
    }
}

function craftHandlePaletteClick(mx, my) {
    const idx = craftGetPaletteIndex(mx, my);
    if (idx >= 0) {
        const available = craftGetAvailableMaterials();
        const mat = available[idx];
        if (craft.selectedMaterial === mat.id) {
            craft.selectedMaterial = null;
            craft.eraseMode = true;
        } else {
            craft.selectedMaterial = mat.id;
            craft.eraseMode = false;
        }
        return true;
    }
    return false;
}

function craftClearGrid() {
    for (let r = 0; r < CRAFT_GRID_ROWS; r++)
        for (let c = 0; c < CRAFT_GRID_COLS; c++)
            craft.grid[r][c] = null;
    for (let r = 0; r < CRAFT_GRID_ROWS - 1; r++)
        for (let c = 0; c < CRAFT_GRID_COLS; c++)
            craft.hEdges[r][c] = false;
    for (let r = 0; r < CRAFT_GRID_ROWS; r++)
        for (let c = 0; c < CRAFT_GRID_COLS - 1; c++)
            craft.vEdges[r][c] = false;
    craftAnalyzeGrid();
}

function craftSaveWeapon() {
    const dataURL = craft.exportedSprite.toDataURL('image/png');
    const saved = JSON.parse(localStorage.getItem('zd_weapons') || '[]');
    const cellRows = craft.exportedSprite.height / CRAFT_CELL_SIZE;
    const visualHeight = Math.round(cellRows * CRAFT_TILES_PER_CELL * 100) / 100;
    saved.push({
        sprite: dataURL,
        name: craft.exportedWeapon.name,
        damage: craft.exportedWeapon.damage,
        speed: craft.exportedWeapon.speed,
        range: craft.exportedWeapon.range,
        weight: craft.exportedWeapon.weight,
        swingWeight: craft.exportedWeapon.swingWeight,
        knockback: craft.exportedWeapon.knockback,
        hasHandle: craft.exportedWeapon.hasHandle,
        visualHeight,
        colliderWidth: craft.exportedWeapon.colliderWidth,
        colliderHeight: craft.exportedWeapon.colliderHeight,
        colliderOffset: craft.exportedWeapon.colliderOffset,
    });
    localStorage.setItem('zd_weapons', JSON.stringify(saved));
    craft.exportedSprite = null;
    craft.exportedWeapon = null;
    // Trigger immediate weapon reload in game
    loadWeaponsFromStorage();
}

// ============================================================
// RULE-BASED WEAPON ANALYSIS
// ============================================================

function craftFindContiguous(startR, startC, materialId) {
    if (craft.grid[startR][startC] !== materialId) return [];
    const cells = [];
    const visited = new Set();
    const stack = [{ r: startR, c: startC }];
    while (stack.length > 0) {
        const { r, c } = stack.pop();
        const key = r + ',' + c;
        if (visited.has(key)) continue;
        if (r < 0 || r >= CRAFT_GRID_ROWS || c < 0 || c >= CRAFT_GRID_COLS) continue;
        if (craft.grid[r][c] !== materialId) continue;
        visited.add(key);
        cells.push({ r, c });
        stack.push({ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 });
    }
    return cells;
}

function craftFindHandle(steelCells, bbox) {
    const steelSet = new Set(steelCells.map(c => c.r + ',' + c.c));
    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    const candidates = [];

    for (const cell of steelCells) {
        for (const d of dirs) {
            const nr = cell.r + d.dr;
            const nc = cell.c + d.dc;
            if (nr < 0 || nr >= CRAFT_GRID_ROWS || nc < 0 || nc >= CRAFT_GRID_COLS) continue;
            if (craft.grid[nr][nc] !== 'composite') continue;
            if (steelSet.has(nr + ',' + nc)) continue;
            if (nr >= bbox.minR && nr <= bbox.maxR && nc >= bbox.minC && nc <= bbox.maxC) continue;

            const handleCells = [];
            let r = nr, c = nc;
            while (r >= 0 && r < CRAFT_GRID_ROWS && c >= 0 && c < CRAFT_GRID_COLS && craft.grid[r][c] === 'composite') {
                handleCells.push({ r, c });
                r += d.dr;
                c += d.dc;
            }

            const axis = d.dr !== 0 ? 'v' : 'h';
            candidates.push({ cells: handleCells, len: handleCells.length, firstCell: { r: nr, c: nc }, axis });
        }
    }

    if (candidates.length === 0) {
        craft.lastHandleCell = null;
        return null;
    }

    if (craft.lastHandleCell) {
        const prev = candidates.find(h => h.firstCell.r === craft.lastHandleCell.r && h.firstCell.c === craft.lastHandleCell.c);
        if (prev) return prev;
    }

    candidates.sort((a, b) => b.len - a.len);
    craft.lastHandleCell = candidates[0].firstCell;
    return candidates[0];
}

function craftAnalyzeGrid() {
    craft.weaponResult = null;
    craft.exportedSprite = null;
    craft.exportedWeapon = null;

    // Cast rays for every emitter touching a power cell
    craft.activeRays = [];
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
        for (let c = 0; c < CRAFT_GRID_COLS; c++) {
            if (craft.grid[r][c] !== 'emitter') continue;
            let hasPower = false;
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < CRAFT_GRID_ROWS && nc >= 0 && nc < CRAFT_GRID_COLS
                    && craft.grid[nr][nc] === 'powercell') {
                    hasPower = true;
                    break;
                }
            }
            if (hasPower) {
                const rays = craftCastRays(r, c);
                craft.activeRays.push(...rays);
            }
        }
    }

    let steelCells = null;
    if (craft.establishedWeaponCell && craft.grid[craft.establishedWeaponCell.r]?.[craft.establishedWeaponCell.c] === 'steel') {
        steelCells = craftFindContiguous(craft.establishedWeaponCell.r, craft.establishedWeaponCell.c, 'steel');
    }
    if (!steelCells || steelCells.length < 2) {
        craft.establishedWeaponCell = null;
        steelCells = null;
        const visited = new Set();
        for (let r = 0; r < CRAFT_GRID_ROWS && !steelCells; r++) {
            for (let c = 0; c < CRAFT_GRID_COLS && !steelCells; c++) {
                if (craft.grid[r][c] !== 'steel' || visited.has(r + ',' + c)) continue;
                const group = craftFindContiguous(r, c, 'steel');
                for (const cell of group) visited.add(cell.r + ',' + cell.c);
                if (group.length >= 2) steelCells = group;
            }
        }
    }
    if (!steelCells || steelCells.length < 2) {
        craft.establishedWeaponCell = null;
        craft.steelBBox = null;
        // No steel weapon — check for light source
        const lsCells = craftDetectLightSource();
        if (lsCells) {
            const emitter = lsCells[0];
            const power = lsCells[1];
            const lightDir = { dr: emitter.r - power.r, dc: emitter.c - power.c };
            craft.weaponResult = {
                name: 'Light Source',
                type: 'lightsource',
                steelCount: 0,
                clubLength: 0,
                handleLength: 0,
                weight: 0,
                swingWeight: 0,
                hasHandle: false,
                damage: 0,
                speed: 0,
                range: 0,
                colliderWidth: 0,
                colliderHeight: 0,
                colliderOffset: 0,
                cells: lsCells,
                handle: null,
                orientation: 'bottom',
                lightDir,
                steelBBox: {
                    minR: Math.min(lsCells[0].r, lsCells[1].r),
                    maxR: Math.max(lsCells[0].r, lsCells[1].r),
                    minC: Math.min(lsCells[0].c, lsCells[1].c),
                    maxC: Math.max(lsCells[0].c, lsCells[1].c),
                },
            };
        }
        return;
    }
    craft.establishedWeaponCell = { r: steelCells[0].r, c: steelCells[0].c };

    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const cell of steelCells) {
        if (cell.r < minR) minR = cell.r;
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c < minC) minC = cell.c;
        if (cell.c > maxC) maxC = cell.c;
    }
    craft.steelBBox = { minR, maxR, minC, maxC };

    const handle = craftFindHandle(steelCells, craft.steelBBox);
    const hasHandle = handle !== null;
    const handleLen = hasHandle ? handle.len : 0;

    const weaponCells = steelCells.map(c => ({ ...c }));
    if (handle) {
        for (const cell of handle.cells) weaponCells.push({ r: cell.r, c: cell.c });
    }

    const steelCount = steelCells.length;
    const bboxRows = craft.steelBBox.maxR - craft.steelBBox.minR + 1;
    const bboxCols = craft.steelBBox.maxC - craft.steelBBox.minC + 1;
    const clubLength = hasHandle
        ? (handle.axis === 'v' ? bboxRows : bboxCols)
        : Math.max(bboxRows, bboxCols);
    const handleLength = handleLen;
    const weight = steelCount * 1.0 + handleLen * 0.2;
    const range = (clubLength + handleLength) * 0.27 + 1.2;
    const name = hasHandle ? 'Steel Club' : 'Steel Club (no grip)';

    let orientation;
    if (hasHandle) {
        if (handle.axis === 'v') {
            orientation = handle.firstCell.r < craft.steelBBox.minR ? 'top' : 'bottom';
        } else {
            orientation = handle.firstCell.c < craft.steelBBox.minC ? 'left' : 'right';
        }
    } else {
        orientation = bboxRows >= bboxCols ? 'bottom' : 'right';
    }

    let handleTipPos;
    let getDistance;
    switch (orientation) {
        case 'bottom':
            handleTipPos = craft.steelBBox.maxR + handleLen;
            getDistance = (cell) => handleTipPos - cell.r;
            break;
        case 'top':
            handleTipPos = craft.steelBBox.minR - handleLen;
            getDistance = (cell) => cell.r - handleTipPos;
            break;
        case 'right':
            handleTipPos = craft.steelBBox.maxC + handleLen;
            getDistance = (cell) => handleTipPos - cell.c;
            break;
        case 'left':
            handleTipPos = craft.steelBBox.minC - handleLen;
            getDistance = (cell) => cell.c - handleTipPos;
            break;
    }
    let swingWeight = 0;
    for (const cell of steelCells) {
        swingWeight += getDistance(cell) * 1.0;
    }
    if (handle) {
        for (const cell of handle.cells) {
            swingWeight += getDistance(cell) * 0.2;
        }
    }

    const rawDamage = 30 * Math.log(swingWeight + 1);
    const damage = Math.round(hasHandle ? rawDamage * 1.25 : rawDamage);
    const swingDuration = (0.08 + 0.05 * Math.sqrt(swingWeight)) * (hasHandle ? 0.75 : 1.0);
    const speed = Math.round(swingDuration * 100) / 100;
    const knockback = Math.round(MELEE_KNOCKBACK_COEFF * Math.sqrt(swingWeight) * range);

    const clubWidth = (orientation === 'top' || orientation === 'bottom') ? bboxCols : bboxRows;
    const colliderWidth = Math.round(clubWidth * CRAFT_TILES_PER_CELL * 100) / 100;
    const colliderHeight = Math.round(clubLength * CRAFT_TILES_PER_CELL * 100) / 100;
    const colliderOffset = Math.round(handleLength * CRAFT_TILES_PER_CELL * 100) / 100;

    craft.weaponResult = {
        name,
        steelCount,
        clubLength,
        handleLength,
        weight: Math.round(weight * 100) / 100,
        swingWeight: Math.round(swingWeight * 100) / 100,
        hasHandle,
        damage,
        knockback,
        speed: Math.round(speed * 100) / 100,
        range: Math.round(range * 100) / 100,
        colliderWidth,
        colliderHeight,
        colliderOffset,
        cells: weaponCells,
        handle,
        orientation,
        steelBBox: { ...craft.steelBBox },
    };
}

// Detect light source: emitter cardinally adjacent to a power cell
function craftDetectLightSource() {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
        for (let c = 0; c < CRAFT_GRID_COLS; c++) {
            if (craft.grid[r][c] !== 'emitter') continue;
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= CRAFT_GRID_ROWS || nc < 0 || nc >= CRAFT_GRID_COLS) continue;
                if (craft.grid[nr][nc] === 'powercell') {
                    return [{ r, c }, { r: nr, c: nc }];
                }
            }
        }
    }
    return null;
}

// Cast rays from emitter center in all directions using exact grid-line
// crossing (DDA). Rays reflect off edge mirrors and stop at solid cells
// or grid boundaries.
// Returns array of ray segments: { segments: [{ r1,c1, r2,c2 }, ...] }
const CRAFT_RAY_COUNT = 360;
const CRAFT_RAY_MAX_DIST = 200;    // max total distance in grid cells
const CRAFT_RAY_MAX_BOUNCES = 20; // max mirror reflections per ray

function craftCastRays(emitterR, emitterC) {
    const originR = emitterR + 0.5;
    const originC = emitterC + 0.5;
    const allSegments = [];

    for (let i = 0; i < CRAFT_RAY_COUNT; i++) {
        const angle = (i / CRAFT_RAY_COUNT) * Math.PI * 2;
        const segments = craftTraceRay(originR, originC, Math.sin(angle), Math.cos(angle), emitterR, emitterC);
        allSegments.push(...segments);
    }

    return allSegments;
}

// Maximum acceptance angle for lens collimation (60° from perpendicular)
const CRAFT_LENS_MAX_ANGLE = 60 * Math.PI / 180;

function craftTraceRay(startR, startC, dr, dc, emitterR, emitterC) {
    const segments = [];
    let r = startR;
    let c = startC;
    let totalDist = 0;

    for (let bounce = 0; bounce <= CRAFT_RAY_MAX_BOUNCES; bounce++) {
        const seg = craftStepRay(r, c, dr, dc, emitterR, emitterC, CRAFT_RAY_MAX_DIST - totalDist);
        segments.push({ r1: r, c1: c, r2: seg.r, c2: seg.c });
        totalDist += seg.dist;

        if (totalDist >= CRAFT_RAY_MAX_DIST) break;

        if (seg.mirror) {
            // Reflect direction based on mirror orientation
            if (seg.mirrorType === 'both') {
                dr = -dr;
                dc = -dc;
            } else if (seg.mirrorType === 'h') {
                dr = -dr;
            } else {
                dc = -dc;
            }
            r = seg.r + dr * 1e-6;
            c = seg.c + dc * 1e-6;
            continue;
        }

        if (seg.hitMat === 'lens') {
            // Determine entry face based on ray direction
            // The ray stopped at the edge of the lens cell — figure out which face
            const lensR = seg.hitCellR;
            const lensC = seg.hitCellC;

            // Entry position is at seg.r, seg.c (on the cell boundary)
            // Determine which face based on ray direction
            let faceAxis; // 'h' = entered top/bottom face, 'v' = entered left/right face
            if (Math.abs(dr) > Math.abs(dc)) {
                faceAxis = 'h'; // primarily vertical movement, entered top or bottom
            } else {
                faceAxis = 'v'; // primarily horizontal movement, entered left or right
            }

            // Calculate angle of incidence relative to face normal
            // For 'h' face: normal is vertical, so angle = atan2(|dc|, |dr|)
            // For 'v' face: normal is horizontal, so angle = atan2(|dr|, |dc|)
            let incidenceAngle;
            if (faceAxis === 'h') {
                incidenceAngle = Math.atan2(Math.abs(dc), Math.abs(dr));
            } else {
                incidenceAngle = Math.atan2(Math.abs(dr), Math.abs(dc));
            }

            if (incidenceAngle > CRAFT_LENS_MAX_ANGLE) {
                // Too steep — reflect off the face (total internal reflection)
                if (faceAxis === 'h') {
                    dr = -dr;
                } else {
                    dc = -dc;
                }
                r = seg.r + dr * 1e-6;
                c = seg.c + dc * 1e-6;
                continue;
            }

            // Collimate: ray passes through the lens, exits opposite face
            // with tangential component zeroed out
            if (faceAxis === 'h') {
                // Entered top/bottom — exits opposite side, perfectly vertical
                const exitR = dr > 0 ? lensR + 1 : lensR;
                const exitC = seg.c; // same column position
                const lensDist = Math.abs(exitR - seg.r);
                segments.push({ r1: seg.r, c1: seg.c, r2: exitR, c2: exitC });
                totalDist += lensDist;
                dc = 0; // zero out horizontal component
                // Normalize dr to unit length (it's already ±sin, but dc was zeroed)
                dr = dr > 0 ? 1 : -1;
                r = exitR + dr * 1e-6;
                c = exitC;
            } else {
                // Entered left/right — exits opposite side, perfectly horizontal
                const exitC = dc > 0 ? lensC + 1 : lensC;
                const exitR = seg.r; // same row position
                const lensDist = Math.abs(exitC - seg.c);
                segments.push({ r1: seg.r, c1: seg.c, r2: exitR, c2: exitC });
                totalDist += lensDist;
                dr = 0; // zero out vertical component
                dc = dc > 0 ? 1 : -1;
                r = exitR;
                c = exitC + dc * 1e-6;
            }
            continue;
        }

        if (seg.hitMat === 'diag_fwd' || seg.hitMat === 'diag_back') {
            // Diagonal mirror — compute exact intersection with the diagonal line
            const cellR = seg.hitCellR;
            const cellC = seg.hitCellC;

            // Ray enters at (seg.r, seg.c) with direction (dr, dc)
            // For / diagonal: line from (cellR+1, cellC) to (cellR, cellC+1)
            //   equation: row + col = cellR + cellC + 1
            //   intersection: seg.r + s*dr + seg.c + s*dc = cellR + cellC + 1
            //   s = (cellR + cellC + 1 - seg.r - seg.c) / (dr + dc)
            // For \ diagonal: line from (cellR, cellC) to (cellR+1, cellC+1)
            //   equation: row - col = cellR - cellC
            //   intersection: seg.r + s*dr - seg.c - s*dc = cellR - cellC
            //   s = (cellR - cellC - seg.r + seg.c) / (dr - dc)

            let s;
            if (seg.hitMat === 'diag_fwd') {
                const denom = dr + dc;
                if (Math.abs(denom) < 1e-9) break; // parallel to diagonal, stop
                s = (cellR + cellC + 1 - seg.r - seg.c) / denom;
            } else {
                const denom = dr - dc;
                if (Math.abs(denom) < 1e-9) break; // parallel to diagonal, stop
                s = (cellR - cellC - seg.r + seg.c) / denom;
            }

            if (s < 0) break; // intersection behind ray, shouldn't happen

            const hitR = seg.r + dr * s;
            const hitC = seg.c + dc * s;

            // Add segment from cell entry to diagonal intersection
            segments.push({ r1: seg.r, c1: seg.c, r2: hitR, c2: hitC });
            totalDist += Math.sqrt(s * s * (dr * dr + dc * dc));

            // Reflect
            // / diagonal: (dr, dc) → (-dc, -dr)
            // \ diagonal: (dr, dc) → (dc, dr)
            let newDr, newDc;
            if (seg.hitMat === 'diag_fwd') {
                newDr = -dc;
                newDc = -dr;
            } else {
                newDr = dc;
                newDc = dr;
            }
            dr = newDr;
            dc = newDc;
            r = hitR + dr * 1e-6;
            c = hitC + dc * 1e-6;
            continue;
        }

        // Hit a non-lens solid cell or went out of bounds — stop
        break;
    }

    return segments;
}

// Step a ray from (r,c) in direction (dr,dc) using DDA until it hits
// a solid cell, a mirror edge, or travels maxDist.
// Returns { r, c, dist, mirror: bool, mirrorType: 'h'|'v'|null, hitMat: string|null }
function craftStepRay(r, c, dr, dc, emitterR, emitterC, maxDist) {
    let dist = 0;
    // Small epsilon to avoid getting stuck on boundaries
    const EPS = 1e-6;

    while (dist < maxDist) {
        // Current cell
        const cellR = Math.floor(r - (dr < 0 ? EPS : 0));
        const cellC = Math.floor(c - (dc < 0 ? EPS : 0));

        // Check if out of bounds
        if (cellR < 0 || cellR >= CRAFT_GRID_ROWS || cellC < 0 || cellC >= CRAFT_GRID_COLS) {
            return { r, c, dist, mirror: false, mirrorType: null };
        }

        // Check if we hit a solid cell (not null, not emitter)
        const mat = craft.grid[cellR][cellC];
        if (mat !== null && !(cellR === emitterR && cellC === emitterC)) {
            return { r, c, dist, mirror: false, mirrorType: null, hitMat: mat, hitCellR: cellR, hitCellC: cellC };
        }

        // Calculate distance to next horizontal and vertical grid lines
        let tH = Infinity; // time to next horizontal grid line
        let tV = Infinity; // time to next vertical grid line

        if (dr > 0) {
            tH = (Math.floor(r) + 1 - r) / dr;
        } else if (dr < 0) {
            tH = (Math.ceil(r) - 1 - r) / dr;
            if (r === Math.floor(r)) tH = -1.0 / dr; // exactly on a line, go to previous
        }

        if (dc > 0) {
            tV = (Math.floor(c) + 1 - c) / dc;
        } else if (dc < 0) {
            tV = (Math.ceil(c) - 1 - c) / dc;
            if (c === Math.floor(c)) tV = -1.0 / dc;
        }

        // Ensure positive times (avoid zero-step)
        if (tH < EPS) tH = Infinity;
        if (tV < EPS) tV = Infinity;

        const tMin = Math.min(tH, tV);
        if (tMin === Infinity || dist + tMin > maxDist) {
            // Can't reach next grid line within budget
            const remaining = maxDist - dist;
            return { r: r + dr * remaining, c: c + dc * remaining, dist: maxDist, mirror: false, mirrorType: null };
        }

        // Advance to the grid line crossing
        const newR = r + dr * tMin;
        const newC = c + dc * tMin;
        dist += tMin;

        // Check if a horizontal mirror exists at edgeRow, covering position colPos.
        // Also checks adjacent cell if colPos is near an integer boundary.
        const EDGE_EPS = 0.01;
        function checkHMirror(edgeRow, colPos) {
            if (edgeRow < 0 || edgeRow >= CRAFT_GRID_ROWS - 1) return false;
            const col = Math.floor(colPos);
            if (col >= 0 && col < CRAFT_GRID_COLS && craft.hEdges[edgeRow][col]) return true;
            // Check adjacent cell if near boundary
            const frac = colPos - col;
            if (frac < EDGE_EPS && col - 1 >= 0 && craft.hEdges[edgeRow][col - 1]) return true;
            if (frac > 1 - EDGE_EPS && col + 1 < CRAFT_GRID_COLS && craft.hEdges[edgeRow][col + 1]) return true;
            return false;
        }
        function checkVMirror(edgeCol, rowPos) {
            if (edgeCol < 0 || edgeCol >= CRAFT_GRID_COLS - 1) return false;
            const row = Math.floor(rowPos);
            if (row >= 0 && row < CRAFT_GRID_ROWS && craft.vEdges[row][edgeCol]) return true;
            const frac = rowPos - row;
            if (frac < EDGE_EPS && row - 1 >= 0 && craft.vEdges[row - 1][edgeCol]) return true;
            if (frac > 1 - EDGE_EPS && row + 1 < CRAFT_GRID_ROWS && craft.vEdges[row + 1][edgeCol]) return true;
            return false;
        }

        // Determine which edge we crossed and check for mirror
        if (tH < tV - EPS) {
            // Crossed a horizontal edge
            const edgeRow = dr > 0 ? Math.floor(r) : Math.floor(r) - 1;
            if (checkHMirror(edgeRow, newC)) {
                return { r: newR, c: newC, dist, mirror: true, mirrorType: 'h' };
            }
        } else if (tV < tH - EPS) {
            // Crossed a vertical edge
            const edgeCol = dc > 0 ? Math.floor(c) : Math.floor(c) - 1;
            if (checkVMirror(edgeCol, newR)) {
                return { r: newR, c: newC, dist, mirror: true, mirrorType: 'v' };
            }
        } else {
            // Hit corner — check both edges
            const hRow = dr > 0 ? Math.floor(r) : Math.floor(r) - 1;
            const vCol = dc > 0 ? Math.floor(c) : Math.floor(c) - 1;
            const hitH = checkHMirror(hRow, newC);
            const hitV = checkVMirror(vCol, newR);
            if (hitH && hitV) {
                return { r: newR, c: newC, dist, mirror: true, mirrorType: 'both' };
            } else if (hitH) {
                return { r: newR, c: newC, dist, mirror: true, mirrorType: 'h' };
            } else if (hitV) {
                return { r: newR, c: newC, dist, mirror: true, mirrorType: 'v' };
            }
        }

        // No mirror — check the new cell we're entering
        r = newR;
        c = newC;
    }

    return { r, c, dist, mirror: false, mirrorType: null };
}

// ============================================================
// WEAPON RENDERING
// ============================================================

function craftRemapCell(r, c, bbox, orientation) {
    const br = r - bbox.minR;
    const bc = c - bbox.minC;
    const bRows = bbox.maxR - bbox.minR;
    const bCols = bbox.maxC - bbox.minC;
    switch (orientation) {
        case 'bottom': return { r: br, c: bc };
        case 'top':    return { r: bRows - br, c: bc };
        case 'left':   return { r: bCols - bc, c: br };
        case 'right':  return { r: bc, c: bRows - br };
    }
}

function craftPrepareWeaponRender(weapon) {
    const cells = weapon.cells;
    if (!cells || cells.length === 0) return null;

    let srcMinR = Infinity, srcMaxR = -Infinity, srcMinC = Infinity, srcMaxC = -Infinity;
    for (const cell of cells) {
        if (cell.r < srcMinR) srcMinR = cell.r;
        if (cell.r > srcMaxR) srcMaxR = cell.r;
        if (cell.c < srcMinC) srcMinC = cell.c;
        if (cell.c > srcMaxC) srcMaxC = cell.c;
    }
    const srcBBox = { minR: srcMinR, maxR: srcMaxR, minC: srcMinC, maxC: srcMaxC };

    const remapped = [];
    for (const cell of cells) {
        const rc = craftRemapCell(cell.r, cell.c, srcBBox, weapon.orientation);
        remapped.push({ r: rc.r, c: rc.c, mat: craft.grid[cell.r][cell.c] });
    }

    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const cell of remapped) {
        if (cell.r < minR) minR = cell.r;
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c < minC) minC = cell.c;
        if (cell.c > maxC) maxC = cell.c;
    }

    const localGrid = {};
    for (const cell of remapped) localGrid[cell.r + ',' + cell.c] = cell.mat;
    const wGrid = (r, c) => localGrid[r + ',' + c] || null;

    return { remapped, wGrid, minR, maxR, minC, maxC,
        remapW: (maxC - minC + 1) * CRAFT_CELL_SIZE,
        remapH: (maxR - minR + 1) * CRAFT_CELL_SIZE };
}

// Render weapon cells to a target context at a given offset
function craftRenderWeaponCells(targetCtx, prepared, ox, oy) {
    const { remapped, wGrid } = prepared;
    const gridCornerR = CRAFT_CELL_SIZE * 0.3;
    const compNarrow = CRAFT_CELL_SIZE * 0.25;

    for (const cell of remapped) {
        const r = cell.r;
        const c = cell.c;
        const mat = cell.mat;
        if (!mat) continue;
        const m = craftGetMaterial(mat);
        if (!m) continue;

        const x = ox + c * CRAFT_CELL_SIZE;
        const y = oy + r * CRAFT_CELL_SIZE;

        const sameTop    = wGrid(r - 1, c) === mat;
        const sameBottom = wGrid(r + 1, c) === mat;
        const sameLeft   = wGrid(r, c - 1) === mat;
        const sameRight  = wGrid(r, c + 1) === mat;

        const anyTop    = wGrid(r - 1, c) !== null && wGrid(r - 1, c) !== mat;
        const anyBottom = wGrid(r + 1, c) !== null && wGrid(r + 1, c) !== mat;
        const anyLeft   = wGrid(r, c - 1) !== null && wGrid(r, c - 1) !== mat;
        const anyRight  = wGrid(r, c + 1) !== null && wGrid(r, c + 1) !== mat;

        let narrowTop = 0, narrowBottom = 0, narrowLeft = 0, narrowRight = 0;
        if (mat === 'composite') {
            const connH = anyLeft || anyRight || sameLeft || sameRight;
            const connV = anyTop || anyBottom || sameTop || sameBottom;
            if (connV && !connH) {
                narrowLeft = compNarrow;
                narrowRight = compNarrow;
            } else if (connH && !connV) {
                narrowTop = compNarrow;
                narrowBottom = compNarrow;
            } else if (!connH && !connV) {
                narrowTop = compNarrow * 0.5;
                narrowBottom = compNarrow * 0.5;
                narrowLeft = compNarrow * 0.5;
                narrowRight = compNarrow * 0.5;
            }
        }

        const hasTop    = wGrid(r - 1, c) !== null;
        const hasBottom = wGrid(r + 1, c) !== null;
        const hasLeft   = wGrid(r, c - 1) !== null;
        const hasRight  = wGrid(r, c + 1) !== null;

        const canRound = mat !== 'composite';
        const rTL = (canRound && !hasTop && !hasLeft) ? gridCornerR : 0;
        const rTR = (canRound && !hasTop && !hasRight) ? gridCornerR : 0;
        const rBR = (canRound && !hasBottom && !hasRight) ? gridCornerR : 0;
        const rBL = (canRound && !hasBottom && !hasLeft) ? gridCornerR : 0;

        const left   = x + narrowLeft;
        const right  = x + CRAFT_CELL_SIZE - narrowRight;
        const top    = y + narrowTop;
        const bottom = y + CRAFT_CELL_SIZE - narrowBottom;

        targetCtx.beginPath();
        targetCtx.moveTo(left + rTL, top);
        targetCtx.lineTo(right - rTR, top);
        if (rTR > 0) targetCtx.arcTo(right, top, right, top + rTR, rTR);
        else targetCtx.lineTo(right, top);
        targetCtx.lineTo(right, bottom - rBR);
        if (rBR > 0) targetCtx.arcTo(right, bottom, right - rBR, bottom, rBR);
        else targetCtx.lineTo(right, bottom);
        targetCtx.lineTo(left + rBL, bottom);
        if (rBL > 0) targetCtx.arcTo(left, bottom, left, bottom - rBL, rBL);
        else targetCtx.lineTo(left, bottom);
        targetCtx.lineTo(left, top + rTL);
        if (rTL > 0) targetCtx.arcTo(left, top, left + rTL, top, rTL);
        else targetCtx.lineTo(left, top);
        targetCtx.closePath();

        // Emitter: semi-transparent block + yellow circle
        if (mat === 'emitter') {
            targetCtx.globalAlpha = 0.3;
            targetCtx.fillStyle = m.color;
            targetCtx.fill();
            targetCtx.globalAlpha = 1.0;
            const cx = x + CRAFT_CELL_SIZE / 2;
            const cy = y + CRAFT_CELL_SIZE / 2;
            const er = CRAFT_CELL_SIZE * 0.28;
            targetCtx.beginPath();
            targetCtx.arc(cx, cy, er, 0, Math.PI * 2);
            targetCtx.fillStyle = '#ddaa00';
            targetCtx.fill();
        } else {
            targetCtx.fillStyle = m.color;
            targetCtx.fill();
        }

        // Concave fillets for composite
        if (mat === 'composite') {
            const fR = compNarrow;
            targetCtx.fillStyle = m.color;

            if (anyTop && narrowLeft > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(left, y);
                targetCtx.lineTo(left, y + fR);
                targetCtx.arc(x, y + fR, fR, 0, -Math.PI / 2, true);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyTop && narrowRight > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(right, y);
                targetCtx.lineTo(right, y + fR);
                targetCtx.arc(x + CRAFT_CELL_SIZE, y + fR, fR, Math.PI, -Math.PI / 2, false);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyBottom && narrowLeft > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(left, y + CRAFT_CELL_SIZE);
                targetCtx.lineTo(left, y + CRAFT_CELL_SIZE - fR);
                targetCtx.arc(x, y + CRAFT_CELL_SIZE - fR, fR, 0, Math.PI / 2, false);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyBottom && narrowRight > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(right, y + CRAFT_CELL_SIZE);
                targetCtx.lineTo(right, y + CRAFT_CELL_SIZE - fR);
                targetCtx.arc(x + CRAFT_CELL_SIZE, y + CRAFT_CELL_SIZE - fR, fR, Math.PI, Math.PI / 2, true);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyLeft && narrowTop > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(x, top);
                targetCtx.lineTo(x + fR, top);
                targetCtx.arc(x + fR, y, fR, Math.PI / 2, Math.PI, false);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyLeft && narrowBottom > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(x, bottom);
                targetCtx.lineTo(x + fR, bottom);
                targetCtx.arc(x + fR, y + CRAFT_CELL_SIZE, fR, -Math.PI / 2, Math.PI, true);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyRight && narrowTop > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(x + CRAFT_CELL_SIZE, top);
                targetCtx.lineTo(x + CRAFT_CELL_SIZE - fR, top);
                targetCtx.arc(x + CRAFT_CELL_SIZE - fR, y, fR, Math.PI / 2, 0, true);
                targetCtx.closePath();
                targetCtx.fill();
            }
            if (anyRight && narrowBottom > 0) {
                targetCtx.beginPath();
                targetCtx.moveTo(x + CRAFT_CELL_SIZE, bottom);
                targetCtx.lineTo(x + CRAFT_CELL_SIZE - fR, bottom);
                targetCtx.arc(x + CRAFT_CELL_SIZE - fR, y + CRAFT_CELL_SIZE, fR, -Math.PI / 2, 0, false);
                targetCtx.closePath();
                targetCtx.fill();
            }
        }
    }
}

function craftDrawWeaponPreview(weapon) {
    const prepared = craftPrepareWeaponRender(weapon);
    if (!prepared) return;
    const { minC, minR, remapW, remapH } = prepared;
    const ox = craft.previewX + Math.floor((CRAFT_PREVIEW_W - remapW) / 2) - minC * CRAFT_CELL_SIZE;
    const oy = craft.previewTop + Math.floor((CRAFT_GRID_H - remapH) / 2) - minR * CRAFT_CELL_SIZE;

    craftRenderWeaponCells(ctx, prepared, ox, oy);
}

function craftGenerateExportSprite(weapon) {
    const prepared = craftPrepareWeaponRender(weapon);
    if (!prepared) return null;
    const { minC, minR, remapW, remapH } = prepared;
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = remapW;
    spriteCanvas.height = remapH;
    const sctx = spriteCanvas.getContext('2d');
    craftRenderWeaponCells(sctx, prepared, -minC * CRAFT_CELL_SIZE, -minR * CRAFT_CELL_SIZE);
    return spriteCanvas;
}

// ============================================================
// DRAWING (full-screen overlay)
// ============================================================

function drawCrafting() {
    craftRecalcLayout();

    // Full-screen dark background
    ctx.fillStyle = '#051025';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Noise overlay
    ctx.globalAlpha = 0.3;
    for (let nx = 0; nx < canvas.width; nx += 256) {
        for (let ny = 0; ny < canvas.height; ny += 256) {
            ctx.drawImage(assets.noise, nx, ny);
        }
    }
    ctx.globalAlpha = 1.0;

    // Panel border
    ctx.strokeStyle = 'rgba(100, 210, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(craft.panelX + 0.5, craft.panelY + 0.5, CRAFT_PANEL_W - 1, CRAFT_PANEL_H - 1);

    // Left divider (between palette and grid)
    const leftDivX = craft.gridPad;
    ctx.beginPath();
    ctx.moveTo(leftDivX + 0.5, craft.panelY);
    ctx.lineTo(leftDivX + 0.5, craft.panelY + CRAFT_PANEL_H);
    ctx.strokeStyle = 'rgba(100, 210, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right divider (between grid and preview)
    const rightDivX = craft.gridPad + CRAFT_GRID_W;
    ctx.beginPath();
    ctx.moveTo(rightDivX + 0.5, craft.panelY);
    ctx.lineTo(rightDivX + 0.5, craft.panelY + CRAFT_PANEL_H);
    ctx.strokeStyle = 'rgba(100, 210, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Draw grid (with zoom/pan) ---
    ctx.save();
    // Clip to grid area
    ctx.beginPath();
    ctx.rect(craft.gridPad, craft.gridTop, CRAFT_GRID_W, CRAFT_GRID_H);
    ctx.clip();
    // Apply zoom/pan transform
    ctx.translate(craft.gridPad + craft.gridPanX, craft.gridTop + craft.gridPanY);
    ctx.scale(craft.gridZoom, craft.gridZoom);
    ctx.translate(-craft.gridPad, -craft.gridTop);

    const gridCornerR = CRAFT_CELL_SIZE * 0.3;
    const compNarrow = CRAFT_CELL_SIZE * 0.25;

    for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
        for (let c = 0; c < CRAFT_GRID_COLS; c++) {
            const x = craft.gridPad + c * CRAFT_CELL_SIZE;
            const y = craft.gridTop + r * CRAFT_CELL_SIZE;

            // Grid lines
            ctx.strokeStyle = 'rgba(100, 210, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, CRAFT_CELL_SIZE - 1, CRAFT_CELL_SIZE - 1);

            const mat = craft.grid[r][c];
            if (!mat) continue;

            const m = craftGetMaterial(mat);
            if (!m) continue;

            const sameTop    = r > 0 && craft.grid[r - 1][c] === mat;
            const sameBottom = r < CRAFT_GRID_ROWS - 1 && craft.grid[r + 1][c] === mat;
            const sameLeft   = c > 0 && craft.grid[r][c - 1] === mat;
            const sameRight  = c < CRAFT_GRID_COLS - 1 && craft.grid[r][c + 1] === mat;

            const anyTop    = r > 0 && craft.grid[r - 1][c] !== null && craft.grid[r - 1][c] !== mat;
            const anyBottom = r < CRAFT_GRID_ROWS - 1 && craft.grid[r + 1][c] !== null && craft.grid[r + 1][c] !== mat;
            const anyLeft   = c > 0 && craft.grid[r][c - 1] !== null && craft.grid[r][c - 1] !== mat;
            const anyRight  = c < CRAFT_GRID_COLS - 1 && craft.grid[r][c + 1] !== null && craft.grid[r][c + 1] !== mat;

            let narrowTop = 0, narrowBottom = 0, narrowLeft = 0, narrowRight = 0;
            if (mat === 'composite') {
                const connH = anyLeft || anyRight || sameLeft || sameRight;
                const connV = anyTop || anyBottom || sameTop || sameBottom;
                if (connV && !connH) {
                    narrowLeft = compNarrow;
                    narrowRight = compNarrow;
                } else if (connH && !connV) {
                    narrowTop = compNarrow;
                    narrowBottom = compNarrow;
                } else if (!connH && !connV) {
                    narrowTop = compNarrow * 0.5;
                    narrowBottom = compNarrow * 0.5;
                    narrowLeft = compNarrow * 0.5;
                    narrowRight = compNarrow * 0.5;
                }
            }

            const hasTop    = r > 0 && craft.grid[r - 1][c] !== null;
            const hasBottom = r < CRAFT_GRID_ROWS - 1 && craft.grid[r + 1][c] !== null;
            const hasLeft   = c > 0 && craft.grid[r][c - 1] !== null;
            const hasRight  = c < CRAFT_GRID_COLS - 1 && craft.grid[r][c + 1] !== null;

            const canRound = mat !== 'composite';
            const rTL = (canRound && !hasTop && !hasLeft) ? gridCornerR : 0;
            const rTR = (canRound && !hasTop && !hasRight) ? gridCornerR : 0;
            const rBR = (canRound && !hasBottom && !hasRight) ? gridCornerR : 0;
            const rBL = (canRound && !hasBottom && !hasLeft) ? gridCornerR : 0;

            const left   = x + narrowLeft;
            const right  = x + CRAFT_CELL_SIZE - narrowRight;
            const top    = y + narrowTop;
            const bottom = y + CRAFT_CELL_SIZE - narrowBottom;

            ctx.beginPath();
            ctx.moveTo(left + rTL, top);
            ctx.lineTo(right - rTR, top);
            if (rTR > 0) ctx.arcTo(right, top, right, top + rTR, rTR);
            else ctx.lineTo(right, top);
            ctx.lineTo(right, bottom - rBR);
            if (rBR > 0) ctx.arcTo(right, bottom, right - rBR, bottom, rBR);
            else ctx.lineTo(right, bottom);
            ctx.lineTo(left + rBL, bottom);
            if (rBL > 0) ctx.arcTo(left, bottom, left, bottom - rBL, rBL);
            else ctx.lineTo(left, bottom);
            ctx.lineTo(left, top + rTL);
            if (rTL > 0) ctx.arcTo(left, top, left + rTL, top, rTL);
            else ctx.lineTo(left, top);
            ctx.closePath();

            if (mat === 'emitter') {
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = m.color;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                const ecx = x + CRAFT_CELL_SIZE / 2;
                const ecy = y + CRAFT_CELL_SIZE / 2;
                const er = CRAFT_CELL_SIZE * 0.28;
                ctx.beginPath();
                ctx.arc(ecx, ecy, er, 0, Math.PI * 2);
                ctx.fillStyle = '#ddaa00';
                ctx.fill();
            } else if (mat === 'lens') {
                // Semi-transparent block with convex lens shape
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = m.color;
                ctx.fill();
                ctx.globalAlpha = 0.7;
                // Vertical convex lens shape
                const lcx = x + CRAFT_CELL_SIZE / 2;
                const lcy = y + CRAFT_CELL_SIZE / 2;
                const lw = CRAFT_CELL_SIZE * 0.2;
                const lh = CRAFT_CELL_SIZE * 0.4;
                ctx.beginPath();
                ctx.ellipse(lcx, lcy, lw, lh, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(136, 204, 238, 0.6)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(136, 204, 238, 0.8)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            } else if (mat === 'diag_fwd' || mat === 'diag_back') {
                // Diagonal mirror — draw the diagonal line
                ctx.strokeStyle = 'rgba(224, 232, 240, 0.9)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                if (mat === 'diag_fwd') {
                    // / diagonal: bottom-left to top-right
                    ctx.moveTo(x, y + CRAFT_CELL_SIZE);
                    ctx.lineTo(x + CRAFT_CELL_SIZE, y);
                } else {
                    // \ diagonal: top-left to bottom-right
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + CRAFT_CELL_SIZE, y + CRAFT_CELL_SIZE);
                }
                ctx.stroke();
            } else {
                ctx.fillStyle = m.color;
                ctx.fill();
            }

            // Concave fillets for composite
            if (mat === 'composite') {
                const fR = compNarrow;
                ctx.fillStyle = m.color;

                if (anyTop && narrowLeft > 0) {
                    ctx.beginPath();
                    ctx.moveTo(left, y);
                    ctx.lineTo(left, y + fR);
                    ctx.arc(x, y + fR, fR, 0, -Math.PI / 2, true);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyTop && narrowRight > 0) {
                    ctx.beginPath();
                    ctx.moveTo(right, y);
                    ctx.lineTo(right, y + fR);
                    ctx.arc(x + CRAFT_CELL_SIZE, y + fR, fR, Math.PI, -Math.PI / 2, false);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyBottom && narrowLeft > 0) {
                    ctx.beginPath();
                    ctx.moveTo(left, y + CRAFT_CELL_SIZE);
                    ctx.lineTo(left, y + CRAFT_CELL_SIZE - fR);
                    ctx.arc(x, y + CRAFT_CELL_SIZE - fR, fR, 0, Math.PI / 2, false);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyBottom && narrowRight > 0) {
                    ctx.beginPath();
                    ctx.moveTo(right, y + CRAFT_CELL_SIZE);
                    ctx.lineTo(right, y + CRAFT_CELL_SIZE - fR);
                    ctx.arc(x + CRAFT_CELL_SIZE, y + CRAFT_CELL_SIZE - fR, fR, Math.PI, Math.PI / 2, true);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyLeft && narrowTop > 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, top);
                    ctx.lineTo(x + fR, top);
                    ctx.arc(x + fR, y, fR, Math.PI / 2, Math.PI, false);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyLeft && narrowBottom > 0) {
                    ctx.beginPath();
                    ctx.moveTo(x, bottom);
                    ctx.lineTo(x + fR, bottom);
                    ctx.arc(x + fR, y + CRAFT_CELL_SIZE, fR, -Math.PI / 2, Math.PI, true);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyRight && narrowTop > 0) {
                    ctx.beginPath();
                    ctx.moveTo(x + CRAFT_CELL_SIZE, top);
                    ctx.lineTo(x + CRAFT_CELL_SIZE - fR, top);
                    ctx.arc(x + CRAFT_CELL_SIZE - fR, y, fR, Math.PI / 2, 0, true);
                    ctx.closePath();
                    ctx.fill();
                }
                if (anyRight && narrowBottom > 0) {
                    ctx.beginPath();
                    ctx.moveTo(x + CRAFT_CELL_SIZE, bottom);
                    ctx.lineTo(x + CRAFT_CELL_SIZE - fR, bottom);
                    ctx.arc(x + CRAFT_CELL_SIZE - fR, y + CRAFT_CELL_SIZE, fR, -Math.PI / 2, 0, false);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    }

    // Steel bounding box
    if (craft.steelBBox) {
        const bx = craft.gridPad + craft.steelBBox.minC * CRAFT_CELL_SIZE;
        const by = craft.gridTop + craft.steelBBox.minR * CRAFT_CELL_SIZE;
        const bw = (craft.steelBBox.maxC - craft.steelBBox.minC + 1) * CRAFT_CELL_SIZE;
        const bh = (craft.steelBBox.maxR - craft.steelBBox.minR + 1) * CRAFT_CELL_SIZE;
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    }

    // Draw rays on grid for all active emitters
    if (craft.activeRays.length > 0) {
        ctx.lineWidth = 1 / craft.gridZoom; // keep line width consistent at all zoom levels
        ctx.strokeStyle = 'rgba(255, 255, 180, 0.22)';
        for (const seg of craft.activeRays) {
            const x1 = craft.gridPad + seg.c1 * CRAFT_CELL_SIZE;
            const y1 = craft.gridTop + seg.r1 * CRAFT_CELL_SIZE;
            const x2 = craft.gridPad + seg.c2 * CRAFT_CELL_SIZE;
            const y2 = craft.gridTop + seg.r2 * CRAFT_CELL_SIZE;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    // Draw edge mirrors on grid
    for (let r = 0; r < CRAFT_GRID_ROWS - 1; r++) {
        for (let c = 0; c < CRAFT_GRID_COLS; c++) {
            if (!craft.hEdges[r][c]) continue;
            const x = craft.gridPad + c * CRAFT_CELL_SIZE;
            const y = craft.gridTop + (r + 1) * CRAFT_CELL_SIZE;
            ctx.strokeStyle = 'rgba(224, 232, 240, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + CRAFT_CELL_SIZE, y);
            ctx.stroke();
        }
    }
    for (let r = 0; r < CRAFT_GRID_ROWS; r++) {
        for (let c = 0; c < CRAFT_GRID_COLS - 1; c++) {
            if (!craft.vEdges[r][c]) continue;
            const x = craft.gridPad + (c + 1) * CRAFT_CELL_SIZE;
            const y = craft.gridTop + r * CRAFT_CELL_SIZE;
            ctx.strokeStyle = 'rgba(224, 232, 240, 0.9)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + CRAFT_CELL_SIZE);
            ctx.stroke();
        }
    }

    // Hover highlight for edge placement
    if (craft.hoveredEdge) {
        const e = craft.hoveredEdge;
        ctx.strokeStyle = 'rgba(224, 232, 240, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (e.type === 'h') {
            const x = craft.gridPad + e.c * CRAFT_CELL_SIZE;
            const y = craft.gridTop + (e.r + 1) * CRAFT_CELL_SIZE;
            ctx.moveTo(x, y);
            ctx.lineTo(x + CRAFT_CELL_SIZE, y);
        } else {
            const x = craft.gridPad + (e.c + 1) * CRAFT_CELL_SIZE;
            const y = craft.gridTop + e.r * CRAFT_CELL_SIZE;
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + CRAFT_CELL_SIZE);
        }
        ctx.stroke();
    }

    // Hover highlight
    if (craft.hoveredCell) {
        const hx = craft.gridPad + craft.hoveredCell.c * CRAFT_CELL_SIZE;
        const hy = craft.gridTop + craft.hoveredCell.r * CRAFT_CELL_SIZE;
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx + 1, hy + 1, CRAFT_CELL_SIZE - 2, CRAFT_CELL_SIZE - 2);

        if (craft.selectedMaterial && !craft.grid[craft.hoveredCell.r][craft.hoveredCell.c]) {
            const m = craftGetMaterial(craft.selectedMaterial);
            if (m) {
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = m.color;
                ctx.fillRect(hx + 1, hy + 1, CRAFT_CELL_SIZE - 2, CRAFT_CELL_SIZE - 2);
                ctx.globalAlpha = 1.0;
            }
        }
    }

    ctx.restore(); // end grid zoom/pan transform

    // --- Material palette (left side) ---
    const available = craftGetAvailableMaterials();

    for (let i = 0; i < available.length; i++) {
        const mat = available[i];
        const py = craft.paletteTop + i * CRAFT_PALETTE_ITEM_H;
        const isSelected = craft.selectedMaterial === mat.id;
        const isHovered = craft.hoveredPalette === i;

        if (isSelected) {
            ctx.fillStyle = 'rgba(100, 210, 255, 0.12)';
            ctx.fillRect(craft.paletteX, py, CRAFT_PALETTE_ITEM_W, CRAFT_PALETTE_ITEM_H - 2);
        } else if (isHovered) {
            ctx.fillStyle = 'rgba(100, 210, 255, 0.06)';
            ctx.fillRect(craft.paletteX, py, CRAFT_PALETTE_ITEM_W, CRAFT_PALETTE_ITEM_H - 2);
        }

        // Color swatch
        if (mat.id === 'emitter') {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = mat.color;
            ctx.fillRect(craft.paletteX + 10, py + 6, 22, 22);
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(craft.paletteX + 21, py + 17, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ddaa00';
            ctx.fill();
        } else if (mat.id === 'lens') {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = mat.color;
            ctx.fillRect(craft.paletteX + 10, py + 6, 22, 22);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.ellipse(craft.paletteX + 21, py + 17, 4, 8, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(136, 204, 238, 0.6)';
            ctx.fill();
            ctx.globalAlpha = 1.0;
        } else if (mat.id === 'diag') {
            // Diagonal line swatch ( / shape)
            ctx.strokeStyle = 'rgba(224, 232, 240, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(craft.paletteX + 10, py + 28);
            ctx.lineTo(craft.paletteX + 32, py + 6);
            ctx.stroke();
        } else {
            ctx.fillStyle = mat.color;
            ctx.fillRect(craft.paletteX + 10, py + 6, 22, 22);
        }
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(craft.paletteX + 10.5, py + 6.5, 21, 21);

        if (isSelected) {
            ctx.strokeStyle = 'rgba(100, 210, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(craft.paletteX + 9, py + 5, 24, 24);
        }

        // Name
        ctx.font = '14px Jura, sans-serif';
        ctx.fillStyle = isSelected ? 'rgba(100, 210, 255, 0.95)' : 'rgba(200, 220, 240, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(mat.name, craft.paletteX + 40, py + 22);
    }

    // --- Weapon preview (right panel) ---
    if (craft.weaponResult) {
        craftDrawWeaponPreview(craft.weaponResult);
    }

    // --- Dev stats (right of preview) ---
    craft.exportBtnRect = null;
    craft.saveBtnRect = null;
    if (craft.weaponResult) {
        const sx = craft.statsX;
        let sy = craft.statsTop;

        ctx.font = '13px Jura, sans-serif';
        ctx.textAlign = 'left';

        ctx.fillStyle = 'rgba(200, 220, 240, 0.5)';
        ctx.fillText('--- DEV STATS ---', sx, sy);

        ctx.fillStyle = 'rgba(200, 220, 240, 0.7)';
        ctx.fillText(`Name: ${craft.weaponResult.name}`, sx, sy + 22);

        let statsEndY;
        if (craft.weaponResult.type === 'lightsource') {
            ctx.fillText('Type: Throwable', sx, sy + 44);
            ctx.fillText('180° light hemisphere', sx, sy + 62);
            statsEndY = sy + 80;
        } else {
            ctx.fillText(`Steel blocks: ${craft.weaponResult.steelCount}`, sx, sy + 44);
            ctx.fillText(`Club length: ${craft.weaponResult.clubLength}`, sx, sy + 62);
            ctx.fillText(`Handle length: ${craft.weaponResult.handleLength}`, sx, sy + 80);
            ctx.fillText(`Weight: ${craft.weaponResult.weight}`, sx, sy + 98);
            ctx.fillText(`Swing weight: ${craft.weaponResult.swingWeight}`, sx, sy + 116);
            ctx.fillText(`Damage: ${craft.weaponResult.damage}`, sx, sy + 138);
            ctx.fillText(`Knockback: ${craft.weaponResult.knockback}`, sx, sy + 156);
            const effectiveSwing = Math.max(MELEE_MIN_SWING_DURATION, craft.weaponResult.speed * MELEE_SWING_SPEED_MULT);
            ctx.fillText(`Swing: ${Math.round(effectiveSwing * 100) / 100}s`, sx, sy + 174);
            ctx.fillText(`Range: ${craft.weaponResult.range}`, sx, sy + 192);
            ctx.fillText(`Collider: ${craft.weaponResult.colliderWidth} x ${craft.weaponResult.colliderHeight} +${craft.weaponResult.colliderOffset}`, sx, sy + 210);

            if (!craft.weaponResult.hasHandle) {
                ctx.font = '12px Jura, sans-serif';
                ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
                ctx.fillText('Add composite at end', sx, sy + 236);
                ctx.fillText('for +25% dmg, -25% swing time', sx, sy + 252);
            }
            statsEndY = sy + (craft.weaponResult.hasHandle ? 218 : 258);
        }

        // Export button
        const btnW = 100, btnH = 28;
        const btnX = sx;
        const btnY = statsEndY;
        craft.exportBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

        const exportHover = craftHitButton(craft.exportBtnRect, mouse.x, mouse.y);
        ctx.fillStyle = exportHover ? 'rgba(100, 210, 255, 0.25)' : 'rgba(100, 210, 255, 0.1)';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = 'rgba(100, 210, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
        ctx.font = '13px Jura, sans-serif';
        ctx.fillStyle = 'rgba(100, 210, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('Export', btnX + btnW / 2, btnY + 19);
        ctx.textAlign = 'left';

        // Game-scale preview (shown after Export)
        if (craft.exportedSprite && craft.exportedWeapon) {
            const spY = btnY + btnH + 20;

            ctx.font = '13px Jura, sans-serif';
            ctx.fillStyle = 'rgba(200, 220, 240, 0.5)';
            ctx.fillText('--- GAME SCALE ---', sx, spY);

            const spriteScale = (CRAFT_TILES_PER_CELL * CRAFT_GAME_TILE) / CRAFT_CELL_SIZE;
            const gameH = craft.exportedSprite.height * spriteScale;
            const gameW = craft.exportedSprite.width * spriteScale;

            const maxGameH = Math.max(CRAFT_PLAYER_H, gameH);
            const previewMaxH = 180;
            const displayScale = Math.min(previewMaxH / maxGameH, 8);

            // Player: green rect with eye, bottom-aligned
            const pw = Math.round(CRAFT_PLAYER_W * displayScale);
            const ph = Math.round(CRAFT_PLAYER_H * displayScale);
            const baseY = spY + 20 + Math.round(maxGameH * displayScale);
            const playerX = sx;
            const playerY = baseY - ph;

            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(playerX, playerY, pw, ph);

            // Eye
            const eyeR = Math.max(1, Math.round(2 * displayScale));
            const eyeX = playerX + Math.round(pw * 0.65);
            const eyeY = playerY + Math.round(ph * 0.18);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(eyeX + Math.round(eyeR * 0.3), eyeY, Math.max(1, Math.round(eyeR * 0.5)), 0, Math.PI * 2);
            ctx.fill();

            // Weapon sprite at game scale
            const sw = Math.round(gameW * displayScale);
            const sh = Math.round(gameH * displayScale);
            const weapX = playerX + pw + Math.round(10 * displayScale);
            const weapY = baseY - sh;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(craft.exportedSprite, weapX, weapY, sw, sh);
            ctx.imageSmoothingEnabled = true;

            // Labels
            ctx.font = '11px Jura, sans-serif';
            ctx.fillStyle = 'rgba(200, 220, 240, 0.4)';
            ctx.textAlign = 'left';
            ctx.fillText('Player', playerX, baseY + 14);
            ctx.fillText('Weapon', weapX, baseY + 14);

            // Save button
            const saveBtnY = baseY + 28;
            craft.saveBtnRect = { x: sx, y: saveBtnY, w: btnW, h: btnH };
            const saveHover = craftHitButton(craft.saveBtnRect, mouse.x, mouse.y);
            ctx.fillStyle = saveHover ? 'rgba(80, 255, 120, 0.25)' : 'rgba(80, 255, 120, 0.1)';
            ctx.fillRect(sx, saveBtnY, btnW, btnH);
            ctx.strokeStyle = 'rgba(80, 255, 120, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx + 0.5, saveBtnY + 0.5, btnW - 1, btnH - 1);
            ctx.font = '13px Jura, sans-serif';
            ctx.fillStyle = 'rgba(80, 255, 120, 0.9)';
            ctx.textAlign = 'center';
            ctx.fillText('Save', sx + btnW / 2, saveBtnY + 19);
            ctx.textAlign = 'left';
        } else {
            craft.saveBtnRect = null;
        }
    }

    // --- Close hint ---
    ctx.font = '13px Jura, sans-serif';
    ctx.fillStyle = 'rgba(200, 220, 240, 0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC or E to close', canvas.width / 2, canvas.height - 20);
    ctx.textAlign = 'left';
}

// ============================================================
// INPUT HANDLERS (called from input.js)
// ============================================================

// Convert screen mouse coords to grid-local coords (accounting for zoom/pan).
// Returns coords as if the grid were at zoom=1, so craftGetGridCell etc. work.
function craftScreenToGrid(mx, my) {
    const gx = (mx - craft.gridPad - craft.gridPanX) / craft.gridZoom + craft.gridPad;
    const gy = (my - craft.gridTop - craft.gridPanY) / craft.gridZoom + craft.gridTop;
    return { x: gx, y: gy };
}

function craftMouseMove(mx, my) {
    craftRecalcLayout();
    // Middle-mouse panning
    if (craft.gridPanning) {
        craft.gridPanX = craft.gridPanOrigX + (mx - craft.gridPanStartX);
        craft.gridPanY = craft.gridPanOrigY + (my - craft.gridPanStartY);
        return;
    }
    const g = craftScreenToGrid(mx, my);
    craftUpdateHover(g.x, g.y);
    if (craft.mouseDown) craftHandlePaint(g.x, g.y);
    if (craft.mouseRightDown) craftHandleErase(g.x, g.y);
}

function craftMouseDown(button, mx, my) {
    craftRecalcLayout();
    if (button === 0) {
        // Check Export button (screen coords, not grid coords)
        if (craftHitButton(craft.exportBtnRect, mx, my) && craft.weaponResult) {
            craft.exportedSprite = craftGenerateExportSprite(craft.weaponResult);
            craft.exportedWeapon = { ...craft.weaponResult };
            return;
        }
        // Check Save button
        if (craftHitButton(craft.saveBtnRect, mx, my) && craft.exportedSprite && craft.exportedWeapon) {
            craftSaveWeapon();
            return;
        }
        // Palette click uses screen coords
        if (craftHandlePaletteClick(mx, my)) {
            craft.mouseDown = true;
            return;
        }
        craft.mouseDown = true;
        const g = craftScreenToGrid(mx, my);
        craftHandlePaint(g.x, g.y);
    } else if (button === 1) {
        // Middle mouse — start panning
        craft.gridPanning = true;
        craft.gridPanStartX = mx;
        craft.gridPanStartY = my;
        craft.gridPanOrigX = craft.gridPanX;
        craft.gridPanOrigY = craft.gridPanY;
    } else if (button === 2) {
        craft.mouseRightDown = true;
        const g = craftScreenToGrid(mx, my);
        craftHandleErase(g.x, g.y);
    }
}

function craftMouseUp(button) {
    if (button === 0) craft.mouseDown = false;
    if (button === 1) craft.gridPanning = false;
    if (button === 2) craft.mouseRightDown = false;
}

function craftWheel(deltaY, mx, my) {
    const zoomFactor = deltaY < 0 ? 1.15 : 1 / 1.15;
    const oldZoom = craft.gridZoom;
    craft.gridZoom = Math.max(1, Math.min(5, craft.gridZoom * zoomFactor));

    // Zoom centered on cursor: keep the grid point under the mouse fixed.
    // Screen-to-grid: gx = (mx - gridPad - panX) / zoom + gridPad
    // Grid-to-screen: sx = (gx - gridPad) * zoom + gridPad + panX
    // Solve for new panX so that sx stays at mx after zoom change:
    //   panX_new = mx - gridPad - (gx - gridPad) * newZoom
    const gx = (mx - craft.gridPad - craft.gridPanX) / oldZoom + craft.gridPad;
    const gy = (my - craft.gridTop - craft.gridPanY) / oldZoom + craft.gridTop;
    craft.gridPanX = mx - craft.gridPad - (gx - craft.gridPad) * craft.gridZoom;
    craft.gridPanY = my - craft.gridTop - (gy - craft.gridTop) * craft.gridZoom;
}

function craftKeyDown(code) {
    // ESC or E closes crafting interface
    if (code === 'Escape' || code === 'KeyE') {
        gameState.craftingOpen = false;
        craft.mouseDown = false;
        craft.mouseRightDown = false;
        return;
    }
    if (code === 'KeyC') {
        craftClearGrid();
    }
    // Reset zoom
    if (code === 'Home') {
        craft.gridZoom = 1;
        craft.gridPanX = 0;
        craft.gridPanY = 0;
    }
}
