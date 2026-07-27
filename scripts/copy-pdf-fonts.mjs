import {copyFile, mkdir, readFile} from "node:fs/promises";
import path from "node:path";

const sourceDirectory = path.resolve("assets/fonts");
const targetDirectory = path.resolve("dist-server/assets/fonts");
const files = ["NotoSansHebrew-Regular.ttf", "NotoSansHebrew-Bold.ttf", "OFL.txt"];

await mkdir(targetDirectory, {recursive: true});
for (const file of files) {
  const source = path.join(sourceDirectory, file);
  const contents = await readFile(source);
  if (!contents.length) throw new Error(`PDF font build asset is empty: ${file}`);
  await copyFile(source, path.join(targetDirectory, file));
}
