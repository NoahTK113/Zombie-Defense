# Zombie Defense — Master Architecture Document

> **AI RULE: NEVER use EnterPlanMode. No exceptions.**

Plain language reference for all major systems and how they connect.

> **Working version: v0.5** — All code changes go in the current version folder only. Never modify previous versions.

## Rendering Layer Order

1. World & Artifact tiles
2. Zombies
3. Player
4. Weapons
5. Particles
6. Swing trail (combat.js `drawSwingTrail`)
7. Lighting mask
8. Debug collider overlay (when enabled)
9. HUD overlays (above lighting, always readable)
10. UI interface overlays (Building, Crafting, Comms, Artifact)
11. Pause Menu (topmost, blocks everything)

## Systems

**Game State** — Central source of truth for all flags and global values. Stores mode toggles (isPaused, isInBuildMode, etc.), artifact energy, points, and story progression. Read by nearly every system.

**Player** — Input, movement, collision, animation. Three-component acceleration model: walking input (WD), dash thruster (fuel-limited burst system with Shift + direction), and post-dash slowdown (constant deceleration back to target speed). Walking deceleration extends above walking speed when no input and not dashing. Holds a direct reference to World's grid for fast collision checks. Sends block destruction messages to World (doesn't modify the grid directly). Checks Game State before accepting movement inputs.

**World** — Single source of truth for the grid array. Owns all tile data including visual properties, artifact tile positions, and block HP. Handles block damage tracking and destruction internally. Receives block changes from Combat, Zombies, and Building Mode.

**Renderer** — Draws everything in layer order each frame. No logic — pure visualization. Reads from World, Player, Zombies, Combat, Lighting, and all UI systems.

**Lighting** — Computes the darkness mask each frame. Punches gradient holes around the player flashlight (queries Player position each frame) and the artifact (static, read once at load). Passes mask to Renderer.

**Zombies** — Manages spawning, pathfinding, positions, health, and death. Reads World for pathfinding. Receives damage/knockback from Combat via separate `knockVx`/`knockVy` channel (independent of movement AI velocity, decayed by zombie's own acceleration). Soft wall penalty (`FLYER_WALL_MULT`) for flyers zeros knockback on wall contact axis. Controlled by wave flags in Game State. Owns `updateWaveSystem(dt)` which detects wave completion, starts countdown when auto-advance is on, and calls `advanceWave()` when countdown expires. Owns wave operational data (`wave` object: spawn counts, timers, cached per-wave stats). Absorbing zombies still collide with player (intentional — do not skip).

**Combat** — Authority on all damage. Checks weapon collisions against Zombies and World each frame. Sends damage + knockback to Zombies; sends block destruction to World. Melee system: directional 230° swing arc centered on cursor, hermite easing (asymmetric velocity profile), rotated-rect-vs-AABB collision (SAT). Left click = CCW swing, right click = CW swing. Same-direction cooldown encourages alternating. Variable grip range (choke-up) based on cursor distance from pivot. Knockback is tangential to swing arc (45° outward blend), scaled by instantaneous angular velocity and grip distance. Screen shake triggered on melee hit. Swing trail rendered as tapered fading polygon. Owns `drawSwingTrail()` and `getScreenShakeOffset()` called by Renderer.

**Artifact** — Hub system. Detects player interaction with artifact tiles, opens the Artifact interface, bridges to Building, Crafting, and wave initiation. Owns `advanceWave()` (increments waveNumber, sets waveState to active, calls initWaveSpawns), `WAVE_COUNTDOWN_SECONDS` constant, and the Conduit circle (third artifact UI circle) which controls auto-advance toggling. Owns corruption logic, health regen, and corruption timer. Reads Game State for energy/points; writes mode flags and wave identity back to Game State.

**Building Mode** — Active via Artifact. Own input system, places/removes blocks, prevents overlap with player position. Reads World and Player; writes to World.

**Crafting Mode** — Active via Artifact. Own input system, crafting grid logic, outputs weapon objects to Inventory.

**Comms Interface** — Opened with C. Interprets and walks Story flow data based on Game State story stage. Own navigation inputs. Disables player movement.

**HUD** — Always-visible overlay. Health, ammo, score, artifact energy. Reads Player and Game State. Renders above Lighting mask.

**Pause Menu** — Topmost layer. Triggers Save/Load via Save system. Sets isPaused in Game State.

**Story** — Pure narrative data. Text blocks with shorthand IDs describing conversation content and flow structure. No executable logic, no mutable state. Comms reads and interprets the flow. Progression flags live in Game State.

**Inventory** — Stores current weapons. Receives from Crafting; read by Combat and Renderer. Exported by Save.

**Save** — Uses IndexedDB for persistent storage. Exports/imports Inventory + Game State snapshots.

**Sound** — Hybrid audio system. Uses `<audio>` elements for one-shot sound effects (works with file:// protocol) and Web Audio API `AudioBufferSourceNode` for pitch-shifted/time-stretched playback. Preloads .wav files from `sounds/` folder on first user interaction. Provides `playSound(name)` for standard playback and `playSoundStretched(name, duration)` for waveform-resampled pitch shifting. Ambient loop plays continuously. Gracefully handles missing sound files (silence, no errors).

**Assets** (planned) — Centralized sprites and visual data. Will allow reuse of assets across contexts (e.g. same artifact sprite in-world and in UI).

**Main** — Game loop and initialization. Owns the update/draw cycle, delta time, and startup sequence (world gen, player spawn, camera init). Ticks Camera, Wave, Player, Zombies, Combat, Particles, and Artifact each frame. Does not own game state — reads and writes through gameState.

**Intro** — Opening cinematic state machine (fadein, blink, standup). Runs before normal gameplay. Sets tutorialStep in Game State on completion. Checked by update loop to skip normal gameplay while active.

**Particles** — Lightweight shared system. Stores active particles, ticks physics and lifetime each frame. Spawned by Combat (bullet hits, zombie/player death) and World (block breaking). Drawn by Renderer.

**Camera** — Tracks player in player mode (lerp factor `CAMERA_FOLLOW_SPEED`), free pan in build mode. Owns position and zoom. Updated each frame by main loop. Read by Renderer and input coordinate transforms.

**Physics** — Shared movement and collision utilities used by Player and Zombies. Tile solidity checks, step-up logic, and future helpers (e.g. slope handling, knockback curves). Lives close to World data but operates on any entity with position/velocity/bounds.

**Input** — Pure event router for keyboard and mouse. Contains no game logic — only reads game state to determine which system is active, then delegates to that system's handler. Each system owns its own input response. Keydown routing priority (first match wins):

1. Crafting open → `craftKeyDown(code)` (handles ESC/E close internally)
2. C key → `commsHandleInput(code)` (works across all states)
3. Tab key → weapon cycling (with preventDefault to block browser focus)
4. Comms open → `commsHandleInput(code)` (navigation, choices)
5. Intro active → `introHandleKey(code)`
6. Artifact boot text → block all input
7. Artifact UI open → `artifactHandleKey(code)` (handles ESC/E close internally)
8. Escape → `pauseHandleKey(code)`
9. Paused → block all input
10. Default (player mode) → `playerHandleKey(code)` + `handleDebugKeys(e)`

Movement uses keys[] polling in `updatePlayer()` each frame — separate from the keydown routing.

Mouse handlers delegate to system handlers (crafting mouse, artifact hover/click, build click/drag) but still contain inline logic for camera pan and cursor style.

**Constants** — Pure configuration data. Tile sizes, world dimensions, wave scaling formulas, weapon stats, physics values, melee combat tuning (`MELEE_SWING_SPEED_MULT`, `MELEE_MIN_SWING_DURATION`, `MELEE_SWING_ARC`, `MELEE_SAME_DIR_COOLDOWN`, `MELEE_KNOCKBACK_COEFF`, `MELEE_COLLIDER_TIP_BUFFER`, `MELEE_HIT_PADDING`, `SCREEN_SHAKE_INTENSITY`, `SCREEN_SHAKE_DURATION`, `FLYER_WALL_MULT`), dash/thruster tuning (`DASH_ACCEL`, `DASH_FUEL_MAX`, `DASH_FUEL_CONSUME`, `DASH_BURST_COST`, `DASH_FUEL_REGEN`, `DASH_EMPTY_COOLDOWN`, `DASH_SLOW_TARGET`, `DASH_SLOW_DECEL`, `DASH_SLOW_SNAP`), camera (`CAMERA_FOLLOW_SPEED`). No state, no logic beyond helper functions for wave stat calculation.

**Debug** — Developer-only key bindings (F1-F11, backtick) for testing. Reaches into multiple systems (spawn control, wave skip, corruption toggle, weapon clear, flow field display, melee collider overlay, etc.). All debug actions route through gameState or system APIs — no direct mutation of internal state.

## Tile Size Duality

Two constants describe tile dimensions for different purposes:

- `TILE_SIZE` (20) — Game logic unit. Used by physics, collision, player, zombies, camera, building, pathfinding — everything that cares about "where things are." One tile = 20×20 world-units.
- `TILE_TEXELS` (60) — Render resolution. Used only by the chunk system when baking tiles into chunk canvases. One tile = 60×60 pixels in the chunk buffer. Matches max game zoom (3x) so textures are never stretched.

`CHUNK_PX` uses `TILE_TEXELS` (chunk canvas size = `CHUNK_SIZE * TILE_TEXELS`).

Conversion is needed in one place:
- **Chunk draw** (renderer.js) — Chunk canvases are in `TILE_TEXELS` space, but the camera and screen positioning use `TILE_SIZE` world-space. World position of a chunk = `cx * CHUNK_SIZE * TILE_SIZE`. The `drawImage` source is the full chunk canvas; the destination size is `CHUNK_SIZE * TILE_SIZE * effectiveZoom`.

`buildChunk` (world.js) works entirely in `TILE_TEXELS` space — no conversion needed.

All other systems use `TILE_SIZE` exclusively.

## Game State Object

Plain object (`const gameState = {...}`) holding all persistent game flags and values.

- **Contains:** mode toggles, economy, progression flags, artifact health, wave state
- **Excludes:** camera, UI animation state, per-frame timers, inventory (separate system)
- All systems read/write through `gameState` rather than loose globals
- Serializable via `JSON.stringify` for save/load
- **Wave state split:** wave identity lives in gameState (`waveNumber`, `waveState`, `waveAutoAdvance`, `waveCountdown`). Wave operational data (spawn timer, spawn interval, cached per-wave stats) stays in the Zombies system as local working state (`wave` object). No system accesses wave identity through the `wave` object.

## File Structure

```
js/constants.js      — Constants (TILE_SIZE, TILE_TEXELS, world dims, wave config)
js/state.js          — Game State object
js/sound.js          — Sound system (playSound, playSoundStretched, ambient loop)
js/rock_texture.js   — Procedural rock tile generator (generateRockTiles)
js/assets.js         — Centralized sprites and visual data
js/world.js          — World, block HP, chunk system
js/physics.js        — Physics utilities
js/player.js         — Player
js/zombies.js        — Zombies, wave operational data, dual flow fields
js/combat.js         — Combat
js/particles.js      — Particles
js/renderer.js       — Renderer (orchestrator, calls subsystem draw functions)
js/lighting.js       — Lighting
js/hud.js            — HUD
js/menus.js          — Pause Menu, Main Menu (future)
js/artifact.js       — Artifact hub, corruption logic, artifact UI, Building Mode
js/crafting.js       — Crafting Mode
js/comms.js          — Comms Interface
js/intro.js          — Intro sequence only
js/story.js          — Story (pure data)
js/inventory.js      — Inventory
js/save.js           — Save/Load
js/input.js          — Input routing
js/debug.js          — Debug (removable for production)
js/main.js           — Main loop, Camera, init
sounds/              — Sound effect .wav files (loaded by sound.js)
```

## Core Principles

- World owns the grid. All changes go through World.
- Game State owns all global flags and values.
- Renderer is the only system that draws.
- Story is read-only.
- Save/Load only touches Inventory and Game State.

