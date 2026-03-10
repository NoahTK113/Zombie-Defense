# Zombie Defense — Current Mechanics (v0.5)

Plain language reference for every gameplay system as it exists in code today. Numbers pulled directly from source.

---

## 1. Player

### Movement
- Walk speed: 200 px/sec with acceleration ramp (reaches max in 0.5s)
- Deceleration matches acceleration — player slides to a stop, not instant
- Jump impulse: -440 px/sec (upward)
- Gravity: 800 px/sec² (shared with all entities)
- Body size: 0.8 tiles wide, 1.8 tiles tall

### Step-Up
- Player automatically walks up 1-tile ledges without jumping
- Checks that the tile ahead is blocked at feet level but clear at head level
- Works while moving on the ground with horizontal velocity

### Health & Damage
- Max HP: 100
- Passive regen: 15 HP/sec (always active while alive)
- Invulnerability window: 0.2 seconds after taking a hit (prevents stun-lock)
- Damage flash: red tint for 2.0 seconds after being hit
- Knockback on hit: 200 px/sec impulse away from source

### Death & Respawn
- Dies at 0 HP, spawns 12 particles (red/blue burst)
- Respawn timer: 10 seconds countdown
- Respawn location: on top of the artifact
- Brief invulnerability on respawn: 1.0 second

### Controls
| Key | Action |
|-----|--------|
| A / Left Arrow | Move left |
| D / Right Arrow | Move right |
| W / Space / Up Arrow | Jump (when on ground) |
| F | Toggle flashlight |
| Tab | Cycle weapon |
| C | Open comms |
| E | Interact with artifact |
| ESC | Pause |

---

## 2. Camera

### Zoom
- Player mode default: 1.25x
- Build mode range: 0.65x to 3.0x
- Player mode minimum: 1.25x (can't zoom out further during play)
- Maximum in both modes: 3.0x
- Scroll wheel: 1.06x multiplier per tick

### Following
- In player mode: smooth lerp tracking (factor 8 × dt), centers on player
- Clamped to world bounds so you can't scroll past the edges
- In build mode: free pan via right-click drag, zoom anchored to mouse position

### Coordinate Conversion
- Tile size on screen snaps to whole pixels: max(1, round(TILE_SIZE × zoom))
- All screen-to-world transforms go through this effective zoom value

---

## 3. World

### Terrain Generation
- World size: 640 × 205 tiles
- Ground level: row 70 (sky above, earth below)
- Perlin noise with 4 octaves controlling surface shape:
  - Low frequency (×0.01) with ×16 amplitude — large rolling hills
  - Medium-low (×0.025) with ×8 amplitude — regional variation
  - Medium-high (×0.06) with ×6 amplitude — local bumps
  - High frequency (×0.12) with ×1 amplitude — fine detail

### Flat Zone
- 12 tiles wide centered on the artifact (±6 tiles from center)
- 10-tile blend zone on each side using smoothstep interpolation
- Ensures the artifact sits on level ground with natural-looking transitions

### Tile Types
- **AIR** — empty space, non-solid
- **EARTH** — natural terrain, solid, diggable (100 HP)
- **BRICK** — player-placed block, solid (150 HP)
- **ARTIFACT** — artifact body tiles, solid, indestructible

### Chunk System
- Chunks: 32 × 32 tiles each, forming a 20 × 7 grid
- Render resolution: 60 × 60 pixels per tile (TILE_TEXELS) — matches max zoom so textures never stretch
- Chunks rebuild dynamically when tiles change
- Tile textures: procedurally generated rock patterns (blob flood-fill + midpoint displacement cracks + per-pixel noise), selected via deterministic hash per tile position

---

## 4. Artifact

### Structure
- 5 × 5 tile body, centered horizontally at tile 320 (`ARTIFACT_CENTER_X`)
- Sits on ground level (row 65–69)
- Dark blue tiles with animated fractal vein pattern
- Veins shift color: blue when healthy, toward red when damaged
- No pedestal or support structure — artifact sits directly on terrain

### Interaction
- Must be within ~7 tiles of artifact center to interact (E key)
- First-time interaction triggers a boot sequence:
  1. White flash (0.5 seconds)
  2. Boot text: 9 lines appearing sequentially (~1.05s each, 1.5s pause at end)
  3. Three UI circles fade in with staggered timing (0s, 0.8s, 1.6s start; 1.2s fade each)
- Subsequent visits skip the boot sequence — circles appear immediately
- Dismiss with ESC or clicking outside the circles

### UI Circles
Three clickable options arranged around the artifact:
- **Build Mode** (top) — enters build mode, shows KJ balance
- **Crafting** (bottom-left) — opens the crafting grid
- **Conduit** (bottom-right) — wave control (available when not corrupted). Label changes dynamically:
  - "Advance State" — first use, starts wave 1 with auto-advance enabled
  - "Resume Advance" — resumes auto-advance (when idle or when active with auto-advance off)
  - "Pause Advance" — pauses auto-advance (when counting down or when active with auto-advance on)

### Health
- Max HP: 1000
- Each zombie absorption deals 100 damage
- No passive regen during normal operation

### Corruption (Two-Phase)
Triggers when artifact HP drops to 0:

**Phase 1 — No Regeneration (60 seconds)**
- Artifact stops functioning, red pulsing visual
- Stars shift from white/blue toward red
- All zombies immediately switch to targeting the player

**Phase 2 — Recovery**
- After 60 seconds, artifact begins regenerating at 20 HP/sec
- Zombies continue targeting the player throughout recovery
- Blue pulsing visual during recovery
- Corruption ends when HP reaches 1000 (full)
- All zombies revert to artifact targeting when corruption ends

---

## 5. Building Mode

### Entry & Exit
- Enter through artifact UI (Build Mode circle) or by pressing E near artifact
- Exit by pressing E again
- Player movement freezes during build mode

### Placement Rules
- Place BRICK blocks on any AIR tile — costs 50 KJ
- Cannot place on tiles occupied by the player
- Cannot place on ARTIFACT tiles

### Digging
- Dig EARTH tiles — costs 50 KJ
- Cannot dig ARTIFACT or BRICK tiles (brick can only be dug — same 50 KJ cost)
- Destroyed blocks are gone permanently (until world reload)

### Controls
| Input | Action |
|-------|--------|
| Left Click / Left Drag | Place block (on AIR) or dig (on EARTH/BRICK) |
| Right Click Drag | Pan camera |
| Scroll Wheel | Zoom in/out (0.65x – 3.0x) |
| E | Exit build mode |

---

## 6. Crafting

### Grid
- 20 × 20 cell grid
- Cell size: 36 pixels each
- Grid can be zoomed and panned (middle-click drag, scroll wheel)

### Materials (12 Types)
All materials are available from wave 0 (no unlock gating):

| Material | Color | Role |
|----------|-------|------|
| Steel | Gray | Structural — defines weapon bounding box |
| Composite | Black | Lightweight structural |
| Power Cell | Orange | Energy source |
| Emitter | Yellow | Sends rays (for beam weapons) |
| Plasma Cell | Cyan | Damage component |
| Energy Crystal | Purple | Power component |
| Titanium | Light gray | Strong structural |
| Dark Steel | Dark blue | Heavy structural |
| Void Glass | Navy | Dark structural |
| Mirror | White | Reflects rays |
| Lens | Light blue | Focuses rays |
| Diagonal Mirror | White | Reflects rays diagonally |

### How It Works
- Left click places the selected material, right click erases
- Steel cells define the core weapon shape (bounding box)
- Emitters send rays that bounce off mirrors — this is the beam weapon mechanic
- Shape + materials determine output stats: damage, speed, range, knockback
- Export generates a sprite and weapon data, saved to localStorage

### Controls
| Input | Action |
|-------|--------|
| Left Click | Place material |
| Right Click | Erase material |
| Middle-Click Drag | Pan grid |
| Scroll | Zoom grid |
| ESC / E | Close crafting |

---

## 7. Inventory & Weapons

### Weapon Slots
- Slot 0: Emergency Shovel (always present, cannot be removed)
- Additional slots: crafted weapons from the crafting system
- Q key cycles through available weapons
- Active weapon shown in HUD (lower-left)

### Emergency Shovel (Default Melee)
- Damage: 15 HP per swing (to zombies), 50 HP per swing (to blocks)
- Base swing duration: 0.3 seconds (effective: max(0.15s, base × 0.7) = 0.21s)
- Range: 2.5 tiles from player center (variable with choke-up — see Combat §8)
- Knockback: 180 px/sec (scaled by angular velocity and grip distance)
- Swing arc: 230° centered on cursor direction, hermite easing
- Left click = CCW swing, right click = CW swing
- Can hit multiple zombies in a single swing
- Knocks absorbing zombies out of absorption (grants 0.3s re-absorption immunity)

### Pistol (Always Available)
- Automatic fire while holding left mouse button, aimed at cursor
- Fire rate: ~15 shots/sec (0.067s between shots)
- Damage: 3 HP per bullet
- Bullet speed: 3200 px/sec
- Penetration: passes through up to 2 zombies per bullet
- Knockback: 36 px/sec per hit
- Ammo: unlimited
- Fires simultaneously with melee (not weapon-swapped — always active)

### Crafted Weapons
- Custom stats based on crafting output (damage, speed, range, knockback)
- Rendered with their generated sprite in HUD
- Stored in localStorage, hot-reloaded every 3 seconds
- Persist across page refreshes

---

## 8. Combat

### Melee Swing System
- **Swing arc**: 230° (`MELEE_SWING_ARC`) centered on cursor direction at swing start
- **Swing easing**: Hermite cubic spline with asymmetric velocity (20% start, 30% end, peak past midpoint)
- **Effective speed**: `max(MELEE_MIN_SWING_DURATION, weapon.speed × MELEE_SWING_SPEED_MULT)` — floor of 0.15s, multiplier of 0.7
- **Directions**: Left click = counterclockwise, right click = clockwise
- **Same-direction cooldown**: After swing finishes, same direction blocked for `duration × MELEE_SAME_DIR_COOLDOWN` (1.0). Opposite direction bypasses cooldown (encourages alternating)
- Blocked during: death, interface open, paused, game over

### Variable Grip Range (Choke-Up)
- Cursor distance from player pivot determines weapon reach per swing
- Close clicks = short range, far clicks = full reach
- Grip distance clamped between `armOffset + steelHeight` (minimum) and full weapon tip (maximum)
- Cursor distance includes half the collider length so click point = collider center
- Collider position, weapon sprite offset, swing trail, and knockback all scale with grip distance

### Melee Collider
- **Shape**: Rotated rectangle (weapon width × steel height + tip buffer)
- **Hit detection**: Separating Axis Theorem (SAT) — rotated rect vs axis-aligned bounding box
- **Zombie hitbox**: Same AABB as bullets (`getZombieBounds`), expanded by `MELEE_HIT_PADDING` (8px) for melee only
- **Tip buffer**: `MELEE_COLLIDER_TIP_BUFFER` (0.3 tiles) extends collider past weapon tip
- **Debug overlay**: Backtick key toggles red collider visualization
- Can hit multiple zombies per swing

### Knockback
- **Separate velocity channel**: `knockVx`/`knockVy` on each zombie, independent of movement AI velocity — prevents speed clamping from nullifying knockback
- **Direction**: 45° blend of swing tangent and radial outward from pivot. Tangent direction flips with CW/CCW swing
- **Angular velocity scaling**: Knockback magnitude × normalized `swingEaseVel(progress) / peakVel` — hits at peak swing speed deal full knockback, hits at start/end deal less
- **Grip scaling**: Knockback × `meleeGripDist / fullTipDist` — choked-up swings deal proportionally less knockback
- **Decay**: Linear deceleration using zombie's own movement acceleration (walkers: `speed/0.5`, flyers: `speed/0.15`). Not friction-based
- **Wall collision**: Knockback velocity zeroed on the contact axis when zombie hits a wall (prevents phasing through terrain)
- Knockback grants 0.3 seconds of absorption immunity (prevents instant re-absorption at artifact)

### Screen Shake
- Random camera offset (±`SCREEN_SHAKE_INTENSITY` = 3 px) triggered on each melee hit
- Decays over `SCREEN_SHAKE_DURATION` (0.12s)

### Swing Trail
- Tapered polygon trailing weapon tip, fading over 0.2s
- Peak alpha: 0.35, white fill
- Lives in combat.js (`drawSwingTrail`), drawn by renderer before lighting layer

### Bullets
- Sub-stepping: bullet position checked every 0.6 tiles along its path each frame
- Prevents fast bullets from phasing through zombies
- Bullets that hit terrain are destroyed
- Penetration counter decrements per zombie hit — bullet destroyed when counter reaches 0

---

## 9. Zombies

### Types

**Flyers (Primary — 67% of spawns)**
- Airborne, no gravity
- Navigate via flow field pathfinding with 4-point body sampling
- Acceleration: reaches max speed in 0.15 seconds
- Player aggression: if player is within 5 tiles AND closer than the artifact, flyers divert toward player
- Wall handling: soft penalty acceleration pushes them out (1.2x their own accel)
- Can break blocks at breach points when stuck against walls

**Walkers (33% of spawns — currently disabled, default to flyer)**
- Ground-based movement with acceleration ramp (0.5s to max speed)
- Can walk, step-up (1 tile), jump, and break blocks
- Jump force: -350 px/sec (normal), -450 px/sec (near artifact)
- Failed jump tracking: after consecutive failed jumps, switches to block-breaking
- State machine: walking → jumping → breaking → absorbing

### Spawning
- Location: randomly left or right side, ~45 tiles from artifact center
- Finds ground at spawn column, spawns on surface
- Spawn rate per wave: starts at 2.5 seconds between spawns, decreases by 0.12s per wave, minimum 0.4s
- First zombie of each wave spawns immediately

### Stats Scaling (Per Wave)

**Zombie Count**
- Formula: floor(5 + 2.5 × (wave-1)^1.35)
- Wave 1: 5, Wave 2: ~8, Wave 3: ~11, scaling upward

**Flyer Stats**
| Stat | Base (Wave 1) | Growth |
|------|---------------|--------|
| HP | 150 | ×(1 + 0.18 × (wave-1))^1.15 |
| Min Speed | 50 px/sec | +9/wave |
| Max Speed | 130 px/sec | +15/wave (cap: 420) |
| Contact Damage | 30 HP | ×(1 + 0.06 × (wave-1)) |
| Break DPS | 33 | ×(1 + 0.05 × (wave-1)) |

**Walker Stats**
| Stat | Base (Wave 1) | Growth |
|------|---------------|--------|
| HP | 150 | Same formula as flyer |
| Min Speed | 25 px/sec | +3/wave |
| Max Speed | 65 px/sec | +5/wave (cap: 140) |
| Contact Damage | 30 HP | Same as flyer |
| Break DPS | 33 | Same as flyer |

Each zombie gets a randomized speed within its wave's min–max range.

### Block Breaking
- Zombies destroy blocks in their path using their wave-scaled break DPS
- Block HP: EARTH has 100 HP, BRICK has 150 HP
- Damaged block HP tracked in a Map (only stores damaged blocks, undamaged use defaults)
- Destroyed blocks spawn 5 particles

### Absorption
- Triggers when a zombie touches an artifact tile (within 2 pixels)
- Zombie freezes in place, red pulse animation plays
- 5 pulses at 1.5 Hz (~3.33 seconds total)
- Deals 100 damage to artifact on completion
- Can be interrupted by knockback (shovel hit, bullet, crafted weapon)
- Interrupted zombies get 0.3s immunity to re-absorption

### Collision
- Zombie body radius: 8 pixels (`ZOMBIE_COLLISION_R`, used for zombie-zombie and player-zombie)
- Zombie AABB: `getZombieBounds()` used for bullet and melee hit detection
- Zombie-zombie: circle overlap, soft separation (0.07x overlap correction per frame)
- Bounce coefficient: 0.02 (nearly inelastic — they absorb each other's momentum)
- Player-zombie: circle system, applies contact damage + knockback to player. Absorbing zombies still collide with player (intentional — do not skip)
- Flyer wall penalty: soft acceleration push (`FLYER_WALL_MULT` = 1.2× own accel). Zeroes both movement velocity and knockback velocity on the contact axis

### Targeting (Dual Flow Field)
- Two flow fields computed: one rooted at the artifact, one rooted at the player
- Each zombie independently compares BFS path distance to player vs artifact
- Whichever target is closer by path distance wins (per-zombie, per-frame)
- During artifact corruption: all zombies forced to target player
- When corruption ends: all zombies revert to artifact targeting
- Player flow field recomputes when player moves to a new tile (throttled)
- Both flow fields invalidated when block solidity changes

---

## 10. Wave System

### Starting a Wave
- Press H in player mode, or click "Open the Conduit" in artifact UI
- Cannot start if: artifact corrupted, interface open, player dead, game over
- Wave counter starts at 0, increments on start

### Progression
- States: `idle` → `active` → `countdown` → `active` (loop while auto-advance on)
- Wave ends when all zombies for that wave have been spawned AND killed/absorbed
- **Auto-advance**: enabled by default when player first clicks Conduit to start wave 1
  - On wave completion: enters `countdown` state with 15-second timer
  - Timer reaches 0: next wave starts automatically via `advanceWave()`
  - Player can toggle auto-advance on/off via Conduit circle at any time
  - If auto-advance is off when a wave completes, state goes to `idle` instead of `countdown`
- Wave identity (`waveNumber`, `waveState`, `waveAutoAdvance`, `waveCountdown`) lives in `gameState`
- Wave operational data (spawn counts, timers, per-wave stats) lives in the `wave` object in zombies.js

### Spawn Timing
- First zombie: immediate
- Subsequent: timer-based, starting at 2.5s interval
- Interval decreases by 0.12s per wave
- Hard floor: 0.4 seconds minimum between spawns

---

## 11. Economy

### Currency: KJ (Kilojoules)
- Starting balance: 500 KJ
- Displayed in HUD after first artifact interaction

### Income
- Zombie kill: 100 KJ per zombie (instant payout on death)

### Costs
- Place block (build mode): 50 KJ
- Dig block (build mode): 50 KJ
- Crafting material costs: defined in Plan.md but not yet implemented in code (all materials currently free)

---

## 12. Lighting & Darkness

### Darkness
- Base overlay opacity: 0.85 (very dark)
- Ambient light reduction: 0.08 (slight visibility everywhere)
- Effective darkness in unlit areas: ~77%

### Artifact Light
- Full bright radius: 25 tiles from artifact center
- Falloff zone: 15 tiles beyond that (smooth gradient to full dark)
- Radial gradient clears the darkness overlay

### Flashlight
- Toggle: F key
- Beam length: 18 tiles in the direction the player faces
- Beam width: 8 tiles perpendicular
- Origin: player chest level, offset slightly in facing direction
- Gradient: sharp bright core, fades over 70% of beam length
- Oval-shaped light cone

### Stars
- 600 stars randomly placed in the sky above terrain
- Size: 2–5 pixels, brightness: 0.3–1.0 (random per star)
- Tiny holes punched in the darkness overlay to make them visible
- Color shifts based on game state:
  - Idle: white
  - During wave: blue tint (140, 180, 255)
  - Artifact corrupted: red shift proportional to damage

---

## 13. Intro Sequence

Plays once on game start. Player wakes up on the ground near the artifact.

### Phases
1. **Fade-in** (2.0s) — screen fades from black
2. **Lying** (1.0s) — player rendered on the ground, static
3. **Blink** — eyes blink 3 times (0.4s cycle each)
4. **Standup prompt** — "Press E to stand" displayed, waits for input
5. **Standing** (0.6s) — stand-up animation plays
6. **Done** — intro ends, normal gameplay begins

### Controls During Intro
- E key advances from prompt to standing
- F1 skips the entire intro (debug)
- Tab opens comms (can interrupt the intro)

Player cannot move during the intro. Tutorial step tracking begins on completion.

---

## 14. Comms & Story

### Comms Terminal
- Opened with Tab key (works from any game state)
- Scrolling text display, word-wrapped at 58 characters
- Closes with Tab again

### Color Coding
| Source | Color |
|--------|-------|
| Player text | Green (#88ddaa) |
| Friend text | White (#cccccc) |
| System text | Cyan (#77aacc) |
| Success | Green (#88ddaa) |
| Error | Red (#cc4444) |

### Dialogue System
- Action queue: lines (timed), choices (interactive), status updates, callbacks
- Delays between lines (0.3–2.0s typical)
- Input locked during timed sequences
- Choices navigated with up/down arrows, confirmed with Enter

### Story Content
- Opens with relay connection prompt: "Connect to Relay?" (Yes/No)
- 4 queued messages from a friend character
- 3 rounds of player choices with branching friend responses
- Ends with signal loss, sets commsComplete flag
- Story file contains executable branching logic (not yet refactored to pure data)

---

## 15. HUD

### Elements (visible after intro)
- **KJ Counter** — center-left, cyan text, "XXX KJ" (24px bold Jura). Appears after first artifact interaction.
- **Reactor State** — below KJ counter, "Reactor State = X" (18px bold Jura, cyan)
- **Wave Status** — below reactor state (18px bold Jura):
  - During countdown: "State Advancement Complete" + "Next Advancement in Xs" (two lines, warm yellow)
  - During active wave: "State Advancement Active" (red, 0.7 opacity)
- **Weapon Display** — bottom-left corner (30px margin), shows shovel pictogram or crafted weapon sprite (18px bold Jura)
- **Weapon Slot** — current/total indicator when multiple weapons exist (13px Jura)
- **Controls Button** — upper-right "?" icon

### Controls Panel
- Toggles on "?" click
- Right-aligned dropdown listing 12 control entries
- Grouped: 9 player mode controls + 3 build mode controls
- Shows key binding + action description (11px Jura)
- Semi-transparent dark blue background with border

---

## 16. Pause & Game Over

### Pause Menu
- ESC toggles pause on/off
- Semi-transparent black overlay (0.5 opacity)
- "PAUSED" in 64px white + "Press ESC to resume" in 18px gray
- All game logic and input blocked except ESC
- Game time does not advance while paused

### Game Over
- Triggers when: artifact is corrupted AND player is dead
- Dark overlay (0.7 opacity)
- "GAME OVER" in 64px red (#ff4444)
- Stats displayed: wave reached, zombies killed, survival time (seconds)
- No restart button — requires page reload

---

## 17. Save & Load

### What Persists
- **World tiles** — full tile array serialized to base64 in localStorage (`zd_world_save`)
- **Crafted weapons** — JSON array in localStorage (`zd_weapons`) with name, damage, speed, range, and sprite data URL

### What Does NOT Persist
- Game state (KJ balance, wave number, kills)
- Player position or health
- Zombie positions
- Artifact health or corruption state
- Elapsed time

### Loading Behavior
- World loads automatically on init if save data exists
- Rebuilds all chunks and flow field after load
- Weapons load on init and hot-reload every 3.0 seconds (picks up new crafted weapons)

### Debug Save Controls
- Ctrl+S: save world manually
- Ctrl+L: load world manually

---

## 18. Particles

Visual feedback system — no gameplay effect, purely cosmetic.

### Zombie Death
- 8 particles, speed 60–200 px/sec, size 3–8 px
- Colors: red and gray-blue mix
- Lifespan: 0.8 seconds with gravity and linear fade

### Player Death
- 12 particles (more dramatic), speed 80–240 px/sec, size 3–9 px
- More red-biased than zombie particles
- Lifespan: 1.2 seconds

### Block Destruction
- 5 particles, speed 40–120 px/sec, size 2–5 px
- Color matches tile type (brown/tan for earth, lighter for brick)
- Lifespan: 0.6 seconds total, 0.3s fade

### Melee Hit
- 3 particles, speed 40–120 px/sec, size 2–5 px
- Red and gray-blue, directed away from impact
- Lifespan: 0.6 seconds

---

## 19. Debug Keys

Developer-only bindings for testing. All route through gameState or system APIs.

| Key | Action |
|-----|--------|
| F1 | Force artifact corruption (HP → 0) |
| F2 | Skip comms/tutorial |
| F3 | Skip artifact boot sequence, show UI circles |
| F4 | Instant start wave |
| F5 | Skip/advance wave (kill all zombies or start new) |
| F6 | Force respawn if dead |
| F7 | Restore artifact (uncorrupt, full HP) |
| F8 | Toggle zombie player targeting |
| F9 | Clear crafted weapons, reset to shovel |
| F10 | Add 1000 KJ |
| F11 | Toggle flow field debug display |
| Backtick (`) | Toggle melee collider debug overlay (red rect) |
| Ctrl+S | Save world |
| Ctrl+L | Load world |

---

## 20. Flow Field Pathfinding

Dual flow field system — zombies navigate toward either the artifact or the player.

### Artifact Flow Field
- 8-directional BFS computed outward from all artifact tiles
- Each tile stores a direction vector pointing one step closer to the artifact
- Each tile also stores BFS depth (`dist`) for O(1) path distance lookups
- Body-height-aware: expansion checks 2-tile vertical clearance (zombie body height)
- Recomputed on world generation and whenever block solidity changes

### Player Flow Field
- Identical BFS computation, seeded from the player's current tile position
- Recomputes when the player moves to a new tile (throttled to tile-change granularity)
- Also stores `dist` per cell for path distance comparison
- Invalidated on block solidity changes (same as artifact field)

### Per-Zombie Targeting
- Each zombie compares `playerFlowField[tile].dist` vs `flowField[tile].dist`
- Whichever path distance is shorter determines which flow field the zombie follows
- During artifact corruption: all zombies forced to player field regardless of distance
- No oscillation possible — path distances are stable values, not range-boundary checks

### Breach System
- After BFS, both flow fields detect enclosed regions that zombies can't reach
- Iterative breach detection (up to 20 passes) finds the thinnest walls separating unreachable zones from reachable ones
- Breach points are marked — flyer zombies prioritize breaking blocks at these points when stuck
- Each zombie checks breach points on its active flow field (player or artifact)

### Flyer Sampling
- Each flyer samples its active flow field at 4 body points (head, feet, left-center, right-center)
- Averaged direction determines movement, creating smooth navigation around obstacles

---

## 21. Sound System

Hybrid audio system providing sound effects and ambient atmosphere.

### Architecture
- `<audio>` elements for one-shot playback (works with file:// protocol)
- Web Audio API `AudioBufferSourceNode` for pitch-shifted/time-stretched playback (requires HTTP server)
- Lazy initialization on first user click or keypress
- Missing sound files handled gracefully (silence, no errors)

### Sound Triggers

| Sound | Trigger | Notes |
|-------|---------|-------|
| Pistol Shot | Bullet fired | Slight pitch variation (±5%) |
| Melee Swing | Weapon swung | Time-stretched to match weapon speed |
| Melee Hit | Weapon hits zombie | Pitch variation (±15%) |
| Bullet Hit | Bullet hits zombie | Pitch variation (±10%) |
| Block Dig | Shovel hits block / build mode dig | Pitch variation (±10%) |
| Block Break | Block destroyed (any source) | Pitch variation (±15%) |
| Block Place | Build mode places brick | Pitch variation (±10%) |
| Zombie Death | Zombie HP reaches 0 | Wide pitch variation (±20%) |
| Player Hit | Zombie contact damage | Pitch variation (±10%) |
| Player Death | Player HP reaches 0 | Fixed pitch |
| Player Respawn | Player respawns | Fixed pitch |
| Flashlight On/Off | F key toggle | Fixed pitch, separate sounds |
| Wave Start | Wave initiated | Fixed pitch |
| Wave Complete | All wave zombies cleared | Fixed pitch |

### Ambient
- `ambient.wav` loops continuously at 15% volume
- Starts on first user interaction alongside other sounds

### API
- `playSound(name, volumeOverride, pitchOverride)` — one-shot playback
- `playSoundStretched(name, targetDuration, volumeOverride)` — resampled to target duration, pitch shifts naturally

### Sound Files
All `.wav` files stored in `v0.5/sounds/` folder.
