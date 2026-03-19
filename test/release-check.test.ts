import { describe, expect, it } from "vitest";
import {
  collectAppcastSparkleVersionErrors,
  collectBundledExtensionManifestErrors,
  collectForbiddenPackPaths,
  collectMissingRequiredPackPaths,
  collectPackUnpackedSizeErrors,
} from "../scripts/release-check.ts";

function makeItem(shortVersion: string, sparkleVersion: string): string {
  return `<item><title>${shortVersion}</title><sparkle:shortVersionString>${shortVersion}</sparkle:shortVersionString><sparkle:version>${sparkleVersion}</sparkle:version></item>`;
}

function makePackResult(filename: string, unpackedSize: number) {
  return { filename, unpackedSize };
}

describe("collectAppcastSparkleVersionErrors", () => {
  it("accepts legacy 9-digit calver builds before lane-floor cutover", () => {
    const xml = `<rss><channel>${makeItem("2026.2.26", "202602260")}</channel></rss>`;

    expect(collectAppcastSparkleVersionErrors(xml)).toEqual([]);
  });

  it("requires lane-floor builds on and after lane-floor cutover", () => {
    const xml = `<rss><channel>${makeItem("2026.3.1", "202603010")}</channel></rss>`;

    expect(collectAppcastSparkleVersionErrors(xml)).toEqual([
      "appcast item '2026.3.1' has sparkle:version 202603010 below lane floor 2026030190.",
    ]);
  });

  it("accepts canonical stable lane builds on and after lane-floor cutover", () => {
    const xml = `<rss><channel>${makeItem("2026.3.1", "2026030190")}</channel></rss>`;

    expect(collectAppcastSparkleVersionErrors(xml)).toEqual([]);
  });
});

describe("collectBundledExtensionManifestErrors", () => {
  it("flags invalid bundled extension install metadata", () => {
    expect(
      collectBundledExtensionManifestErrors([
        {
          id: "broken",
          packageJson: {
            openclaw: {
              install: { npmSpec: "   " },
            },
          },
        },
      ]),
    ).toEqual([
      "bundled extension 'broken' manifest invalid | openclaw.install.npmSpec must be a non-empty string",
    ]);
  });
});

describe("collectForbiddenPackPaths", () => {
  it("allows bundled plugin runtime deps under dist/extensions but still blocks other node_modules", () => {
    expect(
      collectForbiddenPackPaths([
        "dist/index.js",
        "dist/extensions/discord/node_modules/@buape/carbon/index.js",
        "extensions/tlon/node_modules/.bin/tlon",
        "node_modules/.bin/openclaw",
      ]),
    ).toEqual(["extensions/tlon/node_modules/.bin/tlon", "node_modules/.bin/openclaw"]);
  });
});

describe("collectMissingRequiredPackPaths", () => {
  it("requires the installed-package UI rebuild files in npm pack output", () => {
    expect(
      collectMissingRequiredPackPaths([
        "dist/index.js",
        "dist/entry.js",
        "dist/plugin-sdk/root-alias.cjs",
        "dist/build-info.json",
      ]),
    ).toEqual(
      expect.arrayContaining([
        "scripts/ui.js",
        "ui/index.html",
        "ui/package.json",
        "ui/src/main.ts",
        "ui/vite.config.ts",
      ]),
    );
  });

  it("accepts pack output that includes the UI rebuild files", () => {
    const missing = collectMissingRequiredPackPaths([
      "dist/index.js",
      "dist/entry.js",
      "dist/plugin-sdk/root-alias.cjs",
      "dist/build-info.json",
      "scripts/ui.js",
      "ui/index.html",
      "ui/package.json",
      "ui/src/main.ts",
      "ui/vite.config.ts",
    ]);

    expect(missing).not.toContain("scripts/ui.js");
    expect(missing).not.toContain("ui/index.html");
    expect(missing).not.toContain("ui/package.json");
    expect(missing).not.toContain("ui/src/main.ts");
    expect(missing).not.toContain("ui/vite.config.ts");
  });
});

describe("collectPackUnpackedSizeErrors", () => {
  it("accepts pack results within the unpacked size budget", () => {
    expect(
      collectPackUnpackedSizeErrors([makePackResult("openclaw-2026.3.14.tgz", 120_354_302)]),
    ).toEqual([]);
  });

  it("flags oversized pack results that risk low-memory startup failures", () => {
    expect(
      collectPackUnpackedSizeErrors([makePackResult("openclaw-2026.3.12.tgz", 224_002_564)]),
    ).toEqual([
      "openclaw-2026.3.12.tgz unpackedSize 224002564 bytes (213.6 MiB) exceeds budget 167772160 bytes (160.0 MiB). Investigate duplicate channel shims, copied extension trees, or other accidental pack bloat before release.",
    ]);
  });

  it("fails closed when npm pack output omits unpackedSize for every result", () => {
    expect(
      collectPackUnpackedSizeErrors([
        { filename: "openclaw-2026.3.14.tgz" },
        { filename: "openclaw-extra.tgz", unpackedSize: Number.NaN },
      ]),
    ).toEqual([
      "npm pack --dry-run produced no unpackedSize data; pack size budget was not verified.",
    ]);
  });
});
