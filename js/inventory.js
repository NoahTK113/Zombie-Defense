// ============================================================
// ZOMBIE DEFENSE - Inventory (Weapons)
// ============================================================

// --- Weapon Inventory ---
const weapons = [];
let activeWeaponIndex = 0;

const SHOVEL_WEAPON = {
    name: 'Emergency Shovel',
    damage: SHOVEL_DAMAGE,
    blockDamage: SHOVEL_BLOCK_DAMAGE,
    speed: SHOVEL_SWING_DURATION,
    range: SHOVEL_RANGE,
    swingWeight: SHOVEL_SWING_WEIGHT,
    knockback: MELEE_KNOCKBACK_COEFF * Math.sqrt(SHOVEL_SWING_WEIGHT) * SHOVEL_RANGE,
    sprite: null,       // null = use built-in shovel drawing
    visualHeight: 1.35, // tiles
    colliderWidth: 0.3, // tiles (shovel blade width)
    colliderHeight: 0.4, // tiles (shovel blade height)
    colliderOffset: 0.95, // tiles (handle length before blade)
};

function getActiveWeapon() {
    return weapons[activeWeaponIndex] || SHOVEL_WEAPON;
}

function loadWeaponsFromStorage() {
    const prevActive = weapons[activeWeaponIndex];
    const prevName = prevActive ? prevActive.name : null;
    weapons.length = 0;
    weapons.push(SHOVEL_WEAPON);
    const saved = JSON.parse(localStorage.getItem('zd_weapons') || '[]');
    for (const data of saved) {
        const img = new Image();
        img.src = data.sprite;
        const sw = data.swingWeight || SHOVEL_SWING_WEIGHT;
        weapons.push({
            name: data.name,
            damage: data.damage,
            blockDamage: data.damage,
            speed: data.speed,
            range: data.range,
            swingWeight: sw,
            knockback: data.knockback || MELEE_KNOCKBACK_COEFF * Math.sqrt(sw) * data.range,
            sprite: img,
            visualHeight: data.visualHeight || 1.35,
            colliderWidth: data.colliderWidth || 0,
            colliderHeight: data.colliderHeight || 0,
            colliderOffset: data.colliderOffset || 0,
        });
    }
    // Preserve active weapon selection after reload
    if (prevName) {
        const idx = weapons.findIndex(w => w.name === prevName);
        activeWeaponIndex = idx >= 0 ? idx : 0;
    }
    weaponStorageCount = saved.length;
}

// Hot-reload: check localStorage for new weapons every 3 seconds
let weaponStorageCount = 0;
let weaponCheckTimer = 0;
const WEAPON_CHECK_INTERVAL = 3.0;

function checkForNewWeapons(dt) {
    weaponCheckTimer += dt;
    if (weaponCheckTimer < WEAPON_CHECK_INTERVAL) return;
    weaponCheckTimer = 0;
    const saved = JSON.parse(localStorage.getItem('zd_weapons') || '[]');
    if (saved.length !== weaponStorageCount) {
        loadWeaponsFromStorage();
    }
}
