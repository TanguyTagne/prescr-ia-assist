import * as pdfjsLib from "pdfjs-dist";
// Bundle the worker via Vite so the version always matches pdfjs-dist
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

/**
 * Convert the first page of a PDF file to a base64 data URL image.
 */
export async function pdfToImageBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible d'initialiser le canvas");

  await page.render({ canvasContext: ctx, viewport } as any).promise;

  return canvas.toDataURL("image/png");
}
