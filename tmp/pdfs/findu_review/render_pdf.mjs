import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "file:///C:/Users/Administrador/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js";
import * as pdfjsLib from "file:///C:/Users/Administrador/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs";

const input = path.resolve("tmp/pdfs/findu_review/findu.pdf");
const outDir = path.resolve("tmp/pdfs/findu_review/pages");
fs.mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(fs.readFileSync(input));
const pdf = await pdfjsLib.getDocument({
  data,
  disableFontFace: false,
  useSystemFonts: true,
}).promise;

console.log(JSON.stringify({
  pages: pdf.numPages,
  fingerprints: pdf.fingerprints,
}, null, 2));

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const filename = path.join(outDir, `page-${String(pageNumber).padStart(2, "0")}.png`);
  fs.writeFileSync(filename, canvas.toBuffer("image/png"));
  console.log(filename);
}
