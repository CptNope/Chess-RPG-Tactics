// The pixelfx effects this game plays (see README.md in this folder).
// pixelfx: https://github.com/patch-gg/pixelfx (MIT). Vendored at commit 5294518.

import * as e0 from "./fx/arcane/mana-burst.js";
import * as e1 from "./fx/arcane/rune-circle.js";
import * as e2 from "./fx/arcane/time-stop.js";
import * as e3 from "./fx/explosions/smoke-bomb.js";
import * as e4 from "./fx/fire/fire-tornado.js";
import * as e5 from "./fx/fire/flame-pillar.js";
import * as e6 from "./fx/holy/divine-shield.js";
import * as e7 from "./fx/holy/feather-burst.js";
import * as e8 from "./fx/holy/heal.js";
import * as e9 from "./fx/holy/smite.js";
import * as e10 from "./fx/holy/sunburst.js";
import * as e11 from "./fx/ice/frost-nova.js";
import * as e12 from "./fx/ice/icicle-fall.js";
import * as e13 from "./fx/impacts/blunt-hit.js";
import * as e14 from "./fx/impacts/bullet-impact.js";
import * as e15 from "./fx/impacts/crit-hit.js";
import * as e16 from "./fx/impacts/heavy-landing.js";
import * as e17 from "./fx/impacts/hit-spark.js";
import * as e18 from "./fx/lightning/lightning-strike.js";
import * as e19 from "./fx/lightning/thunderclap.js";
import * as e20 from "./fx/melee/claw-swipe.js";
import * as e21 from "./fx/melee/dagger-flurry.js";
import * as e22 from "./fx/melee/hammer-smash.js";
import * as e23 from "./fx/melee/sword-slash.js";
import * as e24 from "./fx/melee/thrust.js";
import * as e25 from "./fx/melee/uppercut.js";
import * as e26 from "./fx/melee/whip-crack.js";
import * as e27 from "./fx/nature/earth-spike.js";
import * as e28 from "./fx/nature/healing-bloom.js";
import * as e29 from "./fx/nature/quake.js";
import * as e30 from "./fx/nature/root-snare.js";
import * as e31 from "./fx/pickups/collect-burst.js";
import * as e32 from "./fx/projectiles/arrow.js";
import * as e33 from "./fx/projectiles/bullet-tracer.js";
import * as e34 from "./fx/projectiles/muzzle-pistol.js";
import * as e35 from "./fx/projectiles/muzzle-shotgun.js";
import * as e36 from "./fx/shadow/grasping-hands.js";
import * as e37 from "./fx/shadow/hex-sigil.js";
import * as e38 from "./fx/shadow/soul-drain.js";
import * as e39 from "./fx/status/cursed.js";
import * as e40 from "./fx/status/poisoned.js";
import * as e41 from "./fx/status/rage.js";
import * as e42 from "./fx/status/sleep.js";
import * as e43 from "./fx/status/slowed.js";
import * as e44 from "./fx/status/stunned.js";
import * as e45 from "./fx/water/wave-crash.js";

export const EFFECTS = {
  "arcane/mana-burst": e0,
  "arcane/rune-circle": e1,
  "arcane/time-stop": e2,
  "explosions/smoke-bomb": e3,
  "fire/fire-tornado": e4,
  "fire/flame-pillar": e5,
  "holy/divine-shield": e6,
  "holy/feather-burst": e7,
  "holy/heal": e8,
  "holy/smite": e9,
  "holy/sunburst": e10,
  "ice/frost-nova": e11,
  "ice/icicle-fall": e12,
  "impacts/blunt-hit": e13,
  "impacts/bullet-impact": e14,
  "impacts/crit-hit": e15,
  "impacts/heavy-landing": e16,
  "impacts/hit-spark": e17,
  "lightning/lightning-strike": e18,
  "lightning/thunderclap": e19,
  "melee/claw-swipe": e20,
  "melee/dagger-flurry": e21,
  "melee/hammer-smash": e22,
  "melee/sword-slash": e23,
  "melee/thrust": e24,
  "melee/uppercut": e25,
  "melee/whip-crack": e26,
  "nature/earth-spike": e27,
  "nature/healing-bloom": e28,
  "nature/quake": e29,
  "nature/root-snare": e30,
  "pickups/collect-burst": e31,
  "projectiles/arrow": e32,
  "projectiles/bullet-tracer": e33,
  "projectiles/muzzle-pistol": e34,
  "projectiles/muzzle-shotgun": e35,
  "shadow/grasping-hands": e36,
  "shadow/hex-sigil": e37,
  "shadow/soul-drain": e38,
  "status/cursed": e39,
  "status/poisoned": e40,
  "status/rage": e41,
  "status/sleep": e42,
  "status/slowed": e43,
  "status/stunned": e44,
  "water/wave-crash": e45,
};
export { createFrame, clearFrame, createFx, composite, PAL } from "./core/index.js";
