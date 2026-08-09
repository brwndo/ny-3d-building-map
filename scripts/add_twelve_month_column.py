"""One-time xlsx edit: adds the "12-Month Whole-Building Data Complete" column
to the Asset-Level Data sheet, and documents it on Legend & Notes.

ENERGY STAR certification has two independent gates: a score of 75+ and 12 full
consecutive months of whole-building data across all fuel types. The workbook
only carried the score, so `energyStarEligible` was computed from it alone. This
column supplies the second gate. It is deliberately NOT derived from
Data Coverage (%) - coverage measures how much floor area/consumption is
verified, which is a different question from whether 12 consecutive months
exist. The values below are hardcoded per asset rather than computed so that
independence stays visible in the source data.

Why raw XML instead of openpyxl: the workbook is formula-driven (~1400 formula
cells, including every column `prepare_data.py` reads off `Baseline & Targets`).
openpyxl can preserve formulas or their cached results, never both - loading
with data_only=True and saving replaces formulas with values, and loading
without it drops every cached <v>, which leaves `prepare_data.py` reading None.
Editing the sheet XML in place sidesteps the choice: every other byte of the
workbook is copied through untouched.

The column edit and the Legend & Notes edit are independently idempotent, so
re-running is safe and applies only whichever is missing.

Run:  .venv/bin/python scripts/add_twelve_month_column.py
"""

import os
import re
import shutil
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "Enertiv Product Management", "25-asset-level-esg-data-NY.xlsx")
# Keeps the .xlsx extension so the backup stays openable by Excel and openpyxl.
BACKUP = XLSX.replace(".xlsx", ".backup.xlsx")

# Sheet targets from xl/workbook.xml: rId3 -> sheet1, rId7 -> sheet5.
SHEET_XML = "xl/worksheets/sheet1.xml"
LEGEND_XML = "xl/worksheets/sheet5.xml"
HEADER = "12-Month Whole-Building Data Complete"

# Legend & Notes grows by appending dated sections at the bottom; the new rows
# go after whatever the current last row is.
LEGEND_SECTION_STYLE = "47"  # section heading, column A
LEGEND_TERM_STYLE = "49"  # term, column A
LEGEND_DEF_STYLE = "48"  # definition, column B
LEGEND_ROWS = [
    ("ENERGY STAR eligibility - 2026-08-09", None),
    (
        HEADER,
        "Y/N per asset. ENERGY STAR certification requires 12 full consecutive "
        "months of whole-building data across all fuel types, which is a "
        "separate gate from the 1-100 score. Fabricated for prototyping.",
    ),
    (
        "Relationship to Data Coverage",
        "Deliberately independent. Data Coverage (%) measures how much floor "
        "area / consumption is verified, for audit-defensibility. This flag "
        "asks whether a complete 12-month year exists at all. An asset can "
        "have high coverage and an incomplete year (NY-023, 93.8%, N), or low "
        "coverage and a complete one (NY-026, 48.2%, Y). Certification "
        "eligibility = score 75+ AND this flag.",
    ),
]

# The sheet keeps an "Assumptions" annotation block at AF-AG (32-33) and column
# AE (31) is the empty spacer before it. Writing into AE avoids shifting any
# column: ~1400 formulas reference the block absolutely (e.g. `=L2*$AG$3`), and
# nothing rewrites those references for us.
NEW_COL = "AE"
REF_COL = "AD"  # last real data column; supplies the per-row style index
BLOCK_COL = "AF"  # first annotation column, when a row has one

FIRST_DATA_ROW, LAST_DATA_ROW, TOTALS_ROW = 2, 31, 33

# Assets without 12 full consecutive months of whole-building data across all
# fuel types. Chosen so the field is demonstrably orthogonal to coverage:
#   NY-017 / NY-019 / NY-028 - score 75+ but data can't support the claim
#                              (two are Confidence Tier "Missing")
#   NY-023 / NY-016 / NY-005 - coverage above 93% yet still an incomplete year,
#                              so high coverage does not imply completeness
#   NY-003 / NY-013          - lower-scoring assets, so the flag does not track
#                              the score either
# NY-026 is intentionally left "Y" at 48.2% coverage: a complete whole-building
# master meter with poor tenant submetering - the inverse case.
INCOMPLETE = {
    "NY-003",
    "NY-005",
    "NY-013",
    "NY-016",
    "NY-017",
    "NY-019",
    "NY-023",
    "NY-028",
}


def row_xml(sheet, row):
    match = re.search(r'<row r="%d"[^>]*>.*?</row>' % row, sheet, re.S)
    if not match:
        raise SystemExit(f"row {row} not found in {SHEET_XML}")
    return match.group()


def style_of(row_source, col, row):
    """Reuse the neighbouring column's style index so the new cells inherit the
    sheet's existing header/body formatting."""
    match = re.search(r'<c r="%s%d"[^>]*?\ss="(\d+)"' % (col, row), row_source)
    return f' s="{match.group(1)}"' if match else ""


def insert_cell(sheet, row, cell_xml):
    """Cells must stay in column order: before the annotation block if the row
    has one, otherwise at the end of the row."""
    original = row_xml(sheet, row)
    anchor = f'<c r="{BLOCK_COL}{row}"'
    if anchor in original:
        updated = original.replace(anchor, cell_xml + anchor, 1)
    else:
        updated = original.replace("</row>", cell_xml + "</row>", 1)
    return sheet.replace(original, updated, 1)


def asset_ids(sheet, shared):
    """Column A values for the data rows, resolved through sharedStrings."""
    ids = {}
    for row in range(FIRST_DATA_ROW, LAST_DATA_ROW + 1):
        match = re.search(r'<c r="A%d"[^>]*t="s"[^>]*><v>(\d+)</v></c>' % row, sheet)
        if match:
            ids[row] = shared[int(match.group(1))]
    return ids


def add_data_column(parts):
    sheet = parts[SHEET_XML].decode("utf-8")
    if HEADER in sheet or f'r="{NEW_COL}1"' in sheet:
        print(f"{HEADER!r} column already present - skipped")
        return False

    shared = re.findall(
        r"<si>(?:<t[^>]*>(.*?)</t>|.*?)</si>",
        parts["xl/sharedStrings.xml"].decode("utf-8"),
        re.S,
    )
    ids = asset_ids(sheet, shared)
    if len(ids) != 30:
        raise SystemExit(f"expected 30 asset rows, resolved {len(ids)}")

    # Inline strings avoid having to touch sharedStrings.xml and its counts.
    header_row = row_xml(sheet, 1)
    sheet = insert_cell(
        sheet,
        1,
        f'<c r="{NEW_COL}1"{style_of(header_row, REF_COL, 1)} t="inlineStr">'
        f"<is><t>{escape(HEADER)}</t></is></c>",
    )

    incomplete_seen = set()
    for row, asset_id in sorted(ids.items()):
        flag = "N" if asset_id in INCOMPLETE else "Y"
        if flag == "N":
            incomplete_seen.add(asset_id)
        style = style_of(row_xml(sheet, row), REF_COL, row)
        sheet = insert_cell(
            sheet,
            row,
            f'<c r="{NEW_COL}{row}"{style} t="inlineStr"><is><t>{flag}</t></is></c>',
        )

    # The totals row is weighted averages elsewhere, but the Legend's
    # floor-area-weighting rule covers continuous metrics only - a count is the
    # honest summary for a binary field. The cached <v> keeps the cell readable
    # to `prepare_data.py`, which loads with data_only=True.
    complete = len(ids) - len(incomplete_seen)
    span = f"{NEW_COL}{FIRST_DATA_ROW}:{NEW_COL}{LAST_DATA_ROW}"
    sheet = insert_cell(
        sheet,
        TOTALS_ROW,
        f'<c r="{NEW_COL}{TOTALS_ROW}"'
        f'{style_of(row_xml(sheet, TOTALS_ROW), REF_COL, TOTALS_ROW)} t="str">'
        f'<f aca="false">COUNTIF({span},"Y")&amp;" of "&amp;COUNTA({span})'
        f'&amp;" complete"</f>'
        f"<v>{complete} of {len(ids)} complete</v></c>",
    )

    sheet = sheet.replace(
        f'<autoFilter ref="A1:{REF_COL}{LAST_DATA_ROW}">',
        f'<autoFilter ref="A1:{NEW_COL}{LAST_DATA_ROW}">',
        1,
    )
    # Give the new column a width; the spacer never had a <col> entry.
    sheet = sheet.replace(
        '<col collapsed="false" customWidth="true" hidden="false" outlineLevel="0"'
        ' max="32" min="32" style="1" width="34"/>',
        '<col collapsed="false" customWidth="true" hidden="false" outlineLevel="0"'
        ' max="31" min="31" style="1" width="18"/>'
        '<col collapsed="false" customWidth="true" hidden="false" outlineLevel="0"'
        ' max="32" min="32" style="1" width="34"/>',
        1,
    )

    parts[SHEET_XML] = sheet.encode("utf-8")

    unknown = INCOMPLETE - incomplete_seen
    print(f"Wrote {HEADER!r} to column {NEW_COL} for {len(ids)} assets")
    print(f"  complete (Y): {complete}")
    print(f"  incomplete (N): {len(incomplete_seen)} ({', '.join(sorted(incomplete_seen))})")
    if unknown:
        print(f"  WARNING: asset IDs in INCOMPLETE not found in sheet: {sorted(unknown)}")
    return True


def add_legend_notes(parts):
    """Append a dated definition section, matching how this sheet already grows."""
    legend = parts[LEGEND_XML].decode("utf-8")
    if HEADER in legend:
        print("Legend & Notes entry already present - skipped")
        return False

    last_row = max(int(r) for r in re.findall(r'<row r="(\d+)"', legend))
    rows = []
    for offset, (term, definition) in enumerate(LEGEND_ROWS):
        row = last_row + 2 + offset  # leave one blank row as a section break
        term_style = LEGEND_SECTION_STYLE if definition is None else LEGEND_TERM_STYLE
        cells = (
            f'<c r="A{row}" s="{term_style}" t="inlineStr">'
            f"<is><t>{escape(term)}</t></is></c>"
        )
        if definition is not None:
            cells += (
                f'<c r="B{row}" s="{LEGEND_DEF_STYLE}" t="inlineStr">'
                f"<is><t>{escape(definition)}</t></is></c>"
            )
        rows.append(
            f'<row r="{row}" customFormat="false" ht="15" hidden="false"'
            f' customHeight="true" outlineLevel="0" collapsed="false">{cells}</row>'
        )

    legend = legend.replace("</sheetData>", "".join(rows) + "</sheetData>", 1)
    legend = re.sub(
        r'<dimension ref="A1:B\d+"/>',
        f'<dimension ref="A1:B{last_row + 1 + len(LEGEND_ROWS)}"/>',
        legend,
        count=1,
    )
    parts[LEGEND_XML] = legend.encode("utf-8")
    print(f"Appended {len(LEGEND_ROWS)} Legend & Notes rows")
    return True


def main():
    with zipfile.ZipFile(XLSX) as zin:
        entries = [(item, zin.read(item.filename)) for item in zin.infolist()]
    parts = {item.filename: data for item, data in entries}

    backup_needed = not os.path.exists(BACKUP)
    changed = [add_data_column(parts), add_legend_notes(parts)]
    if not any(changed):
        print("Nothing to do")
        return

    if backup_needed:
        shutil.copy2(XLSX, BACKUP)
        print(f"Backed up to {BACKUP}")

    with zipfile.ZipFile(XLSX, "w", zipfile.ZIP_DEFLATED) as zout:
        for item, _ in entries:
            zout.writestr(item, parts[item.filename])
    print(f"Saved {XLSX}")


if __name__ == "__main__":
    main()
