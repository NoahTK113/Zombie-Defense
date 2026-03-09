// ============================================================
// ZOMBIE DEFENSE - Rock Texture Generator
// Procedural earth tile textures at TILE_TEXELS resolution.
// Bias-driven seed growth + midpoint displacement cracks + noise.
// ============================================================

function generateRockTiles(count) {
    const T = TILE_TEXELS;
    const tiles = [];

    // Crack parameters
    const lrPos = 23;
    const tbPos = 8;
    const roughness = 1.04;
    const depth = 7;
    const centerBias = 0;
    const decay = 0.8;

    // Blob parameters
    const seedCount = 12;
    const growthBias = 1.0;
    const dirBias = 0.6;
    const touchLimit = 1;
    const bgColor = 40;
    const seedBase = 111;
    const seedSpread = 66;

    const CENTER = T / 2;

    function getPoints() {
        return [
            { x: 0, y: lrPos, edge: 'left' },
            { x: T, y: lrPos, edge: 'right' },
            { x: tbPos, y: 0, edge: 'top' },
            { x: tbPos, y: T, edge: 'bottom' }
        ];
    }

    function midpointDisplace(ax, ay, bx, by, r, d) {
        if (d === 0) return [{ x: ax, y: ay }, { x: bx, y: by }];

        let mx = (ax + bx) / 2;
        let my = (ay + by) / 2;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;

        const offset = (Math.random() - 0.5) * len * r;
        mx += nx * offset;
        my += ny * offset;

        if (centerBias > 0) {
            const toCenterX = CENTER - mx;
            const toCenterY = CENTER - my;
            const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
            if (dist > 0) {
                const shift = Math.min(centerBias * T, dist);
                mx += (toCenterX / dist) * shift;
                my += (toCenterY / dist) * shift;
            }
        }

        mx = Math.max(0, Math.min(T, mx));
        my = Math.max(0, Math.min(T, my));

        const left = midpointDisplace(ax, ay, mx, my, r * decay, d - 1);
        const right = midpointDisplace(mx, my, bx, by, r * decay, d - 1);
        return left.concat(right.slice(1));
    }

    function generateCracks() {
        const maxCracks = 0; // cracks disabled for now

        const pts = getPoints();
        const available = [...pts];
        const cracks = [];

        for (let c = 0; c < maxCracks; c++) {
            if (available.length < 2) break;

            const idxA = Math.floor(Math.random() * available.length);
            const ptA = available.splice(idxA, 1)[0];
            const adjacent = {
                left: ['top', 'bottom'],
                right: ['top', 'bottom'],
                top: ['left', 'right'],
                bottom: ['left', 'right']
            };
            const candidates = available.filter(p => adjacent[ptA.edge].includes(p.edge));
            if (candidates.length === 0) {
                available.push(ptA);
                break;
            }
            candidates.sort((a, b) => {
                const distA = Math.hypot(a.x - ptA.x, a.y - ptA.y);
                const distB = Math.hypot(b.x - ptA.x, b.y - ptA.y);
                return distA - distB;
            });
            const ptB = candidates[0];
            available.splice(available.indexOf(ptB), 1);

            cracks.push(midpointDisplace(ptA.x, ptA.y, ptB.x, ptB.y, roughness, depth));
        }
        return cracks;
    }

    // Generate shared seed positions along 4 vertical lines
    const sharedSeedPositions = [];
    const lines = [
        { x: 0, blockedDx: -1 },
        { x: Math.round(T / 3), blockedDx: null },
        { x: Math.round(2 * T / 3), blockedDx: null },
        { x: T - 1, blockedDx: 1 }
    ];
    const perLine = Math.ceil(seedCount / lines.length);
    for (const line of lines) {
        for (let i = 0; i < perLine && sharedSeedPositions.length < seedCount; i++) {
            sharedSeedPositions.push({ x: line.x, y: Math.floor(Math.random() * T), blockedDx: line.blockedDx });
        }
    }

    function generateBlobMap() {
        const map = new Int16Array(T * T).fill(-1);

        // Normal distribution centered on seed base, clamped to ±spread
        function normalColor() {
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            const offset = Math.round(z * seedSpread / 2);
            return Math.max(0, Math.min(255, seedBase + Math.max(-seedSpread, Math.min(seedSpread, offset))));
        }

        const seeds = [];
        for (let i = 0; i < sharedSeedPositions.length; i++) {
            const pos = sharedSeedPositions[i];
            if (map[pos.y * T + pos.x] !== -1) continue;
            const color = normalColor();
            seeds.push({ color, active: [{ x: pos.x, y: pos.y }], stopped: false, lastPlaced: { x: pos.x, y: pos.y }, blockedDx: pos.blockedDx, touches: 0 });
            map[pos.y * T + pos.x] = seeds.length - 1;
        }

        // Round-robin flood expansion
        const allDirs = [[-1,0],[1,0],[0,-1],[0,1]];
        let anyActive = true;
        while (anyActive) {
            anyActive = false;
            for (let si = 0; si < seeds.length; si++) {
                const seed = seeds[si];
                if (seed.stopped || seed.active.length === 0) continue;
                anyActive = true;
                const newFrontier = [];
                const seedDirs = seed.blockedDx !== null ? allDirs.filter(([dx]) => dx !== seed.blockedDx) : allDirs;
                for (const cell of seed.active) {
                    const isLast = (cell.x === seed.lastPlaced.x && cell.y === seed.lastPlaced.y);
                    if (!isLast && Math.random() < growthBias) {
                        newFrontier.push(cell);
                        continue;
                    }

                    const useDirs = Math.random() < dirBias ? seedDirs.filter(([,dy]) => dy === 0) : seedDirs;
                    const shuffled = useDirs.slice().sort(() => Math.random() - 0.5);
                    let placed = false;
                    let hasOpenNeighbor = false;
                    for (const [dx, dy] of shuffled) {
                        const nx = cell.x + dx;
                        const ny = cell.y + dy;
                        if (nx < 0 || nx >= T || ny < 0 || ny >= T) {
                            seed.stopped = true;
                            break;
                        }
                        const ni = ny * T + nx;
                        if (map[ni] === -1) {
                            if (!placed) {
                                map[ni] = si;
                                newFrontier.push({ x: nx, y: ny });
                                seed.lastPlaced = { x: nx, y: ny };
                                placed = true;
                            }
                            hasOpenNeighbor = true;
                        } else if (map[ni] !== si) {
                            seed.touches++;
                            const other = seeds[map[ni]];
                            other.touches++;
                            if (seed.touches >= touchLimit) {
                                seed.stopped = true;
                            }
                            if (other.touches >= touchLimit) {
                                other.stopped = true;
                                other.active = [];
                            }
                            if (seed.stopped) break;
                        }
                    }
                    if (seed.stopped) break;
                    if (hasOpenNeighbor) newFrontier.push(cell);
                }
                if (!seed.stopped) {
                    seed.active = newFrontier;
                    if (newFrontier.length > 0) {
                        const lastStillThere = newFrontier.some(c => c.x === seed.lastPlaced.x && c.y === seed.lastPlaced.y);
                        if (!lastStillThere) {
                            seed.lastPlaced = newFrontier[Math.floor(Math.random() * newFrontier.length)];
                        }
                    }
                }
                else seed.active = [];
            }
        }

        const colors = new Uint8Array(T * T);
        for (let i = 0; i < map.length; i++) {
            colors[i] = map[i] >= 0 ? seeds[map[i]].color : bgColor;
        }
        return colors;
    }

    function renderTile(cracks, blobMap) {
        const c = document.createElement('canvas');
        c.width = T;
        c.height = T;
        const ctx = c.getContext('2d');

        // Layer 1+2: blob map + fine noise
        const imgData = ctx.createImageData(T, T);
        const d = imgData.data;
        for (let py = 0; py < T; py++) {
            for (let px = 0; px < T; px++) {
                const idx = (py * T + px) * 4;
                const base = blobMap[py * T + px];
                const noise = -5 + Math.floor(Math.random() * 10);
                const v = Math.max(0, Math.min(255, base + noise));
                d[idx] = v;
                d[idx + 1] = v;
                d[idx + 2] = v;
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Layer 3: crack lines
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const crack of cracks) {
            if (!crack) continue;

            // Black crack lines
            const blackLayers = [
                { width: 2, alpha: 0.3 },
                { width: 1, alpha: 0.5 },
                { width: 0.5, alpha: 0.9 }
            ];
            for (const layer of blackLayers) {
                ctx.strokeStyle = `rgba(0, 0, 0, ${layer.alpha})`;
                ctx.lineWidth = layer.width;
                ctx.beginPath();
                ctx.moveTo(crack[0].x, crack[0].y);
                for (let i = 1; i < crack.length; i++) {
                    ctx.lineTo(crack[i].x, crack[i].y);
                }
                ctx.stroke();
            }
        }

        return c;
    }

    // Generate all tiles (shared seed positions across batch)
    for (let i = 0; i < count; i++) {
        const cracks = generateCracks();
        const blobMap = generateBlobMap();
        tiles.push(renderTile(cracks, blobMap));
    }

    return tiles;
}
