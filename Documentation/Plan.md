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
- [ ] Weighted melee with cooldown/commitment (no spam)
- [ ] Movement integrated with attack feel
- [ ] Hit feedback: knockback, screen shake, visual effect on impact
- [ ] Each weapon type feels distinct

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

## 13. Wave Auto-Advance
- [ ] After a wave completes, next wave starts automatically after 15-second gap
- [ ] Enabled by default when player starts first wave
- [ ] Player can toggle "Pause State Advancement" in artifact UI to stop auto-advance
- [ ] Toggling back on resumes auto-advance behavior

---

## 14. Balance & Polish
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
