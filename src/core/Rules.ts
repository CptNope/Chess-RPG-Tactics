/**
 * The rules a battle is played under (0.41.0). Today there is one rule set, the campaign's; the
 * versus plan (docs/ONLINE_VERSUS.md) makes every match setting a field here, so the rules read
 * a setting instead of assuming the campaign.
 */
import type { Unit } from './types';

export interface BattleRules {
  /** Units on these teams earn JP and EXP for what they do in battle. */
  progressionTeams: readonly string[];
}

/** The campaign, side battles, the Trials and Workshop scenarios: the squad grows. */
export const CAMPAIGN_RULES: BattleRules = Object.freeze({ progressionTeams: Object.freeze(['player']) });

/** True when the unit earns JP and EXP under these rules. */
export function earnsProgress(rules: BattleRules, unit: Unit): boolean {
  return rules.progressionTeams.includes(unit.team);
}
