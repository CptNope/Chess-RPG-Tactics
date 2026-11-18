# ADR 0014: Reaction Abilities, Procedural BGM Synthesizer, Battle Chronicle, and LocalStorage Persistence

## Status
Accepted

## Context
In *Final Fantasy Tactics*, tactical combat depth is enriched by:
1. **Dynamic Reaction Abilities**: When characters take damage or survive fatal strikes, their equipped reaction ability automatically intervenes (Counters, Parries, Auto-Potion, Speed Save, Dragonheart defiance).
2. **Atmospheric Musical Score**: Heroic martial music during battle, reflective calm during dialogue, and triumphant fanfares upon victory.
3. **Combat Transparency**: Clear, verifiable chronicle of hit chances, damage calculations, and reaction triggers.
4. **Campaign & Squad Persistence**: Allowing players to save their customized jobs, equipment loadouts, and campaign progress across browser sessions.

## Decision

### 1. Dynamic Reaction Ability Engine (`src/core/CombatEngine.ts`)
- Implemented `ReactionTrigger` evaluation within `executeAttack`:
  - **Knight Weapon Guard (`kn_parry`)**: Front-facing physical attacks undergo a $30\%$ deflection roll, canceling damage on parry.
  - **Squire Counter Tackle (`sq_counter_tackle`)**: Melee range retaliatory shoulder check for $0.55\times$ Attack power with visual lunge and recoil.
  - **White Mage Auto-Potion (`wm_auto_potion`)**: Automatic $+30\text{ HP}$ restorative heal upon taking damage.
  - **Archer Speed Save (`ar_speed_save`)**: Permanent $+2$ Speed boost per hit sustained during combat.
  - **Dragoon Dragonheart (`dr_dragonheart`)**: Defies death upon taking fatal damage, preserving the Dragoon at $1\text{ HP}$ and granting Protect.
  - **Black Mage Arcane Retaliation (`bm_magic_counter`)**: Retaliates with an explosive magic missile for $0.6\times$ Magic power.
  - **Time Weaver Critical Quick (`tm_critical_quick`)**: Seizes the next active turn immediately ($\text{CT} = 100$) when HP falls below $35\%$.

### 2. Procedural Web Audio API Chiptune Sequencer (`src/audio/MusicSynthesizer.ts`)
- Engineered a zero-dependency, 4-voice procedural audio tracker:
  - **Track 1 (`battle`)**: 136 BPM tactical march in D Minor with a driving triangle bassline, square wave chord arpeggios, high-pass noise snare/hat percussion, and a heroic lead melody.
  - **Track 2 (`victory`)**: 118 BPM C Major triumphant fanfare with multi-oscillator brass chord voicings.
  - **Track 3 (`dialogue`)**: 104 BPM contemplative harp arpeggios and low sub-bass pad tones.
- Mute state and track switching are hooked into battle lifecycle events and the top HUD control ribbon.

### 3. Real-Time Battle Chronicle & Reaction Log (`src/ui/UIManager.ts` & `index.html`)
- Added `#combat-log-drawer` slide-up parchment drawer.
- Color-coded entry categorizations:
  - `turn` (blue): Active unit CT turn start announcements.
  - `attack` (slate): Hit rolls, facing bonuses (e.g. `REAR +30%`), and damage.
  - `crit` (yellow): Critical hit notifications.
  - `reaction` (orange): Immediate notification of Counter, Parry, Auto-Potion, or Dragonheart triggers.
  - `heal` / `spell` (green/purple): Restoration and status applications.
  - `defeat` (crimson): Unit elimination logs.

### 4. LocalStorage Squad & Campaign Persistence (`src/core/SaveManager.ts`)
- Added `SaveManager` to serialize:
  - Campaign chapter progression (`currentChapterId`).
  - Player squad levels, JP per job class, unlocked skills, 5-slot equipped skills, and 5-slot equipment gear.
  - Custom map layouts sculpted in the 3D Map Editor.
- Added "💾 Save" and "📂 Load" buttons to the HUD with visual banner toasts.

## Consequences
- **Positive**:
  - The tactical loop reaches authentic *Final Fantasy Tactics* depth with counter-attacks and dynamic reaction interventions.
  - Procedural BGM brings cinematic nostalgia with zero downloaded audio asset files.
  - Complete battle transparency and full save-state retention across browser restarts.
- **Negative**:
  - Browser Autoplay restrictions require the AudioContext to awaken upon first user interaction (click/touch), handled gracefully via lazy initialization.
