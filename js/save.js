// ============================================================
// ZOMBIE DEFENSE - Save/Load
// ============================================================

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
