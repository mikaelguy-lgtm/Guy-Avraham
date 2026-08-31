import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  create(buffer: Buffer): {
    postscriptName?: string;
    fullName?: string;
    hasGlyphForCodePoint(codePoint: number): boolean;
    glyphForCodePoint(codePoint: number): {id: number};
  };
};

export const PDF_RENDERER_VERSION = 6;
export const PDF_REGULAR_FONT_NAME = "SynCashHebrewRegular";
export const PDF_BOLD_FONT_NAME = "SynCashHebrewBold";
export const REQUIRED_PDF_HEBREW_CHARACTERS = "אבגדהוזחטיכלמנסעפצקרשתםןץףך₪״׳ \u00a0";

export interface PdfFontAsset {
  buffer: Buffer;
  fileName: string;
  internalName: string;
  sha256: string;
}

export interface PdfHebrewFonts {
  regular: PdfFontAsset;
  bold: PdfFontAsset;
  fingerprint: string;
}

export class PdfHebrewFontError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PdfHebrewFontError";
  }
}

let cachedFonts: PdfHebrewFonts | undefined;

function fontDirectories(): string[] {
  return [
    fileURLToPath(new URL("../../assets/fonts/", import.meta.url)),
    path.resolve(process.cwd(), "assets/fonts"),
    path.resolve(process.cwd(), "dist-server/assets/fonts")
  ].filter((directory, index, directories) => directories.indexOf(directory) === index);
}

function resolveBundledFont(fileName: string): string {
  const resolved = fontDirectories().map((directory) => path.join(directory, fileName)).find(existsSync);
  if (!resolved) throw new PdfHebrewFontError("PDF_HEBREW_FONT_NOT_FOUND", `Bundled PDF font is missing: ${fileName}`);
  return resolved;
}

export function assertRequiredHebrewGlyphs(font: {hasGlyphForCodePoint(codePoint: number): boolean; glyphForCodePoint(codePoint: number): {id: number}}, fontName: string): void {
  const missing = [...REQUIRED_PDF_HEBREW_CHARACTERS].filter((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === undefined || !font.hasGlyphForCodePoint(codePoint) || font.glyphForCodePoint(codePoint).id === 0;
  });
  if (!missing.length) return;
  console.error("PDF Hebrew font validation failed", {code: "PDF_HEBREW_FONT_MISSING_GLYPHS", fontName});
  throw new PdfHebrewFontError("PDF_HEBREW_FONT_MISSING_GLYPHS", `PDF Hebrew font lacks required glyphs: ${fontName}`);
}

function loadFont(fileName: string): PdfFontAsset {
  const buffer = readFileSync(resolveBundledFont(fileName));
  if (!buffer.length) throw new PdfHebrewFontError("PDF_HEBREW_FONT_EMPTY", `Bundled PDF font is empty: ${fileName}`);
  const font = fontkit.create(buffer);
  const internalName = font.postscriptName || font.fullName || fileName;
  assertRequiredHebrewGlyphs(font, internalName);
  return {buffer, fileName, internalName, sha256: createHash("sha256").update(buffer).digest("hex")};
}

export function loadPdfHebrewFonts(): PdfHebrewFonts {
  if (cachedFonts) return cachedFonts;
  const regular = loadFont("NotoSansHebrew-Regular.ttf");
  const bold = loadFont("NotoSansHebrew-Bold.ttf");
  cachedFonts = {
    regular,
    bold,
    fingerprint: createHash("sha256").update(regular.buffer).update(bold.buffer).digest("hex")
  };
  return cachedFonts;
}

export function resetPdfHebrewFontCacheForTests(): void {
  cachedFonts = undefined;
}
