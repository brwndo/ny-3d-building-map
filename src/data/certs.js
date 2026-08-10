// Certification strings arrive as free text on the BC1.1 / BC1.2 / BC2 fields
// ("LEED O+M: Existing Buildings - Gold"), so system and level have to be
// parsed back out before they can be counted or displayed.

const LEED_LEVELS = ['Certified', 'Silver', 'Gold', 'Platinum'];

export function parseLeed(value) {
  if (!value || typeof value !== 'string') return null;
  if (!/LEED/i.test(value)) return null;

  const system = /O\+?M/i.test(value) ? 'O+M' : /BD\+?C/i.test(value) ? 'BD+C' : 'Other';
  const level =
    LEED_LEVELS.find((entry) => new RegExp(entry, 'i').test(value)) ?? 'Certified';

  return { system, level, raw: value };
}

/** Format a LEED cert string for display, e.g. "LEED O+M · Silver". */
export function formatLeedLabel(value) {
  const parsed = parseLeed(value);
  if (!parsed) return value ?? 'None';
  return `LEED ${parsed.system} · ${parsed.level}`;
}

/**
 * LEED credentials across the assets in view. This is a composition readout,
 * not a goal: a level is a category, so there is nothing to be on track toward.
 */
export function computeLeedInventory(features) {
  const count = features.length;
  const levels = Object.fromEntries(LEED_LEVELS.map((level) => [level, 0]));
  let bdc = 0;
  let om = 0;
  const assetIds = new Set();

  for (const feature of features) {
    const cert = feature.properties.cert ?? {};
    const parsedList = [cert.bc11, cert.bc12].map(parseLeed).filter(Boolean);
    if (parsedList.length === 0) continue;

    assetIds.add(feature.properties.id);

    for (const parsed of parsedList) {
      if (parsed.system === 'BD+C') bdc += 1;
      if (parsed.system === 'O+M') om += 1;
    }

    // Prefer operational LEED for the per-asset level rollup when both exist.
    const levelSource =
      parsedList.find((parsed) => parsed.system === 'O+M') ?? parsedList[0];
    if (levelSource && levels[levelSource.level] != null) {
      levels[levelSource.level] += 1;
    } else {
      levels.Certified += 1;
    }
  }

  const leedCount = assetIds.size;

  return {
    totalAssets: count,
    leedCount,
    bdcCount: bdc,
    omCount: om,
    levelBreakdown: LEED_LEVELS.filter((level) => levels[level] > 0).map((level) => ({
      level,
      count: levels[level],
    })),
  };
}
