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
  "FIREBASE_PRIVATE_KEY",
  "PRIVATE_KEY",
  "S3_SECRET_KEY",
  "S3_SECRET",
  "TOKEN_HASH_SECRET",
  "SESSION_SECRET",
  "COOKIE_SECRET",
  "LOCAL_SECRET_MASTER_KEY",
  "POSTGRES_PASSWORD",
  "REDIS_PASSWORD",
  "REDIS_URL",
  "BEGIN PRIVATE KEY",
  "מוסווה",
  "מוסווית",
  "מוסווים",
  "מוסוות",
  "הסוואה",
  "להסוות"
];

async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

// מזהים בסגנון משתני סביבה נבדקים כמילה שלמה: שם פעולה כמו SMTP_PASSWORD_CLEARED (תווית ביומן)
// אינו דליפה של משתנה הסביבה SMTP_PASSWORD. שאר הסמנים נבדקים כתת-מחרוזת כמו קודם.
const identifierPattern = /^[A-Z][A-Z0-9_]+$/;
const matches = (content, pattern) => identifierPattern.test(pattern)
  ? new RegExp(`(?<![A-Za-z0-9_])${pattern}(?![A-Za-z0-9_])`, "i").test(content)
  : content.toLowerCase().includes(pattern.toLowerCase());
// קבצים בינאריים (פונטים, תמונות) אינם קוד — רצף בתים אקראי בהם אינו דליפה.
const binaryExtensions = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|ico)$/i;

const failures = [];
for (const path of await files(root)) {
  if (binaryExtensions.test(path)) continue;
  const content = await readFile(path, "utf8").catch(() => "");
  for (const pattern of prohibited) {
    if (matches(content, pattern)) {
      failures.push({pattern, file: relative(root, path)});
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Prohibited production bundle marker ${failure.pattern} in ${failure.file}`);
  process.exit(1);
}

console.log("Production bundle safety scan passed");
