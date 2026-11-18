# ADR 0007: Web Audio API Retro 16-Bit Sound Synthesis

## Status
**Accepted**

## Date
2026-11-17

## Context
Audio is essential for game feedback (slashes, spells, critical strikes, turn alerts, victory fanfares). Standard approaches use external `.wav` or `.mp3` files, which introduce risks:
1. External asset loading latency and potential 404s when paths vary across GitHub Pages or subdomains.
2. Asset licensing and file size bloat.
3. Audio autoplay restrictions in modern browsers before user interaction.

## Decision
We implemented a self-contained **Web Audio API Synthesizer** in `src/audio/SoundEffects.ts`:
- Generates 16-bit sound effects procedurally using oscillators (`square`, `sawtooth`, `sine`, `triangle`), white noise generators, and biquad filters.
- Defers context initialization until first user interaction to comply with browser autoplay policies.
- Provides a persistent mute/unmute state with a top-bar HUD button (`🔊 SFX` / `🔇 MUTED`).

## Consequences
### Positive
- Zero external audio files required; zero download latency.
- Instant, authentic retro chiptune and 16-bit sound aesthetic matching *Final Fantasy Tactics*.
- Fully functional offline and under any static host environment.

### Negative
- Complex polyphonic background music is harder to synthesize procedurally than simple one-shot SFX; full musical tracks will benefit from Tracker/MIDI playback in future phases.
