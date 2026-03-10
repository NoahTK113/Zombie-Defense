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

### Iron Melee (~350pts, available Round 1)
- Pieces: 2x Iron Block + 1x Composite Grip
- Iron Block: ~125pts, Composite Grip: ~150pts
- Basic blunt weapons (clubs, hammers)

### Steel Sharp Melee (~650pts, available Round 2)
- Pieces: 2x Steel Block + 1x Composite Grip
- Steel Block: ~250pts
- Sharp weapons (daggers, swords)

### Plasma Weapon (~2,250pts, available Round 4)
- Pieces: 6x Framing (100pts ea) + Grip (150pts) + Power Cell (500pts) + Electrode (500pts) + Pinch Coil (500pts)
- Unlimited ammo powered by Power Cell
- Creative crafting — any configuration of pieces

### Beam Weapon (available Round 5+)
- Pieces: Power Cell, Emitter, Mirrors, Collimator, Framing
- Mirrors redirect beams, Collimator straightens all incoming rays
- Creative spatial crafting — build custom beam patterns
- Pricing TBD during playtesting

### Universal Pieces
- **Framing:** 100pts each — structural pieces placed on tile edges and diagonals

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
2. [x] **Physics-based knockback** — Melee knockback derived from `swingWeight × range`. Separate knockVx/knockVy channel on zombies (bypasses velocity clamping). Decayed by zombie's own acceleration. Wall collisions zero knockback on contact axis.
3. [x] **Increase base weapon speed** — `MELEE_SWING_SPEED_MULT` (0.7) scales all swing durations. `MELEE_MIN_SWING_DURATION` (0.15s) floor. Crafting stats show effective speed.
4. [x] **Cursor-directed swing arc** — Aim angle stored at swing start. 230° arc (`MELEE_SWING_ARC`) centered on cursor direction. Hermite easing with asymmetric velocity (20% start, 30% end, peak past midpoint). Left click = CCW, right click = CW.
5. [x] **Directional knockback** — Knockback 45° between swing tangent and radial (outward from pivot). Scaled by instantaneous angular velocity from easing curve and grip distance ratio.
6. [x] **Same-direction cooldown** — After swing, cooldown of `duration × MELEE_SAME_DIR_COOLDOWN` blocks same direction only. Opposite direction swings skip cooldown (encourages alternating).
7. [x] **Screen shake on melee hit** — Random camera offset (±`SCREEN_SHAKE_INTENSITY` px) decaying over `SCREEN_SHAKE_DURATION` seconds. Triggered per hit.
8. [x] **Swing trail** — Fading tapered polygon trailing weapon tip. 0.2s fade, 0.35 peak alpha. Lives in combat.js, drawn by renderer before lighting.
9. [x] **Variable grip range (choke-up)** — Cursor distance from pivot determines weapon reach per swing. Close clicks = short range, far clicks = full reach. Collider, sprite, trail, and knockback all adjust. Collider covers steel + tip buffer only.
10. [x] **Weapon collider overhaul** — Melee uses rotated-rect-vs-AABB (SAT), same zombie AABB as bullets. `MELEE_HIT_PADDING` expands zombie hitbox for melee. `MELEE_COLLIDER_TIP_BUFFER` extends past weapon tip. Debug overlay (backtick key) shows collider in red.
11. [x] **Absorbing zombie collision fix** — Absorbing zombies no longer skip player collision. Comment guard prevents regression.
12. [ ] **Dash mechanic** — Double-tap directional key to dash. Dash state in player.js. Works while swinging or not. Needs tuning.
13. [ ] **Hitstop (hit freeze)** — Freeze game for 1-2 frames on melee hit. hitPauseTimer in main.js skips update when > 0.
14. [ ] **Melee lunge** — Small forward impulse toward cursor on swing start. Adds momentum, can pair with dash.
15. [ ] **Swing animation variants** — 2-3 random swing patterns. Randomly selected at swing start.

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

## 10. Zombie Player Targeting ✓ DONE
- [x] Dual flow field system: artifact + player, both with BFS path distance
- [x] Per-zombie targeting via path distance comparison (closer target wins)
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
- [x] After a wave completes, next wave starts automatically after 15-second countdown
- [x] Enabled by default when player clicks Conduit (artifact circle 3) to start first wave
- [x] Player can toggle auto-advance off/on via Conduit circle during any wave state
- [x] Conduit label updates dynamically: "Advance State" / "Resume Advance" / "Pause Advance"
- [x] HUD shows countdown timer ("Next wave in Xs") and wave status ("Wave active")
- [x] Wave identity (waveNumber, waveState, waveAutoAdvance, waveCountdown) lives in gameState

---

## 14. Zombie Variety & Targeting
- [ ] **Player-hunter zombie variant** — Random zombies that only target the player (ignore artifact). Prevents player from safely turtling behind walls.
- [ ] **Block-breaker zombie variant** — Zombies that always destroy blocks on contact. Forces player to actively defend, not just wall off.
- [ ] **Bug fix: artifact targeting** — Zombies only path toward upper-left corner of artifact instead of spreading across all artifact tiles. Fix flow field seed to include all artifact tile positions.

---

## 15. Melee vs Blocks
- [ ] **Swing stops on block contact** — Melee weapons slow down or stop their swing arc when hitting a solid block. Prevents unrealistic phasing through terrain.

---

## 16. Balance & Polish
- [ ] Tune block health values
- [ ] Tune weapon damage, range, cooldown per type
- [ ] Tune zombie health, speed, pathfinding aggression per wave
- [ ] Tune point economy across rounds 1–10
- [ ] Playtest and iterate on dozens of parameters
- [ ] Ensure round 1 is survivable with shovel + basic defenses
- [ ] Ensure plasma/beam weapons feel like meaningful upgrades

---

## Publishing Target
- Platform: itch.io (free, no barrier)
- Later: Steam ($100 app fee, recouped at $1,000 revenue)
- Format: browser-based HTML5, no download required
