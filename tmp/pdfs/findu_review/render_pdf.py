from pathlib import Path

import pypdfium2 as pdfium


input_pdf = Path("tmp/pdfs/findu_review/findu.pdf")
out_dir = Path("tmp/pdfs/findu_review/pages")
out_dir.mkdir(parents=True, exist_ok=True)

pdf = pdfium.PdfDocument(str(input_pdf))
print(f"pages={len(pdf)}")

for index, page in enumerate(pdf, start=1):
    bitmap = page.render(scale=2.5)
    image = bitmap.to_pil()
    output = out_dir / f"page-{index:02d}.png"
    image.save(output)
    print(output)
