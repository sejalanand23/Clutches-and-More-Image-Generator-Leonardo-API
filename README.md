# Clutches and More — AI Product Image Generator

Automated batch pipeline that takes product images and generates **4–5 high-quality model photos** per product using the [Leonardo AI API](https://leonardo.ai), then applies a watermark and saves everything in an organized folder structure.

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your API key
```bash
cp .env.example .env
# Edit .env and paste your Leonardo AI API key
```

### 3. Drop product images into `input/`
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- Filename = product name (e.g. `black-crossbody-bag.jpg`)

### 4. Run the pipeline
```bash
# For bags
python run.py --input ./input --output ./output --category bags

# For jewelry
python run.py --input ./input --output ./output --category jewelry

# Custom number of images
python run.py --input ./input --category bags --num-images 4

# Custom watermark PNG
python run.py --input ./input --category bags --watermark ./watermarks/logo.png
```

### 5. Find results in `output/`
```
output/
└── black-crossbody-bag/
    ├── img_1.jpg
    ├── img_2.jpg
    ├── img_3.jpg
    ├── img_4.jpg
    └── img_5.jpg
```

---

## CLI Reference

```
python run.py --help
```

| Flag | Short | Default | Description |
|---|---|---|---|
| `--input` | `-i` | `./input` | Folder with product images |
| `--output` | `-o` | `./output` | Folder to save generated images |
| `--category` | `-c` | *(required)* | `bags` or `jewelry` |
| `--num-images` | `-n` | `5` | Images per product (1–8) |
| `--watermark` | `-w` | auto-text | Custom PNG watermark file |

---

## Project Structure

```
.
├── run.py                        # CLI entry point
├── requirements.txt
├── .env.example                  # Copy to .env, add your API key
├── input/                        # ← Drop product images here
├── output/                       # ← Generated images saved here
├── watermarks/
│   └── watermark.png             # Auto-generated on first run
├── tools/
│   └── generate_watermark.py     # Utility to regenerate watermark PNG
├── pipeline.log                  # Created automatically at runtime
└── src/
    ├── config.py                 # Config loading & validation
    ├── prompts.py                # Prompt templates + variations
    ├── leonardo_client.py        # Leonardo AI API wrapper
    ├── watermark.py              # PIL watermark application
    ├── pipeline.py               # Main orchestration loop
    └── logger.py                 # Logging setup
```

---

## Generation Settings

| Setting | Value |
|---|---|
| Model | Leonardo Kino XL (cinematic realism) |
| Alchemy | ✅ Enabled |
| PhotoReal v2 | ✅ Enabled |
| Resolution | 1024 × 1024 |
| Guidance Scale | 7 (balanced prompt fidelity) |
| Init Strength | 0.40 (preserves product shape) |
| Images per product | 4–5 (configurable) |

---

## Watermark

- Default: auto-generated text watermark "© Clutches and More"
- Custom: provide any PNG with transparency via `--watermark`
- Position: bottom-right corner with padding
- To regenerate the default watermark PNG:
  ```bash
  python tools/generate_watermark.py
  ```

---

## Logs

All operations are logged to:
- **Console** — INFO level and above
- **`pipeline.log`** — DEBUG level and above (full trace)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LEONARDO_API_KEY` | ✅ | Your Leonardo AI API key |
