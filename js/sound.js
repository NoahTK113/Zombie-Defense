// ============================================================
// ZOMBIE DEFENSE - Sound System
// ============================================================
// Hybrid audio: <audio> elements for playSound (works with file://),
// Web Audio API AudioBuffers for playSoundStretched (proper pitch shift).
// Gracefully handles missing files — no errors, just silence.

const soundElements = {};  // name → Audio element (null if failed to load)
const soundBuffers = {};   // name → AudioBuffer (null if fetch failed)
let audioCtx = null;
let soundsReady = false;

// Sound definitions: name → { file, volume, pitchRange }
const SOUND_DEFS = {
    pistolShot:     { file: 'pistol_shot.wav',     volume: 0.4, pitchRange: [0.95, 1.05] },
    meleeSwing:     { file: 'melee_swing.wav',      volume: 0.5, pitchRange: [0.9, 1.1] },
    meleeHit:       { file: 'melee_hit.wav',        volume: 0.6, pitchRange: [0.85, 1.15] },
    bulletHit:      { file: 'bullet_hit.wav',       volume: 0.3, pitchRange: [0.9, 1.1] },
    zombieDeath:    { file: 'zombie_death.wav',     volume: 0.5, pitchRange: [0.8, 1.2] },
    blockBreak:     { file: 'block_break.wav',      volume: 0.5, pitchRange: [0.85, 1.15] },
    blockPlace:     { file: 'block_place.wav',      volume: 0.4, pitchRange: [0.9, 1.1] },
    blockDig:       { file: 'block_dig.wav',        volume: 0.4, pitchRange: [0.9, 1.1] },
    flashlightOn:   { file: 'flashlight_on.wav',    volume: 0.3, pitchRange: [1.0, 1.0] },
    flashlightOff:  { file: 'flashlight_off.wav',   volume: 0.3, pitchRange: [1.0, 1.0] },
    waveStart:      { file: 'wave_start.wav',       volume: 0.6, pitchRange: [1.0, 1.0] },
    waveComplete:   { file: 'wave_complete.wav',    volume: 0.6, pitchRange: [1.0, 1.0] },
    playerDeath:    { file: 'player_death.wav',     volume: 0.7, pitchRange: [1.0, 1.0] },
    playerHit:      { file: 'player_hit.wav',       volume: 0.5, pitchRange: [0.9, 1.1] },
    playerRespawn:  { file: 'player_respawn.wav',   volume: 0.5, pitchRange: [1.0, 1.0] },
    dashStrikeHit:  { file: 'dash_strike_hit.wav', volume: 0.7, pitchRange: [0.9, 1.1] },
};

function initAudio() {
    if (soundsReady) return;
    soundsReady = true;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    for (const [name, def] of Object.entries(SOUND_DEFS)) {
        const path = 'sounds/' + def.file;

        // Load <audio> element (works with file://)
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.addEventListener('error', () => { soundElements[name] = null; });
        audio.addEventListener('canplaythrough', () => {
            if (!soundElements[name]) soundElements[name] = audio;
        }, { once: true });
        soundElements[name] = audio;

        // Also try to load AudioBuffer via fetch (for pitch-shifted playback)
        fetch(path)
            .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(decoded => { soundBuffers[name] = decoded; })
            .catch(() => { soundBuffers[name] = null; });
    }
}

// Play a sound by name (uses <audio> elements)
function playSound(name, volumeOverride, pitchOverride) {
    if (!soundsReady) return;
    const src = soundElements[name];
    if (!src) return;

    const def = SOUND_DEFS[name];
    if (!def) return;

    const audio = src.cloneNode();

    const vol = def.volume * (volumeOverride !== undefined ? volumeOverride : 1.0);
    audio.volume = Math.max(0, Math.min(1, vol));

    if (pitchOverride !== undefined) {
        audio.playbackRate = pitchOverride;
    } else {
        const [minP, maxP] = def.pitchRange;
        audio.playbackRate = minP + Math.random() * (maxP - minP);
    }

    audio.play().catch(() => {});
}

// Play a sound stretched to a target duration with real pitch shift.
// Uses Web Audio API AudioBufferSourceNode for proper waveform resampling.
// Falls back to <audio> playbackRate if AudioBuffer not available.
function playSoundStretched(name, targetDuration, volumeOverride) {
    if (!soundsReady) return null;

    const def = SOUND_DEFS[name];
    if (!def) return null;

    const buffer = soundBuffers[name];

    // Web Audio path: proper pitch shift via waveform resampling
    if (buffer && audioCtx) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        // playbackRate on AudioBufferSourceNode resamples the waveform:
        // faster = higher pitch + shorter, slower = lower pitch + longer
        const rate = buffer.duration / targetDuration;
        source.playbackRate.value = Math.max(0.25, Math.min(4.0, rate));

        const gain = audioCtx.createGain();
        const vol = def.volume * (volumeOverride !== undefined ? volumeOverride : 1.0);
        gain.gain.value = vol;

        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(0);
        return source;
    }

    // Fallback: <audio> playbackRate (preserves pitch, may have artifacts)
    const src = soundElements[name];
    if (!src) return null;

    const originalDuration = src.duration;
    if (!originalDuration || originalDuration === 0) return null;

    const audio = src.cloneNode();
    const vol = def.volume * (volumeOverride !== undefined ? volumeOverride : 1.0);
    audio.volume = Math.max(0, Math.min(1, vol));
    audio.playbackRate = Math.max(0.25, Math.min(4.0, originalDuration / targetDuration));
    audio.play().catch(() => {});
    return audio;
}

// --- Ambient Loop ---
// Plays ambient.wav on seamless loop at low volume.
// Starts on first user interaction alongside other sounds.
const AMBIENT_FILE = 'sounds/ambient.wav';
const AMBIENT_VOLUME = 0.15;
let ambientAudio = null;

function startAmbient() {
    if (ambientAudio) return;
    ambientAudio = new Audio(AMBIENT_FILE);
    ambientAudio.loop = true;
    ambientAudio.volume = AMBIENT_VOLUME;
    ambientAudio.play().catch(() => {});
}

// Init audio on first user interaction
function onFirstInteraction() {
    initAudio();
    startAmbient();
}
window.addEventListener('mousedown', onFirstInteraction, { once: true });
window.addEventListener('keydown', onFirstInteraction, { once: true });
