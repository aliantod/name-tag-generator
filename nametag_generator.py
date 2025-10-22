"""
Name Tag Generator

Generates per-name PNG name tags by rendering text onto a provided template image.

Features:
- TXT or CSV input (header-based column selection)
- Pillow-based text rendering with optional stroke
- Alignment options and uppercase transform
- Optional A4 PDF sheet export using reportlab (if installed)

Usage examples are available in the README.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageColor

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as pdfcanvas
    from reportlab.lib.utils import ImageReader
    HAVE_REPORTLAB = True
except Exception:
    HAVE_REPORTLAB = False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate name-tag images from a template + names list.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    # Inputs
    parser.add_argument("--template", required=True, help="Path to template image (PNG/JPG).")
    parser.add_argument(
        "--names",
        required=True,
        help="Path to TXT (one per line) or CSV of names.",
    )
    parser.add_argument(
        "--csv-col",
        default=None,
        help="CSV column header to use for names (if --names is a CSV).",
    )
    parser.add_argument(
        "--font",
        default=None,
        help="Path to a .ttf/.otf font file. If omitted, uses PIL default.",
    )

    # Text appearance
    parser.add_argument("--fontsize", type=int, default=72, help="Font size in pixels.")
    parser.add_argument("--fill", default="#111111", help="Text color (hex or CSS-like).")
    parser.add_argument("--stroke", default=None, help="Outline color (e.g., #ffffff).")
    parser.add_argument("--stroke_width", type=int, default=0, help="Outline width in px.")
    parser.add_argument(
        "--align",
        choices=["left", "center", "right"],
        default="center",
        help="Horizontal alignment relative to x position.",
    )
    parser.add_argument("--uppercase", action="store_true", help="Transform names to UPPERCASE.")

    # Positioning
    parser.add_argument("--x", type=float, required=True, help="X position as percent of width (0–100).")
    parser.add_argument("--y", type=float, required=True, help="Y position as percent of height (0–100).")
    parser.add_argument("--offset_x", type=int, default=0, help="Pixel offset in X.")
    parser.add_argument("--offset_y", type=int, default=0, help="Pixel offset in Y.")

    # Export
    parser.add_argument("--outdir", default="out", help="Output directory for PNGs.")
    parser.add_argument(
        "--pattern",
        default="{{name}}-tag.png",
        help="Output filename pattern. Use {{name}} placeholder.",
    )

    # Optional A4 PDF layout
    parser.add_argument("--make-pdf", action="store_true", help="Also export an A4 PDF grid of tags.")
    parser.add_argument("--pdf-name", default="name-tags.pdf", help="PDF filename.")
    parser.add_argument("--tag-width-mm", type=float, default=90.0, help="Width of each tag on PDF (mm).")
    parser.add_argument("--margin-mm", type=float, default=10.0, help="Page margin (mm).")

    return parser.parse_args()


def is_csv(path: str) -> bool:
    return Path(path).suffix.lower() == ".csv"


def read_names(path: str, csv_col: Optional[str]) -> List[str]:
    names: List[str] = []
    src = Path(path)
    if not src.exists():
        raise FileNotFoundError(f"Names file not found: {src}")

    if is_csv(path):
        with src.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            if not headers:
                raise ValueError("CSV appears to have no header row.")
            col = csv_col or headers[0]
            if col not in headers:
                raise ValueError(f"CSV column '{col}' not found. Available: {headers}")
            for row in reader:
                val = (row.get(col) or "").strip()
                if val:
                    names.append(val)
    else:
        with src.open("r", encoding="utf-8-sig") as f:
            for line in f:
                s = line.strip()
                if s:
                    names.append(s)
    return names


def load_font(font_path: Optional[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if font_path:
        p = Path(font_path)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
        raise FileNotFoundError(f"Font file not found: {font_path}")
    return ImageFont.load_default()


def validate_percent(label: str, value: float) -> float:
    if not (0.0 <= value <= 100.0):
        raise ValueError(f"{label} must be between 0 and 100; got {value}")
    return value


def parse_color(value: Optional[str]) -> Optional[Tuple[int, int, int, int]]:
    if value is None:
        return None
    rgb = ImageColor.getrgb(value)
    if len(rgb) == 4:
        return rgb  # type: ignore[return-value]
    return (rgb[0], rgb[1], rgb[2], 255)


def anchor_for_align(align: str) -> str:
    # Use vertical 'm' so Y refers to vertical middle of the text block
    if align == "left":
        return "lm"
    if align == "right":
        return "rm"
    return "mm"  # center


def draw_name_on_template(
    template_img: Image.Image,
    name: str,
    font: ImageFont.ImageFont,
    fill: Tuple[int, int, int, int],
    stroke: Optional[Tuple[int, int, int, int]],
    stroke_width: int,
    x_pct: float,
    y_pct: float,
    offset_x: int,
    offset_y: int,
    align: str,
    uppercase: bool,
) -> Image.Image:
    img = template_img.copy()
    draw = ImageDraw.Draw(img)

    text = name.upper() if uppercase else name
    w, h = img.size
    x = (x_pct / 100.0) * w + offset_x
    y = (y_pct / 100.0) * h + offset_y

    anchor = anchor_for_align(align)

    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width if stroke else 0,
        stroke_fill=stroke if stroke else None,
        anchor=anchor,
    )
    return img


def mm_to_pt(mm: float) -> float:
    return mm * 72.0 / 25.4


def export_pdf_a4(images: List[Image.Image], pdf_path: str, tag_w_mm: float, margin_mm: float) -> None:
    if not HAVE_REPORTLAB:
        print("[warn] reportlab not installed; skipping PDF export.")
        return

    page_w_pt, page_h_pt = A4
    margin_pt = mm_to_pt(margin_mm)
    tag_w_pt = mm_to_pt(tag_w_mm)

    c = pdfcanvas.Canvas(pdf_path, pagesize=A4)

    if not images:
        c.save()
        return

    ref = images[0]
    aspect_ratio = ref.width / ref.height
    tag_h_pt = tag_w_pt / aspect_ratio

    cols = max(1, int((page_w_pt - 2 * margin_pt) // tag_w_pt))
    rows = max(1, int((page_h_pt - 2 * margin_pt) // tag_h_pt))

    x = margin_pt
    y = page_h_pt - margin_pt - tag_h_pt
    col_index = 0
    row_index = 0

    for im in images:
        # ReportLab requires ImageReader or a filename
        ir = ImageReader(im)
        c.drawImage(ir, x, y, width=tag_w_pt, height=tag_h_pt, preserveAspectRatio=True, anchor='sw')

        col_index += 1
        if col_index >= cols:
            col_index = 0
            row_index += 1
            x = margin_pt
            y -= tag_h_pt
            if row_index >= rows:
                c.showPage()
                x = margin_pt
                y = page_h_pt - margin_pt - tag_h_pt
                row_index = 0
        else:
            x += tag_w_pt

    c.save()
    print(f"[ok] PDF saved -> {pdf_path}")


def safe_filename(value: str) -> str:
    # Keep it simple: alnum, dash, underscore, space are allowed
    out = []
    for ch in value:
        if ch.isalnum() or ch in ("-", "_", " "):
            out.append(ch)
        else:
            out.append("-")
    # avoid repeated dashes
    s = "".join(out)
    while "--" in s:
        s = s.replace("--", "-")
    return s.strip().strip("-")


def main() -> None:
    args = parse_args()

    try:
        validate_percent("--x", args.x)
        validate_percent("--y", args.y)
    except ValueError as e:
        raise SystemExit(str(e))

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    # Input validation
    template_path = Path(args.template)
    if not template_path.exists():
        raise SystemExit(f"Template image not found: {template_path}")

    try:
        names = read_names(args.names, args.csv_col)
    except Exception as e:
        raise SystemExit(f"Failed to read names: {e}")

    if not names:
        raise SystemExit("No names found. Check your TXT/CSV input.")

    try:
        template = Image.open(template_path).convert("RGBA")
    except Exception as e:
        raise SystemExit(f"Failed to open template image: {e}")

    try:
        font = load_font(args.font, args.fontsize)
    except Exception as e:
        raise SystemExit(f"Failed to load font: {e}")

    try:
        fill_color = parse_color(args.fill) or (17, 17, 17, 255)
    except Exception as e:
        raise SystemExit(f"Invalid --fill color: {e}")

    try:
        stroke_color = parse_color(args.stroke) if args.stroke else None
    except Exception as e:
        raise SystemExit(f"Invalid --stroke color: {e}")

    if args.stroke_width < 0:
        raise SystemExit("--stroke_width must be >= 0")

    generated_images: List[Image.Image] = []
    for name in names:
        safe_name = safe_filename(name)
        out_name = args.pattern.replace("{{name}}", safe_name)
        out_path = outdir / out_name

        img = draw_name_on_template(
            template_img=template,
            name=name,
            font=font,
            fill=fill_color,
            stroke=stroke_color,
            stroke_width=args.stroke_width,
            x_pct=args.x,
            y_pct=args.y,
            offset_x=args.offset_x,
            offset_y=args.offset_y,
            align=args.align,
            uppercase=args.uppercase,
        )

        try:
            img.save(out_path)
            generated_images.append(img)
            print(f"[ok] {out_path}")
        except Exception as e:
            print(f"[err] Failed to save {out_path}: {e}", file=sys.stderr)

    if args.make_pdf:
        pdf_path = outdir / args.pdf_name
        try:
            export_pdf_a4(generated_images, str(pdf_path), args.tag_width_mm, args.margin_mm)
        except Exception as e:
            print(f"[err] Failed to export PDF: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()


