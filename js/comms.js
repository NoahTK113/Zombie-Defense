// ============================================================
// ZOMBIE DEFENSE - Comms Terminal System
// ============================================================

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
            gameState.commsOpen = false;
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
    if (!gameState.commsOpen) return;
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
    // C toggles comms open/close
    if (code === 'KeyC') {
        if (gameState.commsOpen) {
            if (!comms.inputLocked) {
                gameState.commsOpen = false;
            }
        } else if (!intro.active && !gameState.gameOver) {
            gameState.commsOpen = true;
            if (gameState.tutorialStep === 'comms') gameState.tutorialStep = 'done';
            if (!gameState.commsRelayDone) { commsStartRelaySequence(); }
        }
        return;
    }
    // Internal comms input (choices navigation)
    if (!gameState.commsOpen || comms.inputLocked) return;
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
