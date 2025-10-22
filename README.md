## Name Tag Generator

Generate per-name PNG name tags by rendering text onto a template image. Optionally, combine the tags into an A4 PDF sheet (requires ReportLab).

### Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

ReportLab is optional; remove it from `requirements.txt` if you don't need PDF output.

### Template

Provide a blank template image (PNG/JPG). Coordinates `--x` and `--y` are specified as percentages of the template width/height. The text's vertical anchor is the middle, so `--y` refers to the visual vertical center of the rendered name. Horizontal anchor is controlled by `--align`.

### Usage

```bash
python nametag_generator.py \
  --template path/to/template.png \
  --names path/to/names.txt \
  --x 50 --y 60 \
  --fontsize 96 \
  --fill "#111111" \
  --stroke "#ffffff" --stroke_width 2 \
  --align center \
  --uppercase \
  --outdir out \
  --pattern "{{name}}-tag.png" \
  --make-pdf --pdf-name "name-tags.pdf" --tag-width-mm 90 --margin-mm 10
```

CSV input with a column header:

```bash
python nametag_generator.py \
  --template template.png \
  --names attendees.csv --csv-col FullName \
  --x 50 --y 60
```

### Arguments

- **--template**: Path to template image.
- **--names**: TXT (one name per line) or CSV.
- **--csv-col**: CSV header to use for names (defaults to first column).
- **--font**: Path to a TTF/OTF font. If omitted, uses Pillow default.
- **--fontsize**: Font size in pixels.
- **--fill**: Text color (hex or CSS-like names).
- **--stroke**: Outline color (optional).
- **--stroke_width**: Outline width in pixels.
- **--align**: Horizontal alignment: left, center, right.
- **--uppercase**: Convert names to uppercase.
- **--x, --y**: Text position as percentages (0–100). Y is vertical middle.
- **--offset_x, --offset_y**: Pixel nudges for fine tuning.
- **--outdir**: Output directory for PNGs.
- **--pattern**: Output filename pattern; `{{name}}` is replaced per name.
- **--make-pdf**: Also generate an A4 PDF grid of tags.
- **--pdf-name**: Name of the PDF file.
- **--tag-width-mm**: Width of each tag on the PDF in mm.
- **--margin-mm**: Page margin in mm.

### Notes

- Colors are validated and parsed via Pillow; both hex (`#RRGGBB`) and names (e.g., `white`) are accepted.
- If you need true bold or italics, supply an appropriate font file via `--font`.
- If a name contains filesystem-unsafe characters, they are replaced with `-` for output filenames.


