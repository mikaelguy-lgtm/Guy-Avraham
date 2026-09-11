import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {downloadPdfBlob, openFreshPdfBlob, revokeActivePdfBlob} from "../../src/utils/pdfBlob";

// pdfBlob.ts runs in the browser only; this project's default test
// environment is plain Node (see tests/unit/externalBorrowerDetails.test.tsx,
// which avoids jsdom via renderToStaticMarkup), so the minimal browser
// surface this module actually touches is stubbed directly here rather than
// pulling in a whole DOM environment for one file.
describe("pdfBlob (preview-expired root-cause fix)", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let windowOpen: ReturnType<typeof vi.fn>;
  let createdAnchors: Array<{href: string; download: string; click: ReturnType<typeof vi.fn>}>;

  beforeEach(() => {
    vi.useFakeTimers();
    let counter = 0;
    createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
    revokeObjectURL = vi.fn();
    windowOpen = vi.fn(() => ({opener: null}));
    createdAnchors = [];
    vi.stubGlobal("URL", {createObjectURL, revokeObjectURL});
    vi.stubGlobal("window", {open: windowOpen, setTimeout, clearTimeout});
    vi.stubGlobal("File", class {
      constructor(public parts: unknown[], public name: string, public options: {type?: string}) {}
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const anchor = {href: "", download: "", click: vi.fn()};
        createdAnchors.push(anchor);
        return anchor;
      })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("never auto-revokes the object URL on a timer while the user is still viewing it", () => {
    // This is the exact bug: openFreshPdfBlob() used to call
    // window.setTimeout(() => URL.revokeObjectURL(url), 60_000) unconditionally,
    // so any PDF still open past 60 seconds broke ("preview expired") even
    // though nothing about the tab or the blob itself changed.
    openFreshPdfBlob(new Blob(["%PDF-fake"]), "SynCash_תיק_מימון_ראשוני_SC-1.pdf");
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000); // 10 minutes — far past the old 60s timer

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("wraps the blob in a named File so the browser's Save-As offers a human filename, not a blob UUID", () => {
    openFreshPdfBlob(new Blob(["%PDF-fake"]), "SynCash_תיק_מימון_מלא_SC-42.pdf");
    const [sourcePassedToCreateObjectURL] = createObjectURL.mock.calls[0] as [{name?: string}];
    expect(sourcePassedToCreateObjectURL.name).toBe("SynCash_תיק_מימון_מלא_SC-42.pdf");
  });

  it("still revokes the previous preview's URL when a new one is opened, so memory doesn't grow unbounded", () => {
    openFreshPdfBlob(new Blob(["%PDF-fake-1"]), "a.pdf");
    const firstUrl = createObjectURL.mock.results[0].value as string;
    openFreshPdfBlob(new Blob(["%PDF-fake-2"]), "b.pdf");
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl);
  });

  it("revokeActivePdfBlob() (wired to component unmount) still cleans up the current URL on demand", () => {
    openFreshPdfBlob(new Blob(["%PDF-fake"]), "a.pdf");
    const url = createObjectURL.mock.results[0].value as string;
    revokeActivePdfBlob();
    expect(revokeObjectURL).toHaveBeenCalledWith(url);
  });
});

// Root cause of the reported "UUID filename" bug, confirmed by direct
// reproduction (a real Playwright download event against the running app):
// window.open()-ing a blob: URL — even one created from a named File, as
// openFreshPdfBlob() above does — does not carry that name over to the
// browser's downloaded-file name; only an <a download="..."> element does.
// downloadPdfBlob() is the guaranteed-correct path for an explicit "download"
// action; openFreshPdfBlob() remains for inline "view" only.
describe("downloadPdfBlob (UUID-filename root-cause fix)", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let createdAnchors: Array<{href: string; download: string; click: ReturnType<typeof vi.fn>}>;

  beforeEach(() => {
    vi.useFakeTimers();
    let counter = 0;
    createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
    revokeObjectURL = vi.fn();
    createdAnchors = [];
    vi.stubGlobal("URL", {createObjectURL, revokeObjectURL});
    vi.stubGlobal("window", {setTimeout, clearTimeout});
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const anchor = {href: "", download: "", click: vi.fn()};
        createdAnchors.push(anchor);
        return anchor;
      })
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("triggers a real <a download> click with the exact human-readable filename", () => {
    downloadPdfBlob(new Blob(["%PDF-fake"]), "SynCash_תיק_מימון_ראשוני_SC-1.pdf");
    expect(createdAnchors).toHaveLength(1);
    expect(createdAnchors[0].download).toBe("SynCash_תיק_מימון_ראשוני_SC-1.pdf");
    expect(createdAnchors[0].href).toBe(createObjectURL.mock.results[0].value);
    expect(createdAnchors[0].click).toHaveBeenCalledOnce();
  });

  it("revokes the object URL afterward without needing the caller to do it", () => {
    downloadPdfBlob(new Blob(["%PDF-fake"]), "a.pdf");
    const url = createObjectURL.mock.results[0].value as string;
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith(url);
  });
});
