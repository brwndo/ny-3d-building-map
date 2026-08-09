import { BANDS, METRICS } from './colorScale';
import { fmtMetricValue, fmtMoney, fmtNumber, fmtPct } from './format';
import {
  compareToGoal,
  directionForMetric,
  formatGoalLine,
  isGoalMetric,
  unitForMetric,
} from './portfolioGoals';

const COVERAGE_THRESHOLD_PCT = 65;

function metricMeta(key) {
  return METRICS.find((entry) => entry.key === key);
}

function metricUnit(features, metricKey) {
  return unitForMetric(features, metricKey);
}

function sumBy(features, getValue) {
  return features.reduce((acc, feature) => {
    const value = getValue(feature.properties);
    return value == null ? acc : acc + value;
  }, 0);
}

function floorAreaWeightedAverage(features, getValue) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const feature of features) {
    const weight = feature.properties.floorArea;
    const value = getValue(feature.properties);
    if (weight == null || value == null) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function fmtSqFt(value) {
  if (value == null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M sq ft`;
  return `${fmtNumber(value)} sq ft`;
}

function fmtAssetCount(count) {
  if (count === 0) return 'No assets';
  return count === 1 ? '1 asset' : `${count} assets`;
}

function bandBreakdown(features, metricKey) {
  const counts = Object.fromEntries(BANDS.map((band) => [band.key, 0]));

  for (const feature of features) {
    const band = feature.properties.metrics?.[metricKey]?.band;
    if (band && counts[band] != null) counts[band] += 1;
  }

  return BANDS.map((band) => ({ band: band.key, count: counts[band.key] }))
    .filter(({ count }) => count > 0)
    .map(({ band, count }) => `${count} ${band}`)
    .join(' · ');
}

function hasOperationalCert(props) {
  return Boolean(props.cert?.bc12 || props.cert?.bc2);
}

function emptyStat(label, hint = 'No matching assets') {
  return { label, value: '—', hint, goal: null };
}

function withGoal(stat, currentValue, metricKey, features, portfolioGoals, now) {
  if (!isGoalMetric(metricKey) || !portfolioGoals?.[metricKey] || currentValue == null) {
    return { ...stat, goal: null };
  }
  const unit = metricUnit(features, metricKey);
  const direction = directionForMetric(features, metricKey);
  const comparison = compareToGoal(
    currentValue,
    portfolioGoals[metricKey],
    direction,
    now
  );
  if (!comparison) return { ...stat, goal: null };
  return {
    ...stat,
    goal: {
      ...comparison,
      goalLine: formatGoalLine(portfolioGoals[metricKey], unit),
      unit,
    },
  };
}

export function computeAggregateStats(visibleFeatures, portfolioGoals = null, now = new Date()) {
  const count = visibleFeatures.length;
  const totalFloorArea = count > 0 ? sumBy(visibleFeatures, (props) => props.floorArea) : null;

  if (count === 0) {
    return {
      portfolio: {
        label: 'Portfolio in view',
        value: fmtAssetCount(0),
        hint: 'Adjust filters to include assets',
        goal: null,
      },
      coverage: emptyStat('Data coverage'),
      compliance: emptyStat('LL97 exposure (2030)'),
      ghg: emptyStat(metricMeta('ghg').label),
      eui: emptyStat('EUI'),
      water: emptyStat('Water use'),
      energyStar: emptyStat(metricMeta('energyStar').label),
      certifications: emptyStat('Certifications'),
    };
  }

  const coverageAvg = floorAreaWeightedAverage(
    visibleFeatures,
    (props) => props.dataCoverage ?? props.metrics?.coverage?.currentValue
  );
  const belowCoverage = visibleFeatures.filter(
    (feature) => (feature.properties.dataCoverage ?? 0) * 100 < COVERAGE_THRESHOLD_PCT
  ).length;

  const ll97Features = visibleFeatures.filter(
    (feature) => feature.properties.compliance?.ll97Applicable === 'Yes'
  );
  const ll97Fine2030 =
    ll97Features.length > 0
      ? sumBy(ll97Features, (props) => Math.max(0, props.compliance?.fine2030 ?? 0))
      : null;
  const ll97NonCompliant = ll97Features.filter(
    (feature) => feature.properties.compliance?.status2030 === 'Non-Compliant'
  ).length;
  const ll97AtRisk = ll97Features.filter(
    (feature) => feature.properties.compliance?.status2030 === 'At Risk'
  ).length;

  const ghgTotal = sumBy(visibleFeatures, (props) => props.metrics?.ghg?.currentValue);
  const euiAvg = floorAreaWeightedAverage(
    visibleFeatures,
    (props) => props.metrics?.eui?.currentValue
  );
  const waterTotal = sumBy(visibleFeatures, (props) => props.metrics?.water?.currentValue);
  const energyStarAvg = floorAreaWeightedAverage(
    visibleFeatures,
    (props) => props.metrics?.energyStar?.currentValue ?? props.energyStarScore
  );
  const energyStarEligible = visibleFeatures.filter(
    (feature) => feature.properties.energyStarEligible
  ).length;

  const certifiedCount = visibleFeatures.filter((feature) =>
    hasOperationalCert(feature.properties)
  ).length;
  const bc11Count = visibleFeatures.filter((feature) => feature.properties.cert?.bc11).length;
  const bc12Count = visibleFeatures.filter((feature) => feature.properties.cert?.bc12).length;
  const bc2Count = visibleFeatures.filter((feature) => feature.properties.cert?.bc2).length;

  return {
    portfolio: {
      label: 'Portfolio in view',
      value: fmtAssetCount(count),
      hint: fmtSqFt(totalFloorArea),
      goal: null,
    },
    coverage: withGoal(
      {
        label: 'Data coverage',
        value: fmtPct(coverageAvg),
        hint: [
          'Floor-area weighted avg',
          `${belowCoverage} below ${COVERAGE_THRESHOLD_PCT}%`,
        ].join(' · '),
      },
      coverageAvg,
      'coverage',
      visibleFeatures,
      portfolioGoals,
      now
    ),
    compliance: {
      label: 'LL97 exposure (2030)',
      value: ll97Features.length > 0 ? fmtMoney(ll97Fine2030) : '$0',
      hint:
        ll97Features.length > 0
          ? `${ll97NonCompliant} non-compliant · ${ll97AtRisk} at risk`
          : 'No LL97-applicable assets in view',
      goal: null,
    },
    ghg: withGoal(
      {
        label: metricMeta('ghg').label,
        value: fmtMetricValue(ghgTotal, metricUnit(visibleFeatures, 'ghg')),
        hint: ['Portfolio total', bandBreakdown(visibleFeatures, 'ghg')]
          .filter(Boolean)
          .join(' · '),
      },
      ghgTotal,
      'ghg',
      visibleFeatures,
      portfolioGoals,
      now
    ),
    eui: withGoal(
      {
        label: 'EUI',
        value: fmtMetricValue(euiAvg, metricUnit(visibleFeatures, 'eui')),
        hint: ['Floor-area weighted avg', bandBreakdown(visibleFeatures, 'eui')]
          .filter(Boolean)
          .join(' · '),
      },
      euiAvg,
      'eui',
      visibleFeatures,
      portfolioGoals,
      now
    ),
    water: withGoal(
      {
        label: 'Water use',
        value: fmtMetricValue(waterTotal, metricUnit(visibleFeatures, 'water')),
        hint: ['Portfolio total', bandBreakdown(visibleFeatures, 'water')]
          .filter(Boolean)
          .join(' · '),
      },
      waterTotal,
      'water',
      visibleFeatures,
      portfolioGoals,
      now
    ),
    energyStar: withGoal(
      {
        label: metricMeta('energyStar').label,
        value: fmtMetricValue(
          energyStarAvg,
          metricUnit(visibleFeatures, 'energyStar') ?? '1-100'
        ),
        hint: ['Floor-area weighted avg', `${energyStarEligible} eligible`].join(' · '),
      },
      energyStarAvg,
      'energyStar',
      visibleFeatures,
      portfolioGoals,
      now
    ),
    certifications: {
      label: 'Certifications',
      value: certifiedCount === 1 ? '1 asset' : `${certifiedCount} assets`,
      hint: [
        'Operational / ongoing',
        `${energyStarEligible} ENERGY STAR eligible`,
        `BC1.1 ${bc11Count} · BC1.2 ${bc12Count} · BC2 ${bc2Count}`,
      ].join(' · '),
      goal: null,
    },
  };
}
