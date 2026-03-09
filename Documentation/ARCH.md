# Zombie Defense — Master Architecture Document

> **AI RULE: NEVER use EnterPlanMode. No exceptions.**

Plain language reference for all major systems and how they connect. Update when structure changes.

> **Working version: v0.4** — All code changes go in the current version folder only. Never modify previous versions.

## Rendering Layer Order

1. World & Artifact tiles
2. Zombies
3. Player
4. Weapons
5. Particles
6. Lighting mask
7. HUD overlays (above lighting, always readable)
8. UI interface overlays (Building, Crafting, Comms, Artifact)
9. Pause Menu (topmost, blocks everything)

## Systems

**Game State** — Central source of truth for all flags and global values. Stores mode toggles (isPaused, isInBuildMode, etc.), artifact energy, points, and story progression. Read by nearly every system.

**Player** — Input, movement, collision, animation. Holds a direct reference to World's grid for fast collision checks. Sends block destruction messages to World (doesn't modify the grid directly). Checks Game State before accepting movement inputs.

**World** — Single source of truth for the grid array. Owns all tile data including visual properties, artifact tile positions, and block HP. Handles block damage tracking and destruction internally. Receives block changes from Combat, Zombies, and Building Mode.

**Renderer** — Draws everything in layer order each frame. No logic — pure visualization. Reads from World, Player, Zombies, Combat, Lighting, and all UI systems.

**Lighting** — Computes the darkness mask each frame. Punches gradient holes around the player flashlight (queries Player position each frame) and the artifact (static, read once at load). Passes mask to Renderer.

**Zombies** — Manages spawning, pathfinding, positions, health, and death. Reads World for pathfinding. Receives damage/knockback from Combat. Controlled by wave flags in Game State.

**Combat** — Authority on all damage. Checks weapon collisions against Zombies and World each frame. Sends damage + knockback to Zombies; sends block destruction to World.

**Artifact** — Hub system. Detects player interaction with artifact tiles, opens the Artifact interface, bridges to Building, Crafting, and wave initiation. Owns corruption logic, health regen, and corruption timer. Reads Game State for energy/points; writes mode flags back to Game State.

**Building Mode** — Active via Artifact. Own input system, places/removes blocks, prevents overlap with player position. Reads World and Player; writes to World.

**Crafting Mode** — Active via Artifact. Own input system, crafting grid logic, outputs weapon objects to Inventory.

**Comms Interface** — Opened with Tab. Interprets and walks Story flow data based on Game State story stage. Own navigation inputs. Disables player movement.

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

**Camera** — Tracks player in player mode, free pan in build mode. Owns position and zoom. Updated each frame by main loop. Read by Renderer and input coordinate transforms.

**Physics** — Shared movement and collision utilities used by Player and Zombies. Tile solidity checks, step-up logic, and future helpers (e.g. slope handling, knockback curves). Lives close to World data but operates on any entity with position/velocity/bounds.

**Input** — Pure event router for keyboard and mouse. Contains no game logic — only reads game state to determine which system is active, then delegates to that system's handler. Each system owns its own input response. Keydown routing priority (first match wins):

1. Crafting open → `craftKeyDown(code)` (handles ESC/E close internally)
2. Tab key → `commsHandleInput(code)` (works across all states)
3. Comms open → `commsHandleInput(code)` (navigation, choices)
4. Intro active → `introHandleKey(code)`
5. Artifact boot text → block all input
6. Artifact UI open → `artifactHandleKey(code)` (handles ESC/E close internally)
7. Escape → `pauseHandleKey(code)`
8. Paused → block all input
9. Default (player mode) → `playerHandleKey(code)` + `handleDebugKeys(e)`

Movement uses keys[] polling in `updatePlayer()` each frame — separate from the keydown routing.

Mouse handlers delegate to system handlers (crafting mouse, artifact hover/click, build click/drag) but still contain inline logic for camera pan and cursor style.

**Constants** — Pure configuration data. Tile sizes, world dimensions, wave scaling formulas, weapon stats, physics values. No state, no logic beyond helper functions for wave stat calculation.

**Debug** — Developer-only key bindings (F1-F11) for testing. Reaches into multiple systems (spawn control, wave skip, corruption toggle, weapon clear, flow field display, etc.). All debug actions route through gameState or system APIs — no direct mutation of internal state.

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
- **Wave state split:** wave identity (number, state) lives in gameState. Wave operational data (spawn timer, spawn interval, cached per-wave stats) stays in the Zombies system as local working state.

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

---

## Alignment

Last updated: 2026-03-08 (post sound system + player flow field)

### 1. System Ownership Violations

**Block HP system is in the wrong file**
blockHP Map, damageBlock(), getBlockHP() live in zombies.js.
World should own block HP and handle damage tracking internally.

~~**Artifact health logic is in the wrong file**~~ ✓ RESOLVED
Extracted to artifact.js: artifactCorruptTimer, artifactPulse, artifactPulseColor, artifactUI, updateArtifact(dt), artifactOnZombieAbsorbed(), isNearArtifact(), getArtifactUICircles(), artifactUISelectCircle(). Zombies calls artifactOnZombieAbsorbed() on absorption. Main calls updateArtifact(dt) each frame.

**Player contact damage is in the wrong file**
Player takes damage in zombies.js (inside resolveZombieCollisions).
Combat is authority on all damage.

~~**Inventory/weapons are in the wrong file**~~ ✓ RESOLVED
Extracted to inventory.js: weapons[], activeWeaponIndex, SHOVEL_WEAPON, getActiveWeapon(), loadWeaponsFromStorage(), checkForNewWeapons().

~~**Comms terminal is in the wrong file**~~ ✓ RESOLVED
Extracted to comms.js: comms object, commsWrapText(), commsAddLine(), commsShowChoice(), commsQueueActions(), commsProcessQueue(), updateComms(), commsHandleInput().

~~**Save/Load is in the wrong file**~~ ✓ RESOLVED
Extracted to save.js: saveWorld(), loadWorld(). Still uses localStorage, not IndexedDB as specified in master.

### 2. Renderer Violations

~~**Lighting is embedded in Renderer**~~ ✓ RESOLVED
Extracted to lighting.js: drawLighting() with darkness mask, artifact light, flashlight, star holes. Renderer calls drawLighting(camX, camY, effectiveZoom).

**Renderer is still large**
~~draw() is 1200+ lines~~ Reduced by ~200 lines. Still contains inline logic for: artifact veins, channel veins, intro overlays, boot text, artifact UI circles, Feynman diagrams, comms tablet, build mode ghost preview, weapon rendering.
~~HUD~~ ✓ Extracted to hud.js: drawHUD() with KJ counter, round, weapon display.
~~Pause menu~~ ✓ Extracted to menus.js: drawPauseMenu(), drawGameOver().

~~**Visual assets scattered across files**~~ ✓ RESOLVED
Extracted to assets.js: tile variants (earth, brick, artifactBase, pedestal), artifact vein pattern, channel vein pattern, noise texture. Shared noise texture eliminated duplicate in crafting.js. Per-frame buffers (veinTintCanvas, lightCanvas) remain in world.js. Stars remain in renderer.js (depend on terrain data).

~~**Earth textures loaded from external PNG**~~ ✓ RESOLVED
Replaced PNG loading (rock_texture_sq.png, generateEarthFromTexture, onAssetsReady async pattern) with procedural generation in rock_texture.js. generateRockTiles(32) produces 32 unique 60×60 canvases using blob flood-fill + midpoint displacement cracks + per-pixel noise. All asset init is now synchronous — no more async callback wrapper in main.js.

### 3. Story System Violations

**Story is not pure data**
Has executable logic: onConvoChoice1/2/3 callback functions with branching.
Target: branching logic moves to Comms, Story becomes pure data with flow shorthand IDs.

**Story has outgoing connections**
commsStartRelaySequence() writes intro.active, intro.phase. Writes gameState.commsComplete. Calls into comms system (commsAddLine, commsQueueActions, commsShowChoice).
Target: Comms reads and interprets Story flow data, Story has no outgoing calls.

### 4. Input System Violations

~~**Input is not a pure router**~~ ✓ RESOLVED (keydown handler)
Keydown handler is now a pure event router — zero inline game logic. All handlers delegated to owning systems:
- ~~Artifact interaction (E-key open/close, first-touch flash, mouse hover/click on circles) is inline.~~ ✓ RESOLVED — `artifactHandleKey()`, `artifactHandleClick()`, `artifactHandleMouseMove()` in artifact.js.
- ~~Build mode (`doBuildAction()`, drag-to-build) is inline.~~ ✓ RESOLVED — `doBuildAction()`, `buildHandleClick()`, `buildHandleDrag()` in artifact.js.
- ~~Pause toggle (ESC) is inline.~~ ✓ RESOLVED — `pauseHandleKey()` in menus.js.
- ~~Intro key handling (E to stand up, F1 to skip) is inline.~~ ✓ RESOLVED — `introHandleKey()` in intro.js.
- ~~Crafting close (ESC/E) is inline.~~ ✓ RESOLVED — handled inside `craftKeyDown()` in crafting.js.
- ~~Player actions (flashlight, weapon swap) are inline.~~ ✓ RESOLVED — `playerHandleKey()` in player.js.
- ~~Comms Tab open/close is inline.~~ ✓ RESOLVED — handled inside `commsHandleInput()` in comms.js.

**Remaining input deviations:**
- Game over has no dedicated handler (`gameOverHandleKey`). Will be added alongside main menu.

~~**Note:** Input blocking issues exist during certain phases (e.g. boot text).~~ ✓ RESOLVED — Boot sequence now sets `artifactUI.open = true` at start, so `isInterfaceOpen()` freezes player movement throughout.

### 5. Known Bugs

~~**Zombies target artifact when corrupt**~~ ✓ RESOLVED
Zombies now switch to player flow field immediately when artifact is corrupted (`gameState.artifactCorrupted`). All zombies revert to artifact targeting when corruption ends.

### 6. Open Questions

**Collision system ownership is undefined**
Collision resolution is currently scattered: player tile collisions in player.js (resolvePlayerX/Y), zombie tile collisions in zombies.js (resolveZombieX/Y), zombie-zombie and player-zombie circle collisions in zombies.js (resolveZombieCollisions), flyer wall penalty in zombies.js. Physics.js only has isSolid/tryStepUp. Need to decide whether collisions belong in physics.js, stay in their respective entity files, or get a dedicated collision system.

### 7. What Already Aligns

- World owns the grid array and provides setTile()/tileAt() as the access API
- Player reads World for collision, doesn't modify grid directly
- Combat is mostly the authority on bullet/melee damage
- Crafting is self-contained with own input, grid logic, and weapon output
- Renderer draws in correct layer order matching ARCH
- Constants is clean configuration data with no state or logic
- Intro is a clean self-contained state machine (comms extracted)
- Main exists as the game loop and initialization hub (inventory extracted)
- **Inventory** is in its own file (inventory.js) with weapons, active weapon, hot-reload
- **Comms** is in its own file (comms.js) with terminal state, queue, input handling
- **Save/Load** is in its own file (save.js) with saveWorld/loadWorld
- **Game State is centralized** in state.js with gameState object + isInterfaceOpen() helper
- **Physics utilities** (isSolid, tryStepUp) are in their own shared file
- **Particles** (array, update, all spawn functions) are in their own file
- **Debug keys** (F1-F11, Ctrl+S/L) are in their own file via handleDebugKeys()
- **Lighting** is in its own file (lighting.js) with drawLighting(), called by Renderer
- **HUD** is in its own file (hud.js) with drawHUD(), called by Renderer
- **Menus** are in their own file (menus.js) with drawPauseMenu(), drawGameOver(), called by Renderer
- **Artifact** is in its own file (artifact.js) with corruption state, UI state, updateArtifact(), artifactOnZombieAbsorbed(), isNearArtifact(), input handlers (artifactHandleKey, artifactHandleClick, artifactHandleMouseMove), and build mode handlers (doBuildAction, buildHandleClick, buildHandleDrag)
- **Input keydown handler** is a pure event router — delegates to system handlers, contains no game logic
- **Player** has its own input handler (playerHandleKey) for flashlight, weapon swap, artifact interaction
- **Menus** has pause input handler (pauseHandleKey)
- **Intro** has its own input handler (introHandleKey) for stand-up prompt and F1 skip
- **Assets** is in its own file (assets.js) with centralized texture generation (tile variants, vein patterns, shared noise texture)
- **Rock Texture** is in its own file (rock_texture.js) with generateRockTiles() — procedural earth tile generation at TILE_TEXELS resolution
- **Sound** is in its own file (sound.js) with playSound(), playSoundStretched(), ambient loop. Hybrid: `<audio>` elements for one-shots (file:// compatible), Web Audio API AudioBuffers for pitch-shifted playback. Sound triggers wired into combat.js, player.js, zombies.js, artifact.js.
- **Dual Flow Fields** — zombies.js computes both artifact and player flow fields with BFS path distance. Per-zombie targeting uses path distance comparison (closer target wins). Player flow field recomputes on tile-granularity player movement. Both fields invalidated on block solidity changes.

### 8. Current File Structure

```
js/constants.js      — Constants (TILE_SIZE, TILE_TEXELS, world dims, wave config)
js/state.js          — Game State object, isInterfaceOpen()
js/sound.js          — Sound system (playSound, playSoundStretched, ambient loop)
js/rock_texture.js   — Rock Texture (generateRockTiles, procedural earth tiles)
js/assets.js         — Assets (tile variants, vein patterns, noise texture)
js/world.js          — World, block HP, chunk system (TILE_TEXELS render resolution)
js/physics.js    — Physics utilities (isSolid, tryStepUp)
js/particles.js  — Particle system (array, update, spawn functions)
js/save.js       — Save/Load (saveWorld, loadWorld)
js/player.js     — Player
js/inventory.js  — Inventory (weapons, SHOVEL_WEAPON, hot-reload)
js/comms.js      — Comms Terminal (state, queue, input, wrap)
js/intro.js      — Intro sequence only
js/story.js      — Story data + branching logic
js/zombies.js    — Zombies, wave state, block HP, dual flow fields
js/combat.js     — Combat (bullets, melee, sound triggers)
js/crafting.js   — Crafting Mode
js/input.js      — Input routing (pure event router)
js/debug.js      — Debug keys (F1-F11, Ctrl+S/L)
js/artifact.js   — Artifact (corruption, UI, update, absorption, input handlers)
js/lighting.js   — Lighting (drawLighting)
js/hud.js        — HUD (drawHUD)
js/menus.js      — Pause Menu, Game Over (drawPauseMenu, drawGameOver)
js/renderer.js   — Renderer (orchestrator, inline artifact/comms/intro UI drawing)
js/main.js       — Main loop, camera
sounds/          — Sound effect .wav files
```
