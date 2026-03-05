// ============================================================
// ZOMBIE DEFENSE - Story / Dialogue Content
// ============================================================

// Flag to track if relay sequence has been shown
let commsRelayDone = false;

// Tracks choice 1 selection for conditional branching in later responses
let commsConvoChoice1 = -1;

// --- Initial comms sequence (relay connection) ---
function commsStartRelaySequence() {
    comms.lines = [];
    comms.status = '';
    commsAddLine('Connect to Relay?', '#aabbcc');
    commsAddLine('');
    commsShowChoice(['Yes', 'No'], (sel) => {
        if (sel === 1) {
            // No — close comms
            intro.commsOpen = false;
            if (intro.active && intro.phase === 'comms_open') {
                intro.phase = 'done';
                intro.active = false;
            }
        } else {
            // Yes — start connection sequence
            commsRelayDone = true; // prevent re-triggering
            // End intro — player is now in the game
            if (intro.active) {
                intro.phase = 'done';
                intro.active = false;
            }
            commsAddLine('');
            commsQueueActions([
                { type: 'line', text: '> Scanning for nearest relay node...', color: '#77aacc', delay: 0.8 },
                { type: 'line', text: '  Relay #1713-CG identified', color: '#77aacc', delay: 1.2 },
                { type: 'line', text: '  Frequency lock: 4.7291 THz', color: '#77aacc', delay: 0.6 },
                { type: 'line', text: '> Establishing uplink...', color: '#77aacc', delay: 1.0 },
                { type: 'line', text: '  Handshake verified', color: '#77aacc', delay: 0.8 },
                { type: 'line', text: '  Encryption layer: ACTIVE', color: '#77aacc', delay: 0.4 },
                { type: 'line', text: '> Connection established.', color: '#88ddaa', delay: 1.0 },
                { type: 'status', text: 'Connected \u2014 CG Relay #1713', color: '#55aa77' },
                { type: 'line', text: '', delay: 0.5 },
                { type: 'line', text: 'Awaiting transmission...', color: '#888888', delay: 0.3 },
                { type: 'callback', fn: commsStartConversation },
            ]);
        }
    });
}

// --- Comms Conversation: Opening Dialogue ---
function commsStartConversation() {
    // Queued messages that were waiting for our connection
    commsQueueActions([
        { type: 'line', text: '', delay: 2.0 },
        { type: 'line', text: '\u2014\u2014 4 queued messages \u2014\u2014', color: '#556677' },
        { type: 'line', text: '' },
        { type: 'line', text: 'Hey new guy, ping me when you touch down.', color: '#cccccc', delay: 0.5 },
        { type: 'line', text: '', delay: 1.8 },
        { type: 'line', text: 'We see your transponder but haven\'t heard anything... Tensions are high enough as is, what\'s your status?', color: '#cccccc', delay: 0.5 },
        { type: 'line', text: '', delay: 1.8 },
        { type: 'line', text: 'OK... I promise not to pester you after this, just gimme a status. You know EV is going to have a fit if I don\'t tell her something soon.', color: '#cccccc', delay: 0.5 },
        { type: 'line', text: '', delay: 2.0 },
        { type: 'line', text: 'Seriously, now I\'m starting to worry. Telemetry looks like there\'s interference. PLEASE RESPOND.', color: '#cccccc', delay: 0.5 },
        { type: 'line', text: '', delay: 1.0 },
        // Player choice 1
        { type: 'choice', options: [
            'Hey, I\'m not that new anymore.',
            'Wow that was... unpleasant.',
            'I\'m here. Did I ever tell you guys you worry too much?',
            'Hey sorry, I\'ve been a little out of it.',
        ], onSelect: onConvoChoice1 },
    ]);
}

function onConvoChoice1(sel) {
    commsConvoChoice1 = sel;

    // Show player's chosen message in green
    const playerTexts = [
        'Hey, I\'m not that new anymore.',
        'Wow that was... unpleasant.',
        'I\'m here. Did I ever tell you guys you worry too much?',
        'Hey sorry, I\'ve been a little out of it.',
    ];
    commsAddLine('');
    commsAddLine('> ' + playerTexts[sel], '#88ddaa');

    // Friend response 1 (varies by choice)
    const friendResponses = [
        'YOU\'RE ALIVE! And yeah yeah I know... we wouldn\'t have let you go on this ill advised expedition if nobody respected you around here. But seriously, what happened?',
        'YOU\'RE ALIVE! Unpleasant? Uhg I knew this was a bad idea... What happened?',
        'YOU\'RE ALIVE! And did I ever tell you that you don\'t worry enough? What happened?',
        'YOU\'RE ALIVE! A little out of it? You went completely dark. What happened?',
    ];

    commsQueueActions([
        { type: 'line', text: '', delay: 2.5 },
        { type: 'line', text: friendResponses[sel], color: '#cccccc' },
        { type: 'line', text: '', delay: 1.0 },
        // Player choice 2: single option, conditional text
        { type: 'choice', options: [
            sel === 0 ? 'No idea...' : 'No idea... and I\'m not that new anymore.',
        ], onSelect: onConvoChoice2 },
    ]);
}

function onConvoChoice2(sel) {
    // Show player's message
    const playerText = commsConvoChoice1 === 0
        ? 'No idea...'
        : 'No idea... and I\'m not that new anymore.';
    commsAddLine('');
    commsAddLine('> ' + playerText, '#88ddaa');

    // Friend response 2 (conditional on choice 1)
    let friendResponse;
    if (commsConvoChoice1 === 0) {
        friendResponse = 'Hm. That\'s... interesting. Anyways, Telemetry is out, are you hurt?';
    } else {
        friendResponse = 'Hm. That\'s... interesting. And yeah yeah I know... we wouldn\'t have let you go on this ill advised expedition if nobody respected you around here. Anyways, Telemetry is out, are you hurt?';
    }

    commsQueueActions([
        { type: 'line', text: '', delay: 2.5 },
        { type: 'line', text: friendResponse, color: '#cccccc' },
        { type: 'line', text: '', delay: 1.0 },
        // Player choice 3
        { type: 'choice', options: [
            'I\'m fine all things considered.',
            'Other than waking up on an uncharted planet with no resources... I\'m just grand.',
        ], onSelect: onConvoChoice3 },
    ]);
}

function onConvoChoice3(sel) {
    // Show player's message
    const playerTexts = [
        'I\'m fine all things considered.',
        'Other than waking up on an uncharted planet with no resources... I\'m just grand.',
    ];
    commsAddLine('');
    commsAddLine('> ' + playerTexts[sel], '#88ddaa');

    // Friend response 3
    const friendResponses = [
        'Good. OK good. Look, just... take it slow. We don\'t know much about where you are and clearly something\'s not right with the signal out there. Keep your comms close.',
        'Ha. There\'s the new guy I know. Look, we still can\'t make sense of the readings from your area. Something\'s messing with the signal. Just... be smart about this, alright? Keep your comms close.',
    ];

    commsQueueActions([
        { type: 'line', text: '', delay: 2.5 },
        { type: 'line', text: friendResponses[sel], color: '#cccccc' },
        // Signal loss ending
        { type: 'line', text: '', delay: 3.5 },
        { type: 'line', text: '...zzzt...', color: '#665544', delay: 0.6 },
        { type: 'line', text: '', delay: 0.4 },
        { type: 'line', text: '[ SIGNAL LOST ]', color: '#cc4444', delay: 0.8 },
        { type: 'status', text: 'Disconnected \u2014 Signal Interference', color: '#cc4444' },
        { type: 'callback', fn: () => { commsComplete = true; } },
    ]);
}
