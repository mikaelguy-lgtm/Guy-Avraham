import {readdir, readFile} from "node:fs/promises";
import {join, relative} from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const prohibited = [
  "localhost",
  "9099",
  "3000",
  "SMTP_PASSWORD",
  "DATABASE_URL",
  "FIELD_ENCRYPTION_KEY",
  "PRIVATE_KEY",
  "S3_SECRET"
];

async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

const failures = [];
for (const path of await files(root)) {
  const content = await readFile(path, "utf8").catch(() => "");
  for (const pattern of prohibited) {
    if (content.toLowerCase().includes(pattern.toLowerCase())) {
      failures.push({pattern, file: relative(root.pathname, path)});
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Prohibited production bundle marker ${failure.pattern} in ${failure.file}`);
  process.exit(1);
}

console.log("Production bundle safety scan passed");
