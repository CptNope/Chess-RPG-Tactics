// The pixelfx effects this game plays (see README.md in this folder).
// pixelfx: https://github.com/patch-gg/pixelfx (MIT). Vendored at commit 5294518.

import * as e0 from "./fx/arcane/mana-burst.js";
import * as e1 from "./fx/arcane/rune-circle.js";
import * as e2 from "./fx/arcane/time-stop.js";
import * as e3 from "./fx/fire/fire-tornado.js";
import * as e4 from "./fx/fire/flame-pillar.js";
import * as e5 from "./fx/holy/divine-shield.js";
import * as e6 from "./fx/holy/feather-burst.js";
import * as e7 from "./fx/holy/heal.js";
import * as e8 from "./fx/holy/smite.js";
import * as e9 from "./fx/holy/sunburst.js";
import * as e10 from "./fx/ice/icicle-fall.js";
import * as e11 from "./fx/impacts/blunt-hit.js";
import * as e12 from "./fx/impacts/crit-hit.js";
import * as e13 from "./fx/impacts/hit-spark.js";
import * as e14 from "./fx/lightning/lightning-strike.js";
import * as e15 from "./fx/melee/dagger-flurry.js";
import * as e16 from "./fx/melee/sword-slash.js";
import * as e17 from "./fx/nature/earth-spike.js";
import * as e18 from "./fx/nature/healing-bloom.js";
import * as e19 from "./fx/nature/quake.js";
import * as e20 from "./fx/nature/root-snare.js";
import * as e21 from "./fx/pickups/collect-burst.js";
import * as e22 from "./fx/shadow/grasping-hands.js";
import * as e23 from "./fx/shadow/hex-sigil.js";
import * as e24 from "./fx/shadow/soul-drain.js";
import * as e25 from "./fx/status/cursed.js";
import * as e26 from "./fx/status/haste.js";
import * as e27 from "./fx/status/poisoned.js";
import * as e28 from "./fx/status/rage.js";
import * as e29 from "./fx/status/sleep.js";
import * as e30 from "./fx/status/slowed.js";
import * as e31 from "./fx/status/stunned.js";
import * as e32 from "./fx/water/wave-crash.js";

export const EFFECTS = {
  "arcane/mana-burst": e0,
  "arcane/rune-circle": e1,
  "arcane/time-stop": e2,
  "fire/fire-tornado": e3,
  "fire/flame-pillar": e4,
  "holy/divine-shield": e5,
  "holy/feather-burst": e6,
  "holy/heal": e7,
  "holy/smite": e8,
  "holy/sunburst": e9,
  "ice/icicle-fall": e10,
  "impacts/blunt-hit": e11,
  "impacts/crit-hit": e12,
  "impacts/hit-spark": e13,
  "lightning/lightning-strike": e14,
  "melee/dagger-flurry": e15,
  "melee/sword-slash": e16,
  "nature/earth-spike": e17,
  "nature/healing-bloom": e18,
  "nature/quake": e19,
  "nature/root-snare": e20,
  "pickups/collect-burst": e21,
  "shadow/grasping-hands": e22,
  "shadow/hex-sigil": e23,
  "shadow/soul-drain": e24,
  "status/cursed": e25,
  "status/haste": e26,
  "status/poisoned": e27,
  "status/rage": e28,
  "status/sleep": e29,
  "status/slowed": e30,
  "status/stunned": e31,
  "water/wave-crash": e32,
};
export { createFrame, clearFrame, createFx, composite, PAL } from "./core/index.js";
