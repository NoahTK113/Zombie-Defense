# Zombie Defense — Architecture Alignment Tracker

Tracks deviations from the target architecture described in ARCH.md. Update as issues are resolved.

Last updated: 2026-03-09 (post wave auto-advance system)

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
~~draw() is 1200+ lines~~ Reduced by ~200 lines. Still contains inline logic for: artifact veins, intro overlays, boot text, artifact UI circles, Feynman diagrams, comms tablet, build mode ghost preview, weapon rendering.
~~HUD~~ ✓ Extracted to hud.js: drawHUD() with KJ counter, round, weapon display.
~~Pause menu~~ ✓ Extracted to menus.js: drawPauseMenu(), drawGameOver().

~~**Visual assets scattered across files**~~ ✓ RESOLVED
Extracted to assets.js: tile variants (earth, brick, artifactBase), artifact vein pattern, noise texture. Shared noise texture eliminated duplicate in crafting.js. Per-frame buffers (veinTintCanvas, lightCanvas) remain in world.js. Stars remain in renderer.js (depend on terrain data). Pedestal and channel vein assets removed (pedestal structure removed from game).

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
- **Wave Auto-Advance** — Conduit circle (artifact UI circle 2) starts waves and controls auto-advance. `advanceWave()` in artifact.js owns wave initiation. `updateWaveSystem()` in zombies.js detects wave completion, starts 15s countdown when auto-advance is on, and fires next wave. Wave identity (`waveNumber`, `waveState`, `waveAutoAdvance`, `waveCountdown`) lives exclusively in gameState. HUD shows countdown timer and wave status. Conduit label updates dynamically ("Advance State" / "Resume Advance" / "Pause Advance").

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
