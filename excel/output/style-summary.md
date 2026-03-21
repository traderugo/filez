# Audit Report Excel Styling Reference

File: `Audit Report 2026-03-01 to 2026-03-17.xlsx`
13 sheets total.

---

## Global Style Patterns

### Fonts Used Across All Sheets

| Font | Size | Weight | Usage |
|------|------|--------|-------|
| Corbel | 10 | Regular | Data cells (most sheets) |
| Corbel | 10 | Bold | Headers (sheets 4-9) |
| Corbel | 11 | Regular | Data cells (sheets 2, 3, 8, 10) |
| Corbel | 11 | Bold | Headers (sheets 1, 2, 3, 10) |
| Corbel | 12 | Regular | Data cells (sheet 3) |
| Corbel | 12 | Bold | Headers (sheet 3), with underline for title |
| Arial | 11 | Regular | Data cells (Customers' Ledger) |
| Arial | 11 | Bold | Headers (Customers' Ledger) |
| Arial | 14 | Bold | Title (Customers' Ledger) |
| Calibri | 11 | Regular | Data cells (Castro Lubricants) |
| Calibri | 11 | Bold | Headers (Castro Lubricants) |
| Calibri | 12 | Bold | Section headers (Castro Lubricants) |
| Calibri | 14 | Bold | Title (Castro Lubricants) |

### Font Colors
- **theme(1)** — used on virtually all cells (black in standard theme)
- **ARGB(FFFF0000)** — red, used for error/alert values (sheets 2, 4, Castro Lubricants)

### Fill Colors
- **pattern="none"** — most cells (no fill / transparent)
- **ARGB(FFFFFF00)** — YELLOW, used on:
  - Computed/formula columns (sheets 2, 10, Customers' Ledger, Castro Lubricants, Sheet1(2))
  - Specifically: Litre calculations (col E), Amount calculations (col G) in Sales sheet
  - Closing balance formulas in Customers' Ledger
- **theme(4)** — blue theme color, used only on station name cell (C3 in Sales sheet)

### Number Formats
| Format String | Usage |
|---------------|-------|
| `#,##0` | Integer with thousands separator (meter readings) |
| `_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-` | Accounting integer (no decimals, dash for zero) |
| `_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@_-` | Accounting integer variant (spaces for zero) |
| `_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)` | Accounting integer (parentheses for negatives) |
| `_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-` | Accounting 2 decimals |
| `_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)` | Accounting 2 decimals (parentheses) |
| `mm-dd-yy` | Date format |
| `mmm-yy` | Month-year format (Guideline sheet only) |
| `0` | Plain integer |

### Border Patterns
**Header rows** typically use:
- `top=medium, bottom=medium` on all sides
- Left edge: `left=medium`
- Right edge: `right=medium`
- Interior dividers: `left=thin, right=thin`

**Data rows** typically use:
- `top=thin, bottom=thin, left=thin, right=thin` (full thin grid)
- Left edge gets `left=medium`, right edge gets `right=medium`
- First data row under header sometimes omits `top` border

**Total/summary rows** use:
- `top=thin, bottom=double` (double underline for totals)
- Or `top=medium, bottom=medium` (thick box for section totals)

### Alignment
- **Headers**: `horizontal=center`, sometimes `vertical=middle`
- **Data cells**: `horizontal=center` for most numeric data
- **wrapText**: used on header cells with long text
- **Guideline sheet**: `vertical=top, wrapText` for rich text cells

---

## Per-Sheet Details

### 1. Guideline (rows=10, cols=3)
- Font: Corbel 11
- Column widths: A=10.57, B=18.57, C=92.71
- Borders: medium on instruction/objective boxes
- Row heights: 6=76.5, 8=282.75, 10=150.75 (tall rich text rows)

### 2. Sales>>Cash Position (rows=377, cols=12)
- Font: Corbel 11 (headers bold, data regular)
- Column widths: A=9.29, B=15.71, C=38, D=22.57, E=26.57, F=15.71, G=16.71
- Yellow fill on formula columns E and G (litres and amounts)
- Merged: D3:E3 (title), C5:F5 (period), C7:D7 (section)
- Number format: `#,##0` for readings, accounting `_-*` format for amounts
- Red bold font for discrepancy values

### 3. Stock Position (rows=82, cols=10)
- Font: Corbel 12 (headers bold+underline for title, bold for section)
- Column widths: B=6.29, C=73, D-J vary 11-17
- Yellow fill on computed cells
- Number formats: accounting integer and `#,##0`
- Borders: medium outer, thin interior grid

### 4. Lodgement Sheet (rows=174, cols=26)
- Font: Corbel 10
- 26 columns (A-Z) with varying widths
- Merged: I8:P8, W8:Z8
- Yellow fill on formula cells
- Date format: mm-dd-yy
- Number formats: accounting integer and 2-decimal
- Red bold Calibri 11 for error annotations

### 5. PMS Consumption and Pour back (rows=36, cols=13)
- Font: Corbel 10
- No merged cells
- Headers: medium border box, center aligned
- Data: thin border grid
- Date format: mm-dd-yy
- Number format: accounting `_-*` integer

### 6. AGO Consumption and Pour back (rows=38, cols=9)
- Font: Corbel 10
- Row 5 height=39.75 (tall header)
- Same pattern as PMS consumption
- Additional themed border variant: thin(theme:1) on some cells

### 7. DPK Consumption and Pour back (rows=37, cols=9)
- Font: Corbel 10
- Same pattern as PMS/AGO consumption
- No merged cells

### 8. Product Received (rows=52, cols=16)
- Mixed fonts: Corbel 11 (title/headers) and Corbel 10 (data)
- Narrow spacer columns (E=1.43, G=2.29)
- Date format: mm-dd-yy
- Number formats: accounting 2-decimal and integer
- Complex border structure with medium outer box

### 9. Expenses for the Month (rows=38, cols=6)
- Font: Corbel 10
- Column widths: B=12.57, C=16.29, D=44, E=18, F=17.71
- Headers: medium border, center+middle aligned
- Number format: accounting with parentheses `_(* #,##0_)`
- No merged cells

### 10. Record of Stock Position (rows=40, cols=18)
- Fonts: Corbel 11 (title) and Corbel 10 (data)
- 18 columns (A-R)
- Merged: B6:F6, H6:L6, N6:R6 (3 product sections: PMS, AGO, DPK)
- Yellow fill on computed cells
- Date format: mm-dd-yy
- Number formats: accounting integer and 2-decimal

### 11. Customers' Ledger (rows=43, cols=15)
- Font: **Arial** (not Corbel) — 14 bold title, 11 bold headers, 11 regular data
- Merged: A1:J1 (title row)
- Row heights: 1=19.15, 2=45
- Yellow fill on closing balance formula (col J)
- Number formats: accounting with parentheses + accounting `_-*`

### 12. Castro Lubricants (rows=36, cols=11)
- Font: **Calibri** (not Corbel) — 14 bold title, 12 bold section, 11 bold headers, 11 regular data
- Row heights: 3=15.75, 4=45.75, 30=15.75, 36=18.75
- Yellow fill on computed cells
- Red Calibri 12 for error/alert values
- Number formats: accounting 2-decimal, accounting with parentheses
- Borders: medium outer, thin interior

### 13. Sheet1 (2) (rows=108, cols=22)
- Font: Corbel 10
- 22 columns — same layout as Lodgement Sheet (cols A-V+)
- Yellow fill on formula cells
- Number formats: accounting integer, 2-decimal, mm-dd-yy, plain 0
- Same border patterns as Lodgement Sheet
