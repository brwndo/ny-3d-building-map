const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function fmtNumber(value, { decimals } = {}) {
  if (value == null) return '—';
  if (decimals != null) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return Math.abs(value) >= 1000 ? intFmt.format(value) : numberFmt.format(value);
}

// Fractions in the data (0-1) render as percentages with 1 decimal place.
export function fmtPct(fraction) {
  if (fraction == null) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

export function fmtMoney(value) {
  if (value == null) return '—';
  return moneyFmt.format(value);
}

export function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Formats a metric value according to its sheet unit.
export function fmtMetricValue(value, unit) {
  if (value == null) return '—';
  if (unit === '%') return fmtPct(value);
  if (unit === '1-100') return intFmt.format(value);
  return `${fmtNumber(value)} ${unit}`;
}
