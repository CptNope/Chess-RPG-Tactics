// The summon effects (0.24.0), by the id the game plays them under: summon/<creature>.
import * as salamander from "./salamander.js";
import * as undine from "./undine.js";
import * as storm_roc from "./storm_roc.js";
import * as sylph from "./sylph.js";
import * as golem from "./golem.js";
import * as celestial from "./celestial.js";
import * as cinderwing from "./cinderwing.js";
import * as tidewyrm from "./tidewyrm.js";
import * as elder_wyrm from "./elder_wyrm.js";

export const SUMMON_EFFECTS = {
  "summon/salamander": salamander,
  "summon/undine": undine,
  "summon/storm_roc": storm_roc,
  "summon/sylph": sylph,
  "summon/golem": golem,
  "summon/celestial": celestial,
  "summon/cinderwing": cinderwing,
  "summon/tidewyrm": tidewyrm,
  "summon/elder_wyrm": elder_wyrm,
};
