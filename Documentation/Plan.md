# Zombie Defense — Pre-Release Plan

*Tasks required before initial publication. Architecture doc is separate (ARCHITECTURE.md).*

---

## 1. Architecture
- [ ] Finish modular refactor — align codebase with ARCHITECTURE.md

---

## 2. Block Types & Economics

| Block | Cost | Notes |
|---|---|---|
| Cinder Block | 50pts | Starting block, cheap, low health |
| Stone | 100pts | Mid-tier |
| Reinforced Concrete | 300pts | Tough |
| Steel | 400pts | Strongest standard block |
| Electrified Steel | 400pts + Power Cell | Damages and slows zombies slightly |

**Power Cell:** 5,000pts — powers up to 20 electrified steel blocks. Persistent until destroyed by zombies.

---

## 3. Weapon Types & Crafting Economics

### Iron Melee (available Round 1)
- Iron: 350 KJ/cell (75 damage per cell, each cell = one wave of dominance)
- Composite grip: 420 KJ/cell (improves swing speed, 1.25× damage bonus)
- Basic 2-cell club: ~700 KJ, 150 damage (2 HTK wave 2)
- Larger weapons scale linearly: 3 cells = 225 dmg, 6 cells = 450 dmg, etc.

### Steel Melee (future — material exists, not yet functional)
- Steel: 700 KJ/cell
- STEEL_DAMAGE_PER_CELL: TBD (expected ~200, making each steel cell worth ~2.5 iron cells)

### Beam Weapon (available Round 5+)
- Power Cell: 2,100 KJ, Emitter: 2,100 KJ
- Mirror: 700 KJ, Diagonal Mirror: 700 KJ, Lens: 1,400 KJ
- Mirrors redirect beams, Lens focuses incoming rays
- Creative spatial crafting — build custom beam patterns
- Damage/stats TBD during playtesting

---

## 4. Crafting Interface
- [ ] Crafting interface working for all four weapon types
- [ ] Framing pieces functional on tile boundaries and diagonals
- [ ] Weapon output saves to Inventory via IndexedDB (persistent across sessions)

---

## 5. Movement
- [ ] Jump jet / jump suit system
- [ ] Adds vertical mobility and skill expression in combat
- [ ] Required for elevator puzzle quest

---

## 6. Combat Feel
Ordered implementation plan:

1. [x] **Key rebinding** — Tab cycles weapons, C opens comms. Updated input.js, comms.js, player.js, hud.js, renderer.js.
2. [x] **Physics-based knockback** — Melee knockback derived from `swingWeight × range`. Separate knockVx/knockVy channel on zombies (bypasses velocity clamping). Velocity-proportional drag decay (base 200 + 0.7× speed). Wall impact damage above 450 px/s (speed × 0.5 coeff).
3. [x] **Increase base weapon speed** — `MELEE_SWING_SPEED_MULT` (0.7) scales all swing durations. `MELEE_MIN_SWING_DURATION` (0.15s) floor. Crafting stats show effective speed.
4. [x] **Cursor-directed swing arc** — Aim angle stored at swing start. 230° arc (`MELEE_SWING_ARC`) centered on cursor direction. Hermite easing with asymmetric velocity (20% start, 30% end, peak past midpoint). Left click = CCW, right click = CW.
5. [x] **Directional knockback** — Knockback 45° between swing tangent and radial (outward from pivot). Scaled by instantaneous angular velocity from easing curve and grip distance ratio.
6. [x] **Same-direction cooldown** — After swing, cooldown of `duration × MELEE_SAME_DIR_COOLDOWN` blocks same direction only. Opposite direction swings skip cooldown (encourages alternating).
7. [x] **Screen shake on melee hit** — Random camera offset (±`SCREEN_SHAKE_INTENSITY` px) decaying over `SCREEN_SHAKE_DURATION` seconds. Triggered per hit.
8. [x] **Swing trail** — Fading tapered polygon trailing weapon tip. 0.2s fade, 0.35 peak alpha. Lives in combat.js, drawn by renderer before lighting.
9. [x] **Variable grip range (choke-up)** — Cursor distance from pivot determines weapon reach per swing. Close clicks = short range, far clicks = full reach. Collider, sprite, trail, and knockback all adjust. Collider covers steel + tip buffer only.
10. [x] **Weapon collider overhaul** — Melee uses rotated-rect-vs-AABB (SAT), same zombie AABB as bullets. `MELEE_HIT_PADDING` expands zombie hitbox for melee. `MELEE_COLLIDER_TIP_BUFFER` extends past weapon tip. Debug overlay (backtick key) shows collider in red.
11. [x] **Absorbing zombie collision fix** — Absorbing zombies no longer skip player collision. Comment guard prevents regression.
12. [x] **Dash mechanic** — Shift + direction for fuel-based burst thruster. Dash-strike: 1.5× damage and 1.5× knockback on melee hits during dash. 0.15s invulnerability per dash-strike hit.
13. [ ] **Hitstop (hit freeze)** — Freeze game for 1-2 frames on melee hit. hitPauseTimer in main.js skips update when > 0.
14. [ ] **Melee lunge** — Small forward impulse toward cursor on swing start. Adds momentum, can pair with dash.
15. [ ] **Swing animation variants** — 2-3 random swing patterns. Randomly selected at swing start.
16. EXPIEREMENT: Player moves while swinging large heavy weapons. Realistic two masses connected by a rigid bar physics.

---

## 7. Sound Design
**Vibe:** Dark, ethereal, lonely. Minimal ambient layers, no constant background music.

**Sound system implemented** — hybrid `<audio>` + Web Audio API in `js/sound.js`. 15 sound triggers wired. Recorded with mic + Audacity, exported as 16-bit WAV normalized to -3 dB.

- [x] Sound system infrastructure (playSound, playSoundStretched, ambient loop)
- [x] Ambient atmosphere
- [x] Melee swing (time-stretched to weapon speed)
- [x] Melee hit / zombie hit
- [x] Zombie death
- [x] Player hit
- [x] Block dig (shovel hit on block)
- [x] Block break
- [ ] Pistol shot
- [ ] Bullet hit
- [ ] Block place
- [ ] Flashlight toggle
- [ ] Wave start
- [ ] Wave complete
- [ ] Player death
- [ ] Player respawn
- [ ] Iron club hit — heavy metallic impact
- [ ] Steel sharp hit — sharp crack
- [ ] Beam hit — sci-fi zap/hum
- [ ] Plasma hit — electric crackle/sizzle
- [ ] Crafting grid tap — high pitched click
- [ ] Comms interface — typewriter clicks, bleeps

**Tools:** Mic + Audacity for recording, BFXR/sfxr.me as backup

---

## 8. World & Terrain
- [ ] More variable terrain: steeper hills, cliffs
- [ ] One new terrain block type
- [ ] Data terminal POI placed somewhere in the world (used in quest)
- [ ] Elevator structure POI (used in quest)

---

## 9. Quest: Unlock Building Mode
A three-beat quest inspired by Myst/Outer Wilds. Simple but satisfying.

**Beat 1 — First Clue (Comms)**
- Opening comms conversation contains a cryptic hint pointing toward a location

**Beat 2 — Data Terminal**
- Player explores world, finds a lost data terminal
- Contains second clue: information needed to solve the elevator puzzle

**Beat 3 — Elevator Structure**
- Tall structure with exterior elevator
- Riding elevator up reveals a locked door (red herring)
- Real entrance: trap door underneath elevator shaft — only accessible after raising elevator
- Player jumps down, enters trap door, climbs stairs inside, unlocks door
- Code to activate building mode found inside building

**Activation**
- Player returns to artifact, inputs code
- Building mode unlocked

---

## 10. Zombie Targeting ✓ DONE
- [x] Dual flow field system: artifact + player, both with BFS path distance
- [x] Normal zombies (60%) always target artifact; hunters (40%) always target player
- [x] Player flow field recomputes on tile-granularity movement
- [x] Corruption forces all zombies to player; revert when corruption ends
- [x] Breach detection on both flow fields
- [x] Both fields invalidated on block solidity changes

---

## 11. Lighting Update
- [ ] Update lighting system (details TBD)

---

## 12. Weapons, Inventory & HUD Update
- [ ] Update weapons and inventory system (details TBD)
- [ ] Update HUD to reflect inventory/weapon changes

---

## 13. Wave Auto-Advance ✓ DONE
- [x] After a wave completes, next wave starts automatically after 60-second countdown
- [x] Enabled by default when player clicks Conduit (artifact circle 3) to start first wave
- [x] Player can toggle auto-advance off/on via Conduit circle during any wave state
- [x] Conduit label updates dynamically: "Advance State" / "Resume Advance" / "Pause Advance"
- [x] HUD shows countdown timer ("Next wave in Xs") and wave status ("Wave active")
- [x] Wave identity (waveNumber, waveState, waveAutoAdvance, waveCountdown) lives in gameState

---

## 14. Zombie Variety & Targeting ✓ DONE
- [x] **Player-hunter zombie variant** — 40% of spawns target the player exclusively (ignore artifact). Prevents turtling behind walls.
- [x] **Block-breaker zombie variant** — 10% of spawns move in straight lines and destroy any block on contact. Forces active wall defense.
- [ ] **Bug fix: artifact targeting** — Zombies only path toward upper-left corner of artifact instead of spreading across all artifact tiles. Fix flow field seed to include all artifact tile positions.

---

## 15. Melee vs Blocks
- [ ] **Swing stops on block contact** — Melee weapons slow down or stop their swing arc when hitting a solid block. Prevents unrealistic phasing through terrain.

---

## 16. Balance & Polish
- [x] **Zombie HP curve** — Linear scaling: `150 × wave`. Clean, predictable, each iron cell = one wave of dominance
- [x] **Shovel rebalance** — Damage 75 (2 HTK wave 1), knockback 300, swing 0.35s. All stats hardcoded, not formula-derived
- [x] **Crafted weapon damage rework** — Damage = cell count × material damage per cell (iron = 75/cell), not log(swingWeight). Handle gives 1.25× damage bonus. Swing weight only drives speed and knockback, not damage
- [x] **Crafting economy** — Material costs: Iron 350, Composite 420, Steel 700, Mirror 700, Diag Mirror 700, Lens 1400, Power Cell 2100, Emitter 2100. Total cost displayed in preview, deducted on save
- [x] **Knockback as fun stat** — Base knockback of 300 on all crafted weapons + swing-weight bonus. Knockback is generous across all tiers (fun) while damage is the progression gate
- [x] **Brick refund** — Removing bricks in build mode refunds 50 KJ
- [x] **Dash-strike tuning** — Knockback multiplier reduced from 2.0× to 1.5×
- [x] **Knockback drag system** — Velocity-proportional deceleration replaces constant decay. `KNOCKBACK_BASE_DECAY` (200) + `KNOCKBACK_DRAG` (0.7) × speed. High-speed launches brake hard initially, coast to a stop
- [x] **Wall impact damage** — Zombies take `speed × 0.5` damage when hitting walls during knockback above 450 px/s. Rewards positioning and wall-building strategy
- [x] **Spawn pacing overhaul** — Base spawn interval 3.0s (was 2.5s), decay 0.1s/wave (was 0.3s), floor 0.1s (was 0.4s). Max 35 zombies alive at once (CoD-style cap). Late rounds become sustained combat, not burst overwhelm
- [x] **Intermission timer** — 60 seconds between waves (was 15s). Enough time to craft, build, and plan
- [x] **Player invuln** — 0.5 seconds after hit (was 0.2s). Max 2 hits/sec prevents instant death in crowds
- [x] **Interface safety net** — All UI overlays auto-close on player hit or zombie absorption
- [x] **Normal zombie targeting** — Normal zombies always target artifact (no longer compare path distances). Hunters always target player. Symmetric, predictable
- [ ] Tune block health values
- [ ] Tune point economy across rounds 1–10 (ongoing playtesting)
- [ ] Ensure plasma/beam weapons feel like meaningful upgrades
- [ ] Add steel damage per cell constant when steel weapons become functional

---

## Publishing Target
- Platform: itch.io (free, no barrier)
- Later: Steam ($100 app fee, recouped at $1,000 revenue)
- Format: browser-based HTML5, no download required
