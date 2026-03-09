// ============================================================
// ZOMBIE DEFENSE - Intro Sequence
// ============================================================

// --- Intro Sequence State ---
// Phases: 'fadein' → 'lying' → 'blink' → 'standup_prompt' → 'standing' → 'done'
const intro = {
    active: true,
    phase: 'fadein',
    timer: 0,
    fadeOpacity: 1.0,           // starts at full black, fades to 0
    fadeDuration: 2.0,          // seconds to fade in
    lyingDuration: 1.0,         // seconds lying still after fade
    blinkCount: 0,              // blinks completed
    blinkTarget: 3,             // total blinks
    blinkTimer: 0,
    blinkOpen: false,           // eye state during blink phase
    standTimer: 0,              // animation timer for standing up
    standDuration: 0.6,         // seconds the stand-up takes
};

// --- Intro Sequence Update ---
function updateIntro(dt) {
    if (!intro.active) return;

    switch (intro.phase) {
        case 'fadein':
            intro.fadeOpacity -= dt / intro.fadeDuration;
            if (intro.fadeOpacity <= 0) {
                intro.fadeOpacity = 0;
                intro.phase = 'lying';
                intro.timer = 0;
            }
            break;

        case 'lying':
            // Brief pause lying still before eyes open
            intro.timer += dt;
            if (intro.timer >= intro.lyingDuration) {
                intro.phase = 'blink';
                intro.blinkTimer = 0;
                intro.blinkOpen = false;
                intro.blinkCount = 0;
            }
            break;

        case 'blink':
            // Eyes blink open/closed a few times
            intro.blinkTimer += dt;
            const blinkCycleDuration = 0.4; // total time for one open-close cycle
            if (intro.blinkTimer >= blinkCycleDuration) {
                intro.blinkTimer -= blinkCycleDuration;
                if (intro.blinkOpen) {
                    // Was open, close it
                    intro.blinkOpen = false;
                    intro.blinkCount++;
                    if (intro.blinkCount >= intro.blinkTarget) {
                        // Done blinking — eyes stay open, show standup prompt
                        intro.blinkOpen = true;
                        intro.phase = 'standup_prompt';
                    }
                } else {
                    // Was closed, open it
                    intro.blinkOpen = true;
                }
            }
            break;

        case 'standup_prompt':
            // Waiting for player to press E
            break;

        case 'standing':
            // Stand-up animation playing
            intro.standTimer += dt;
            if (intro.standTimer >= intro.standDuration) {
                intro.phase = 'done';
                intro.active = false;
                gameState.tutorialStep = 'flashlight';
            }
            break;
    }
}

// --- Intro Input Handler (called by input.js router) ---
function introHandleKey(code) {
    if (code === 'KeyE' && intro.phase === 'standup_prompt') {
        intro.phase = 'standing';
        intro.standTimer = 0;
    }
    // Debug: press F1 to skip intro entirely
    if (code === 'F1') {
        intro.active = false;
        intro.phase = 'done';
        gameState.commsOpen = false;
        intro.fadeOpacity = 0;
        gameState.tutorialStep = 'flashlight';
    }
}
