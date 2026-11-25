/**
 * Dice (0.41.0). A battle owns one seeded generator, and every roll in it (hit, crit, status,
 * reaction) comes from that generator, so the same seed and the same choices give the same
 * battle. That's what replays, the balance sim and, later, a server that rolls for every player
 * need.
 */

/** A small, fast seeded generator (mulberry32). Returns numbers in [0, 1). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a new battle. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
