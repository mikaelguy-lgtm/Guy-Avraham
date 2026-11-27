import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));
const forbiddenFragments = ["מוסווה", "מוסווית", "מוסווים", "מוסוות", "הסוואה", "להסוות"];
const scannedExtensions = [".ts", ".tsx"];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : Promise.resolve([path]);
  }));
  return nested.flat().filter((path) => scannedExtensions.some((extension) => path.endsWith(extension)));
}

describe("forbidden wording", () => {
  it("never uses the banned masking terminology (מוסווה/הסוואה family) anywhere in src", async () => {
    const violations: Array<{ file: string; fragment: string }> = [];
    for (const path of await collectFiles(srcRoot)) {
      const content = await readFile(path, "utf8");
      for (const fragment of forbiddenFragments) {
        if (content.includes(fragment)) violations.push({ file: relative(srcRoot, path), fragment });
      }
    }
    expect(violations).toEqual([]);
  });
});
