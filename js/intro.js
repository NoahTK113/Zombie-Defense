// ============================================================
// ZOMBIE DEFENSE - Intro Sequence & Comms Terminal
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

// --- Comms Terminal System ---
// Supports: text lines, choice prompts, timed sequences, status changes
const comms = {
    lines: [],                  // visible lines on screen: { text, color }
    choices: null,              // null or { options: ['Yes','No'], selected: 0 }
    status: '',                 // upper-right status text (e.g. 'Connected-CG Relay#1713')
    statusColor: '#55aa77',     // color for status indicator
    queue: [],                  // pending actions to process
    queueTimer: 0,              // delay timer for timed actions
    queueDelay: 0,              // current delay before next action
    inputLocked: false,         // true while a timed sequence is playing
    scrollOffset: 0,            // for scrolling if lines exceed screen
};

// Comms action types:
// { type: 'line', text, color?, delay? }     — print a line (delay = seconds before showing)
// { type: 'choice', options, onSelect }      — show choice prompt; onSelect(index) is called
// { type: 'status', text, color? }           — set the status indicator
// { type: 'clear' }                          — clear all lines
// { type: 'close' }                          — close the comms window
// { type: 'callback', fn }                   — call a function (for chaining sequences)

// Word wrap: split text into lines at word boundaries
function commsWrapText(text, maxChars) {
    if (!text || text.length <= maxChars) return [text || ''];
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        if (current.length + word.length + (current ? 1 : 0) > maxChars) {
            if (current) lines.push(current);
            current = word;
        } else {
            current += (current ? ' ' : '') + word;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

const COMMS_MAX_CHARS = 58; // chars per line (fits 480px at 13px monospace)

function commsAddLine(text, color) {
    const c = color || '#cccccc';
    const wrapped = commsWrapText(text || '', COMMS_MAX_CHARS);
    for (const line of wrapped) {
        comms.lines.push({ text: line, color: c });
    }
}

function commsShowChoice(options, onSelect) {
    comms.choices = { options, selected: 0, onSelect };
}

function commsQueueActions(actions) {
    comms.queue.push(...actions);
    if (!comms.inputLocked && comms.queue.length > 0) {
        commsProcessQueue();
    }
}

function commsProcessQueue() {
    while (comms.queue.length > 0) {
        const action = comms.queue[0];
        if (action.type === 'line') {
            if (action.delay && action.delay > 0 && comms.queueDelay === 0) {
                // Start delay, don't consume yet
                comms.queueDelay = action.delay;
                comms.queueTimer = 0;
                comms.inputLocked = true;
                return; // wait for updateComms to tick the timer
            }
            commsAddLine(action.text, action.color);
            comms.queueDelay = 0;
            comms.queue.shift();
        } else if (action.type === 'choice') {
            commsShowChoice(action.options, action.onSelect);
            comms.queue.shift();
            comms.inputLocked = false;
            return; // wait for player input
        } else if (action.type === 'status') {
            comms.status = action.text;
            if (action.color) comms.statusColor = action.color;
            comms.queue.shift();
        } else if (action.type === 'clear') {
            comms.lines = [];
            comms.queue.shift();
        } else if (action.type === 'close') {
            commsOpen = false;
            interfaceOpen = false;
            comms.queue.shift();
            comms.inputLocked = false;
            return;
        } else if (action.type === 'callback') {
            comms.queue.shift();
            comms.inputLocked = false;
            if (action.fn) action.fn();
            return; // callback may queue new actions, let it take over
        } else {
            comms.queue.shift(); // unknown, skip
        }
    }
    comms.inputLocked = false;
}

function updateComms(dt) {
    if (!commsOpen) return;
    if (comms.queueDelay > 0) {
        comms.queueTimer += dt;
        if (comms.queueTimer >= comms.queueDelay) {
            comms.queueDelay = 0;
            comms.queueTimer = 0;
            // Process the delayed action now
            if (comms.queue.length > 0) {
                const action = comms.queue.shift();
                if (action.type === 'line') commsAddLine(action.text, action.color);
                else if (action.type === 'status') {
                    comms.status = action.text;
                    if (action.color) comms.statusColor = action.color;
                }
            }
            commsProcessQueue(); // continue processing
        }
    }
}

function commsHandleInput(code) {
    if (comms.inputLocked) return;
    if (comms.choices) {
        if (code === 'KeyW' || code === 'ArrowUp') {
            comms.choices.selected = (comms.choices.selected - 1 + comms.choices.options.length) % comms.choices.options.length;
        } else if (code === 'KeyS' || code === 'ArrowDown') {
            comms.choices.selected = (comms.choices.selected + 1) % comms.choices.options.length;
        } else if (code === 'Enter') {
            const sel = comms.choices.selected;
            const cb = comms.choices.onSelect;
            comms.choices = null; // clear choice UI
            if (cb) cb(sel);
        }
    }
}

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
                tutorialStep = 'flashlight';
            }
            break;
    }
}
