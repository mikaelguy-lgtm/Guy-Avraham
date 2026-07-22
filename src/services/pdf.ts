import PDFDocument from "pdfkit";
import type { AnonymousSubmissionSnapshot } from "../domain/types.js";
import { snapshotDisplayEntries } from "../utils/snapshotDisplay.js";

export async function createAnonymousPdf(snapshot: AnonymousSubmissionSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({size: "A4", margin: 48, info: {Title: `SynCash case ${snapshot.publicCaseNumber}`}});
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fontSize(18).text("SynCash Anonymous Financing Case", {align: "center"});
    document.moveDown();
    for (const [key, value] of snapshotDisplayEntries(snapshot)) {
      document.fontSize(11).text(`${key}: ${value}`);
    }
    document.end();
  });
}
