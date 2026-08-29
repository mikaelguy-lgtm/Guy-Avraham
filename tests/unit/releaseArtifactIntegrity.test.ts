import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Git Bash's tar/find/grep expect POSIX-style paths ("/c/Users/...", not
// "C:\Users\..."); Node's path helpers return Windows-style paths on win32,
// which tar misparses as a remote "host:path" spec. Only relevant for running
// these tests on Windows — Linux/macOS paths are already POSIX-style.
function toBashPath(path: string): string {
  if (process.platform !== "win32") return path;
  const match = /^([A-Za-z]):(.*)$/.exec(path);
  if (!match) return path;
  return `/${match[1].toLowerCase()}${match[2].replace(/\\/g, "/")}`;
}

const PRODUCTION_COMMON = toBashPath(join(process.cwd(), "scripts", "production-common.sh"));

function runCrlfGuard(directory: string): {status: number; stderr: string} {
  try {
    execFileSync("bash", ["-c", `source "${PRODUCTION_COMMON}" && assert_no_crlf_in_release "${directory}"`], {stdio: ["ignore", "pipe", "pipe"]});
    return {status: 0, stderr: ""};
  } catch (error) {
    const failure = error as {status?: number; stderr?: Buffer};
    return {status: failure.status ?? 1, stderr: failure.stderr?.toString("utf8") ?? ""};
  }
}

describe("release artifact line-ending guard (scripts/production-common.sh)", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "syncash-release-guard-"));
    mkdirSync(join(directory, "scripts"));
    mkdirSync(join(directory, "drizzle"));
  });

  afterEach(() => {
    rmSync(directory, {recursive: true, force: true});
  });

  it("passes for a release whose shell scripts and SQL migrations use LF", () => {
    writeFileSync(join(directory, "scripts", "deploy.sh"), "#!/usr/bin/env bash\necho ok\n");
    writeFileSync(join(directory, "drizzle", "0001_example.sql"), "ALTER TABLE liabilities ADD COLUMN example text;\n");
    const result = runCrlfGuard(directory);
    expect(result.status).toBe(0);
  });

  it("fails and names the file when a SQL migration was corrupted to CRLF", () => {
    const corrupted = join(directory, "drizzle", "0002_corrupted.sql");
    writeFileSync(corrupted, "ALTER TABLE liabilities ADD COLUMN example text;\r\nSELECT 1;\r\n");
    writeFileSync(join(directory, "scripts", "deploy.sh"), "#!/usr/bin/env bash\necho ok\n");
    const result = runCrlfGuard(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CRLF");
    expect(result.stderr).toContain("0002_corrupted.sql");
  });

  it("fails and names the file when a shell script was corrupted to CRLF", () => {
    const corrupted = join(directory, "scripts", "corrupted.sh");
    writeFileSync(corrupted, "#!/usr/bin/env bash\r\necho ok\r\n");
    writeFileSync(join(directory, "drizzle", "0001_example.sql"), "SELECT 1;\n");
    const result = runCrlfGuard(directory);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("corrupted.sh");
  });

  it("does not flag unrelated file types even if they contain CRLF", () => {
    writeFileSync(join(directory, "drizzle", "0001_example.sql"), "SELECT 1;\n");
    writeFileSync(join(directory, "notes.md"), "line one\r\nline two\r\n");
    const result = runCrlfGuard(directory);
    expect(result.status).toBe(0);
  });
});

describe("scripts/build-release-artifact.sh", () => {
  it("produces an archive whose tracked files hash-match their Git blobs for HEAD", () => {
    const output = join(mkdtempSync(join(tmpdir(), "syncash-release-build-")), "release.tar.gz");
    const script = toBashPath(join(process.cwd(), "scripts", "build-release-artifact.sh"));
    // tar (as used inside the script) misparses a Windows-style "C:\..." output
    // path as a remote "host:path" spec, so the destination must be POSIX-style
    // when running under Git Bash on Windows.
    try {
      const stdout = execFileSync("bash", [script, "HEAD", toBashPath(output)], {encoding: "utf8"});
      expect(stdout).toContain("verified byte-identical to HEAD");
    } finally {
      rmSync(output, {force: true});
    }
  });
});
