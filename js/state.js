// ============================================================
// ZOMBIE DEFENSE - Game State
// ============================================================
// Central source of truth for all global flags and values.
// All systems read/write through gameState rather than loose globals.
// Serializable via JSON.stringify for save/load.

const gameState = {
    // --- Mode Toggles ---
    gameMode: 'player',     // 'player' or 'build'
    paused: false,
    gameOver: false,
    commsOpen: false,       // true when comms tablet is visible
    craftingOpen: false,    // true when crafting interface is visible
    controlsOpen: false,    // true when controls tutorial overlay is visible
    flashlightOn: false,

    // --- Economy & Stats ---
    points: 500,
    zombiesKilled: 0,
    zombiesAbsorbed: 0,

    // --- Progression Flags ---
    hasUsedArtifact: false,     // KJ counter appears after first artifact interaction
    commsComplete: false,       // true after initial comms conversation finishes
    tutorialStep: 'none',      // 'none' | 'flashlight' | 'comms' | 'done'
    commsRelayDone: false,     // true after relay sequence has been shown
    commsConvoChoice1: -1,     // tracks choice 1 selection for conditional branching

    // --- Artifact Health ---
    artifactHP: ARTIFACT_MAX_HP,
    artifactCorrupted: false,   // true while artifact is disabled

    // --- Debug Flags ---
    debugSpawnDisabled: false,
    debugNoTargetPlayer: false,
    debugShowFlowField: false,
};

// Helper: replaces the old interfaceOpen loose global.
// Derives "any UI overlay is open" from the specific flags.
function isInterfaceOpen() {
    return gameState.commsOpen || gameState.craftingOpen || artifactUI.open;
}
