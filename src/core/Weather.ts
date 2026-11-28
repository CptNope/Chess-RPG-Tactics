/**
 * Weather (0.55.0): a battle can be fought in rain, snow or fog. It's set for the whole battle,
 * on the battle's own copy of the map (`MapData.weather`), so the forecast, pathing, the AI, the
 * balance sim and a server all read it from the grid.
 *
 * - Rain: fire hits 25% softer and lightning 25% harder; nothing burns (no embers, the map's own
 *   are out for the battle).
 * - Snow: ice hits 25% harder and fire 15% softer; everyone's Move is 1 less (at least 2).
 * - Fog: blows from more than 2 tiles away are 15 points less likely to land.
 */
import type { Ability, TileData } from './types';

export type WeatherKind = 'rain' | 'snow' | 'fog';
export const WEATHER_KINDS: WeatherKind[] = ['rain', 'snow', 'fog'];

export const WEATHER: Record<WeatherKind, { name: string; icon: string; blurb: string }> = {
  rain: { name: 'Rain', icon: '☔', blurb: 'Fire is weaker and lightning stronger, and nothing burns.' },
  snow: { name: 'Snow', icon: '❄', blurb: 'Ice is stronger and fire weaker, and everyone moves 1 less.' },
  fog: { name: 'Fog', icon: '🌫', blurb: 'Blows from more than 2 tiles away land less often.' }
};

/** How much harder (or softer) a damaging ability of this element hits in this weather. */
export function weatherPower(weather: WeatherKind | undefined, element: Ability['element']): number {
  if (weather === 'rain') return element === 'fire' ? 0.75 : element === 'lightning' ? 1.25 : 1;
  if (weather === 'snow') return element === 'ice' ? 1.25 : element === 'fire' ? 0.85 : 1;
  return 1;
}

/** Points off the chance to hit from `distance` tiles away. */
export const FOG_RANGE = 2;
export const FOG_PENALTY = 15;
export const weatherHit = (weather: WeatherKind | undefined, distance: number): number => (weather === 'fog' && distance > FOG_RANGE ? -FOG_PENALTY : 0);

/** A unit's Move in this weather. */
export const weatherMove = (weather: WeatherKind | undefined, move: number): number => (weather === 'snow' && move > 0 ? Math.max(2, move - 1) : move);

/** True when fire can leave embers in this weather. */
export const canBurn = (weather: WeatherKind | undefined): boolean => weather !== 'rain';

/** Sets a battle's weather on its copy of the map: rain puts out the map's own embers. */
export function applyWeather(map: { tiles: TileData[]; weather?: WeatherKind }, weather: WeatherKind | undefined): void {
  if (weather) map.weather = weather;
  else delete map.weather;
  if (weather === 'rain') for (const t of map.tiles) if (t.hazard === 'embers') delete t.hazard;
}
