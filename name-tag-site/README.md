## name-tag-site

React + Vite web app to generate name-tag images in the browser. Upload a template, paste names or upload CSV, drag a sample name to position, then export per-name PNGs (ZIP) or an A4 PDF sheet. No backend.

### Setup

```bash
pnpm i   # or: npm i, yarn
pnpm dev # or: npm run dev, yarn dev
```

### Build

```bash
pnpm build
pnpm preview
```

### How to use

1) Upload a template image (PNG/JPG).
2) Paste names (one per line), or upload a CSV. If CSV has multiple headers, pick the column.
3) Drag the handle on the preview to set the name position. Position is stored as % so exports match template scaling.
4) Adjust font, size, weight, uppercase, alignment, color, outline.
5) Choose the filename pattern (default `{{name}}-nametag.png`).
6) Export either PNGs (as a ZIP) or a PDF sheet. PDF fits multiple tags per A4 based on tag width and page margin.

Screenshots:

![Controls Placeholder](./docs/controls.png)
![Preview Placeholder](./docs/preview.png)


