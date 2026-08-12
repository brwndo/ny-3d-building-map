"""Bump WT1 water use on selected assets so Water vs Building Type Cohorts
is not 100% under-target.

Edits `Enertiv Product Management/25-asset-level-esg-data-NY.xlsx` in place via
sheet XML (same approach as `add_twelve_month_column.py`): Asset-Level Data
column T holds the raw WT1 gallons; Baseline & Targets Current Value / progress
/ variance / status are formulas that reference it, so their cached <v> values
must be refreshed for `prepare_data.py` (data_only=True).

Re-run:  .venv/bin/python scripts/bump_water_cohort_sample.py
Then:    .venv/bin/python scripts/prepare_data.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Enertiv Product Management", "25-asset-level-esg-data-NY.xlsx")
BACKUP = XLSX.replace(".xlsx", ".backup.xlsx")
GEOJSON = os.path.join(ROOT, "public", "data", "buildings.geojson")

ASSET_SHEET = "xl/worksheets/sheet1.xml"
BASELINE_SHEET = "xl/worksheets/sheet2.xml"
SHARED = "xl/sharedStrings.xml"

# Must match src/data/goalPrograms.js WATER_COHORT_* used by the app.
WATER_COHORT_GAL_PER_SF = {
    "Manufacturing": 22,
    "Cold Storage": 14,
    "Flex Industrial": 12,
    "Light Industrial": 11,
    "Logistics/Cross-dock": 9,
    "Warehouse/Distribution": 8,
    "Mixed-Use Residential/Commercial": 16,
    "Unknown": 12,
}
WATER_COHORT_REDUCTION = 0.1

# Multipliers vs the cohort −10% bar (gal). Diverse types; leaves ~60% under.
OVER_BAR_MULTIPLIER = {
    "NY-001": 1.25,
    "NY-004": 1.08,
    "NY-005": 1.22,
    "NY-007": 1.35,
    "NY-012": 1.12,
    "NY-014": 1.20,
    "NY-015": 1.30,
    "NY-016": 1.15,
    "NY-018": 1.40,
    "NY-023": 1.10,
    "NY-026": 1.28,
    "NY-029": 1.18,
}


def shared_strings(xml: bytes) -> list[str]:
    """Parse sharedStrings.xml with ElementTree so rich-text <si> stay aligned."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(xml)
    out = []
    for si in root.findall("m:si", ns):
        out.append("".join(t.text or "" for t in si.findall(".//m:t", ns)))
    return out


def cell_re(ref: str) -> re.Pattern[str]:
    return re.compile(rf'<c r="{ref}"[^>]*>.*?</c>', re.S)


def replace_numeric_v(cell_xml: str, value: float) -> str:
    """Keep attributes/formula; rewrite only the cached <v>."""
    text = f"{value:.10g}"
    if "<v>" in cell_xml:
        return re.sub(r"<v>[^<]*</v>", f"<v>{text}</v>", cell_xml, count=1)
    if "</f>" in cell_xml:
        return cell_xml.replace("</f>", f"</f><v>{text}</v>", 1)
    return re.sub(r"/>$", f"><v>{text}</v></c>", cell_xml, count=1) if cell_xml.endswith("/>") else cell_xml.replace(
        "</c>", f"<v>{text}</v></c>", 1
    )


def replace_str_v(cell_xml: str, value: str) -> str:
    if "<v>" in cell_xml:
        return re.sub(r"<v>[^<]*</v>", f"<v>{value}</v>", cell_xml, count=1)
    return cell_xml.replace("</f>", f"</f><v>{value}</v>", 1)


def status_for(progress: float) -> str:
    if progress >= 1:
        return "Target Met"
    if progress >= 0.75:
        return "On Track"
    if progress >= 0.4:
        return "At Risk"
    return "Off Track"


def asset_row_map(asset_xml: str, shared: list[str]) -> dict[str, int]:
    out = {}
    for row in range(2, 32):
        match = re.search(rf'<c r="A{row}"[^>]*t="s"[^>]*><v>(\d+)</v></c>', asset_xml)
        if match:
            out[shared[int(match.group(1))]] = row
    return out


def header_col(sheet_xml: str, shared: list[str], header: str) -> str:
    row1 = re.search(r'<row r="1"[^>]*>.*?</row>', sheet_xml, re.S).group(0)
    for match in re.finditer(r'<c r="([A-Z]+)1"([^>]*)>(.*?)</c>', row1, re.S):
        col, attrs, inner = match.group(1), match.group(2), match.group(3)
        v = re.search(r"<v>([^<]*)</v>", inner)
        inline = re.search(r"<t[^>]*>([^<]*)</t>", inner)
        if 't="s"' in attrs and v:
            label = shared[int(v.group(1))]
        elif 't="inlineStr"' in attrs and inline:
            label = inline.group(1)
        elif v:
            label = v.group(1)
        else:
            continue
        if label == header:
            return col
    raise SystemExit(f"header {header!r} not found")


def baseline_water_rows(baseline_xml: str, shared: list[str]) -> dict[str, int]:
    """Asset ID -> row for Water Use (WT1) metric."""
    water_idx = shared.index("Water Use (WT1)")
    metric_col = header_col(baseline_xml, shared, "Metric")
    asset_col = header_col(baseline_xml, shared, "Asset ID")
    rows = {}
    for match in re.finditer(
        rf'<c r="{metric_col}(\d+)"[^>]*t="s"[^>]*><v>{water_idx}</v></c>',
        baseline_xml,
    ):
        row = int(match.group(1))
        aid_match = re.search(
            rf'<c r="{asset_col}{row}"[^>]*t="s"[^>]*><v>(\d+)</v></c>',
            baseline_xml,
        )
        if not aid_match:
            raise SystemExit(f"missing Asset ID on baseline row {row}")
        rows[shared[int(aid_match.group(1))]] = row
    return rows


def read_cached_number(sheet_xml: str, ref: str) -> float:
    cell = cell_re(ref).search(sheet_xml)
    if not cell:
        raise SystemExit(f"missing cell {ref}")
    v = re.search(r"<v>([^<]*)</v>", cell.group(0))
    if not v:
        raise SystemExit(f"no cached value on {ref}")
    return float(v.group(1))


def set_cell(sheet_xml: str, ref: str, replacer) -> str:
    match = cell_re(ref).search(sheet_xml)
    if not match:
        raise SystemExit(f"missing cell {ref}")
    return sheet_xml[: match.start()] + replacer(match.group(0)) + sheet_xml[match.end() :]


def cohort_bar(property_type: str, floor_area: float) -> float:
    intensity = WATER_COHORT_GAL_PER_SF.get(property_type, WATER_COHORT_GAL_PER_SF["Unknown"])
    return intensity * (1 - WATER_COHORT_REDUCTION) * floor_area


def main() -> None:
    if not os.path.exists(XLSX):
        raise SystemExit(f"missing workbook: {XLSX}")

    # Floor area + property type from geojson (same portfolio the app uses).
    features = {
        f["properties"]["id"]: f["properties"]
        for f in json.load(open(GEOJSON))["features"]
    }

    targets = {}
    for asset_id, mult in OVER_BAR_MULTIPLIER.items():
        props = features[asset_id]
        bar = cohort_bar(props["propertyType"], props["floorArea"])
        targets[asset_id] = round(bar * mult, 1)

    if not os.path.exists(BACKUP):
        shutil.copy2(XLSX, BACKUP)
        print(f"backup written: {BACKUP}")
    else:
        print(f"backup already present: {BACKUP}")

    with zipfile.ZipFile(XLSX, "r") as zin:
        parts = {name: zin.read(name) for name in zin.namelist()}

    shared = shared_strings(parts[SHARED])
    asset_xml = parts[ASSET_SHEET].decode("utf-8")
    baseline_xml = parts[BASELINE_SHEET].decode("utf-8")

    wt1_col = header_col(asset_xml, shared, "WT1 - Water Withdrawals (gal)")
    asset_rows = asset_row_map(asset_xml, shared)
    water_rows = baseline_water_rows(baseline_xml, shared)

    cur_col = header_col(baseline_xml, shared, "Current Value")
    prog_col = header_col(baseline_xml, shared, "% Progress to Target")
    var_col = header_col(baseline_xml, shared, "Variance vs Target")
    status_col = header_col(baseline_xml, shared, "Status")
    base_col = header_col(baseline_xml, shared, "Baseline Value")
    tgt_col = header_col(baseline_xml, shared, "Target Value")

    if len(water_rows) != 30:
        raise SystemExit(f"expected 30 water baseline rows, found {len(water_rows)}")

    for asset_id, new_wt1 in sorted(targets.items()):
        arow = asset_rows[asset_id]
        brow = water_rows[asset_id]
        baseline = read_cached_number(baseline_xml, f"{base_col}{brow}")
        target = read_cached_number(baseline_xml, f"{tgt_col}{brow}")
        span = baseline - target
        progress = (baseline - new_wt1) / span if abs(span) > 1e-9 else (1.0 if new_wt1 <= target else 0.0)
        variance = new_wt1 - target
        status = status_for(progress)

        asset_xml = set_cell(
            asset_xml,
            f"{wt1_col}{arow}",
            lambda cell, value=new_wt1: replace_numeric_v(cell, value),
        )
        baseline_xml = set_cell(
            baseline_xml,
            f"{cur_col}{brow}",
            lambda cell, value=new_wt1: replace_numeric_v(cell, value),
        )
        baseline_xml = set_cell(
            baseline_xml,
            f"{prog_col}{brow}",
            lambda cell, value=progress: replace_numeric_v(cell, value),
        )
        baseline_xml = set_cell(
            baseline_xml,
            f"{var_col}{brow}",
            lambda cell, value=variance: replace_numeric_v(cell, value),
        )
        baseline_xml = set_cell(
            baseline_xml,
            f"{status_col}{brow}",
            lambda cell, value=status: replace_str_v(cell, value),
        )
        print(
            f"{asset_id}: WT1 -> {new_wt1:g}  "
            f"progress={progress:.3f} variance={variance:.1f} status={status}"
        )

    parts[ASSET_SHEET] = asset_xml.encode("utf-8")
    parts[BASELINE_SHEET] = baseline_xml.encode("utf-8")

    tmp = XLSX + ".tmp"
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in parts.items():
            zout.writestr(name, data)
    os.replace(tmp, XLSX)
    print(f"updated {XLSX}")
    print("Next: .venv/bin/python scripts/prepare_data.py")


if __name__ == "__main__":
    main()
