// ============================================================
// ZOMBIE DEFENSE - Physics (Shared collision utilities)
// ============================================================

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
