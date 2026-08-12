// Circle pack: area ∝ value (radius ∝ √value), then fit into the viewport.
// Placement: largest-first, each new circle sits tangent to an existing pair
// (or the first circle), choosing the candidate closest to the origin.

const GAP = 2;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function overlaps(a, b, placed) {
  for (const other of placed) {
    if (other === b) continue;
    if (distance(a, other) < a.r + other.r + GAP - 1e-4) return true;
  }
  return false;
}

/** Place `node` tangent to `a` and `b` (two solutions); return valid candidates. */
function tangentToPair(node, a, b) {
  const r = node.r + GAP;
  const d = distance(a, b);
  const ra = a.r + r;
  const rb = b.r + r;
  if (d > ra + rb || d < Math.abs(ra - rb) || d < 1e-6) return [];

  const mid = (ra * ra - rb * rb + d * d) / (2 * d);
  const h2 = ra * ra - mid * mid;
  if (h2 < 0) return [];
  const h = Math.sqrt(h2);
  const vx = (b.x - a.x) / d;
  const vy = (b.y - a.y) / d;
  const mx = a.x + vx * mid;
  const my = a.y + vy * mid;
  const px = -vy * h;
  const py = vx * h;

  return [
    { x: mx + px, y: my + py, r: node.r },
    { x: mx - px, y: my - py, r: node.r },
  ];
}

function placeCircles(nodes) {
  if (!nodes.length) return;

  nodes[0].x = 0;
  nodes[0].y = 0;
  const placed = [nodes[0]];

  for (let i = 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    let best = null;
    let bestScore = Infinity;

    if (placed.length === 1) {
      const a = placed[0];
      // Ring of samples around the first circle.
      for (let k = 0; k < 24; k += 1) {
        const angle = (k / 24) * Math.PI * 2;
        const dist = a.r + node.r + GAP;
        const candidate = {
          x: a.x + Math.cos(angle) * dist,
          y: a.y + Math.sin(angle) * dist,
          r: node.r,
        };
        if (overlaps(candidate, a, placed)) continue;
        const score = candidate.x * candidate.x + candidate.y * candidate.y;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    } else {
      for (let j = 0; j < placed.length; j += 1) {
        for (let k = j + 1; k < placed.length; k += 1) {
          const candidates = tangentToPair(node, placed[j], placed[k]);
          for (const candidate of candidates) {
            if (overlaps(candidate, placed[j], placed)) continue;
            const score = candidate.x * candidate.x + candidate.y * candidate.y;
            if (score < bestScore) {
              bestScore = score;
              best = candidate;
            }
          }
        }
      }

      // Fallback: attach to nearest placed circle if pair search failed.
      if (!best) {
        const a = placed[0];
        const dist = a.r + node.r + GAP;
        best = { x: a.x + dist, y: a.y, r: node.r };
        for (let k = 0; k < 48; k += 1) {
          const angle = (k / 48) * Math.PI * 2;
          const anchor = placed[k % placed.length];
          const d = anchor.r + node.r + GAP;
          const candidate = {
            x: anchor.x + Math.cos(angle) * d,
            y: anchor.y + Math.sin(angle) * d,
            r: node.r,
          };
          if (overlaps(candidate, anchor, placed)) continue;
          const score = candidate.x * candidate.x + candidate.y * candidate.y;
          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
        }
      }
    }

    node.x = best.x;
    node.y = best.y;
    placed.push(node);
  }
}

function fitToViewport(nodes, width, height, padding, bottomExtra) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.r);
    minY = Math.min(minY, node.y - node.r);
    maxX = Math.max(maxX, node.x + node.r);
    maxY = Math.max(maxY, node.y + node.r);
  }

  const packW = Math.max(maxX - minX, 1);
  const packH = Math.max(maxY - minY, 1);
  const availW = Math.max(width - padding * 2, 1);
  const availH = Math.max(height - padding - bottomExtra, 1);
  const scale = Math.min(availW / packW, availH / packH);

  const offsetX = padding + (availW - packW * scale) / 2;
  const offsetY = padding + (availH - packH * scale) / 2;

  return nodes.map((node) => {
    const r = node.r * scale;
    const cx = (node.x - minX) * scale + offsetX;
    const cy = (node.y - minY) * scale + offsetY;
    return {
      id: node.id,
      feature: node.feature,
      r,
      x: cx - r,
      y: cy - r,
      width: r * 2,
      height: r * 2,
    };
  });
}

/**
 * Pack asset circles so area ∝ floorArea, fitted into width×height.
 * @returns {Array<{ id: string, feature: object, r: number, x: number, y: number, width: number, height: number }>}
 */
export function layoutAssetCircles(features, width, height, padding = 16) {
  const nodes = features
    .map((feature) => {
      const value = feature.properties.floorArea ?? 0;
      return {
        id: feature.properties.id,
        feature,
        value,
        r: value > 0 ? Math.sqrt(value) : 0,
        x: 0,
        y: 0,
      };
    })
    .filter((node) => node.r > 0)
    .sort((a, b) => b.r - a.r);

  if (!nodes.length || width < 40 || height < 40) return [];

  placeCircles(nodes);
  return fitToViewport(nodes, width, height, padding, padding + 28);
}
