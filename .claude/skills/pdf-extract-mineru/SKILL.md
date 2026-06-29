---
name: pdf-extract-mineru
description: Use when you need high-quality text/structure extraction from a PDF, image, DOCX, PPTX or XLSX — especially scanned/image PDFs, documents with tables, multi-column layouts, math formulas, or non-Latin scripts (OCR, 109 languages). Produces clean Markdown + structured JSON. Prefer this over naive extraction (pdf-parse, pdftotext) whenever layout/tables/OCR matter, or when the cheap extraction returned empty/garbage text. For a clean digital-text PDF, stay on the simple extraction.
---

# pdf-extract-mineru

High-fidelity document extraction via **MinerU** (opendatalab/MinerU). Turns a
PDF / image / DOCX / PPTX / XLSX into clean Markdown + a structured JSON.

## When to use vs cheap extraction
- **Use MinerU** when: scanned / image-based PDF, photographed document, complex
  tables, multi-column layout, math formulas, non-Latin scripts (OCR, 109
  languages), **or** when `pdf-parse` / `pdftotext` returned empty or garbled text.
- **Stay cheap** (`pdf-parse`, `pdftotext`) for a clean, digital, single-column
  text PDF — it's faster and free. Don't reach for MinerU by default.

## Command — this machine (Apple Silicon, no NVIDIA GPU)
Always use the **`pipeline`** backend on Mac / no-GPU. The CLI default is
`hybrid-engine`, which needs an NVIDIA GPU and will FAIL here.

```bash
mineru -p <input> -o <out_dir> -b pipeline
```
The **first run downloads ~1 GB of models** into `~/.cache` (one-time, slow).

### Useful flags
- `-m auto|txt|ocr` — parse method (pipeline backend). `auto` (default) chooses
  txt vs ocr; force `-m ocr` for scanned/photo PDFs, `-m txt` for clean digital text.
- `-l <lang>` — OCR language hint (pipeline only), improves accuracy. Accepts:
  `ch ch_server korean ta te ka th el arabic east_slavic cyrillic devanagari`
  (default `ch`, which also handles Latin/French).
- `-s <n>` / `-e <n>` — start/end page, **0-based** (`-s 0 -e 4` = first 5 pages).
- `-f false` / `-t false` — disable formula / table parsing if unneeded (faster).
- Inputs: `pdf`, image (`jpg`/`png`), `docx`, `pptx`, `xlsx`.

### Examples
```bash
# Scanned French/Latin lab PDF
mineru -p report.pdf -o out -b pipeline -m ocr
# A photo of a paper document
mineru -p photo.jpg -o out -b pipeline -m ocr
# First 3 pages only of a large PDF
mineru -p big.pdf -o out -b pipeline -s 0 -e 2
```

## Output layout
For input `<name>.<ext>` parsed with method `auto`:
- `<out_dir>/<name>/auto/<name>.md` — clean Markdown (read this).
- `<out_dir>/<name>/auto/<name>_content_list.json` — structured blocks
  (`type`, `text`, `page_idx`, bbox) for programmatic use.
- `<out_dir>/<name>/auto/images/` — extracted figures/charts.

The middle subfolder matches the method: `auto` / `ocr` / `txt`.

## Notes
- The MinerU **binary is per-machine** (installed via
  `uv tool install --python 3.12 "mineru[core]"`; here MinerU **3.4.0**).
  This `SKILL.md` is **per-project** (committed to the repo so teammates/CI share it).
- On a machine **with** an NVIDIA GPU (≥8 GB VRAM), drop `-b pipeline` to use the
  default `hybrid-engine` (higher accuracy); add `--effort high` for image/chart analysis.
- Verify success by checking the `.md` exists and contains the expected text —
  never assume it worked.
