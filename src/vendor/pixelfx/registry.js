// The pixelfx effects this game plays (see README.md in this folder).
// pixelfx: https://github.com/patch-gg/pixelfx (MIT). Vendored at commit 5294518.

import * as e0 from "./fx/arcane/mana-burst.js";
import * as e1 from "./fx/arcane/time-stop.js";
import * as e2 from "./fx/fire/flame-pillar.js";
import * as e3 from "./fx/holy/divine-shield.js";
import * as e4 from "./fx/holy/feather-burst.js";
import * as e5 from "./fx/holy/heal.js";
import * as e6 from "./fx/holy/smite.js";
import * as e7 from "./fx/ice/icicle-fall.js";
import * as e8 from "./fx/impacts/crit-hit.js";
import * as e9 from "./fx/impacts/hit-spark.js";
import * as e10 from "./fx/lightning/lightning-strike.js";
import * as e11 from "./fx/melee/dagger-flurry.js";
import * as e12 from "./fx/melee/sword-slash.js";
import * as e13 from "./fx/nature/earth-spike.js";
import * as e14 from "./fx/nature/quake.js";
import * as e15 from "./fx/nature/root-snare.js";
import * as e16 from "./fx/shadow/grasping-hands.js";
import * as e17 from "./fx/status/haste.js";
import * as e18 from "./fx/status/poisoned.js";
import * as e19 from "./fx/status/rage.js";
import * as e20 from "./fx/status/slowed.js";

export const EFFECTS = {
  "arcane/mana-burst": e0,
  "arcane/time-stop": e1,
  "fire/flame-pillar": e2,
  "holy/divine-shield": e3,
  "holy/feather-burst": e4,
  "holy/heal": e5,
  "holy/smite": e6,
  "ice/icicle-fall": e7,
  "impacts/crit-hit": e8,
  "impacts/hit-spark": e9,
  "lightning/lightning-strike": e10,
  "melee/dagger-flurry": e11,
  "melee/sword-slash": e12,
  "nature/earth-spike": e13,
  "nature/quake": e14,
  "nature/root-snare": e15,
  "shadow/grasping-hands": e16,
  "status/haste": e17,
  "status/poisoned": e18,
  "status/rage": e19,
  "status/slowed": e20,
};
export { createFrame, clearFrame, createFx, composite, PAL } from "./core/index.js";
