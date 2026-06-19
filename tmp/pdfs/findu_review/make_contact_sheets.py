from pathlib import Path

from PIL import Image, ImageDraw


page_dir = Path("tmp/pdfs/findu_review/pages")
out_dir = Path("tmp/pdfs/findu_review/contact_sheets")
out_dir.mkdir(parents=True, exist_ok=True)

pages = sorted(page_dir.glob("page-*.png"))
thumb_w = 360
thumb_h = 510
cols = 3
rows = 3

for sheet_index in range(0, len(pages), cols * rows):
    batch = pages[sheet_index : sheet_index + cols * rows]
    canvas = Image.new("RGB", (cols * thumb_w, rows * thumb_h), "white")
    draw = ImageDraw.Draw(canvas)

    for idx, page_path in enumerate(batch):
        image = Image.open(page_path).convert("RGB")
        image.thumbnail((thumb_w - 24, thumb_h - 42))
        x = (idx % cols) * thumb_w + (thumb_w - image.width) // 2
        y = (idx // cols) * thumb_h + 28
        canvas.paste(image, (x, y))
        label = page_path.stem.replace("page-", "Page ")
        draw.text(((idx % cols) * thumb_w + 12, (idx // cols) * thumb_h + 8), label, fill="black")

    out = out_dir / f"contact-{sheet_index // (cols * rows) + 1:02d}.png"
    canvas.save(out)
    print(out)
