import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { listBundledPluginPackArtifacts } from "../scripts/lib/bundled-plugin-build-entries.mjs";
import { listPluginSdkDistArtifacts } from "../scripts/lib/plugin-sdk-entries.mjs";
import {
  collectAppcastSparkleVersionErrors,
  collectBundledExtensionManifestErrors,
  collectForbiddenPackPaths,
  collectMissingPackPaths,
  collectPackUnpackedSizeErrors,
  collectReachableDistRuntimeFiles,
  collectUndeclaredDistRuntimeDependencyErrors,
  collectUndeclaredRuntimePackages,
} from "../scripts/release-check.ts";

function makeItem(shortVersion: string, sparkleVersion: string): string {
  return `<item><title>${shortVersion}</title><sparkle:shortVersionString>${shortVersion}</sparkle:shortVersionString><sparkle:version>${sparkleVersion}</sparkle:version></item>`;
}

function makePackResult(filename: string, unpackedSize: number) {
  return { filename, unpackedSize };
}

const requiredPluginSdkPackPaths = [...listPluginSdkDistArtifacts(), "dist/plugin-sdk/compat.js"];
const requiredBundledPluginPackPaths = listBundledPluginPackArtifacts();

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

  it("flags invalid bundled extension minHostVersion metadata", () => {
    expect(
      collectBundledExtensionManifestErrors([
        {
          id: "broken",
          packageJson: {
            openclaw: {
              install: { npmSpec: "@openclaw/broken", minHostVersion: "2026.3.14" },
            },
          },
        },
      ]),
    ).toEqual([
      "bundled extension 'broken' manifest invalid | openclaw.install.minHostVersion must use a semver floor in the form \">=x.y.z\"",
    ]);
  });

  it("allows install metadata without npmSpec when only non-publish metadata is present", () => {
    expect(
      collectBundledExtensionManifestErrors([
        {
          id: "irc",
          packageJson: {
            openclaw: {
              install: { minHostVersion: ">=2026.3.14" },
            },
          },
        },
      ]),
    ).toEqual([]);
  });

  it("flags non-object install metadata instead of throwing", () => {
    expect(
      collectBundledExtensionManifestErrors([
        {
          id: "broken",
          packageJson: {
            openclaw: {
              install: 123,
            },
          },
        },
      ]),
    ).toEqual(["bundled extension 'broken' manifest invalid | openclaw.install must be an object"]);
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

describe("collectMissingPackPaths", () => {
  it("requires the shipped channel catalog, control ui, bundled metadata, and UI rebuild files", () => {
    const missing = collectMissingPackPaths([
      "dist/index.js",
      "dist/entry.js",
      "dist/plugin-sdk/compat.js",
      "dist/plugin-sdk/index.js",
      "dist/plugin-sdk/index.d.ts",
      "dist/plugin-sdk/root-alias.cjs",
      "dist/build-info.json",
    ]);

    expect(missing).toEqual(
      expect.arrayContaining([
        "dist/channel-catalog.json",
        "dist/control-ui/index.html",
        "dist/extensions/matrix/helper-api.js",
        "dist/extensions/matrix/runtime-api.js",
        "dist/extensions/matrix/thread-bindings-runtime.js",
        "dist/extensions/matrix/openclaw.plugin.json",
        "dist/extensions/matrix/package.json",
        "dist/extensions/whatsapp/light-runtime-api.js",
        "dist/extensions/whatsapp/runtime-api.js",
        "dist/extensions/whatsapp/openclaw.plugin.json",
        "dist/extensions/whatsapp/package.json",
        "scripts/ui.js",
        "ui/index.html",
        "ui/package.json",
        "ui/src/main.ts",
        "ui/vite.config.ts",
      ]),
    );
  });

  it("accepts the shipped upgrade surface when optional bundled metadata is present", () => {
    expect(
      collectMissingPackPaths([
        "dist/index.js",
        "dist/entry.js",
        "dist/control-ui/index.html",
        ...requiredBundledPluginPackPaths,
        ...requiredPluginSdkPackPaths,
        "dist/plugin-sdk/root-alias.cjs",
        "dist/build-info.json",
        "dist/channel-catalog.json",
        "scripts/ui.js",
        "ui/index.html",
        "ui/package.json",
        "ui/src/main.ts",
        "ui/vite.config.ts",
      ]),
    ).toEqual([]);
  });

  it("requires bundled plugin runtime sidecars that dynamic plugin boundaries resolve at runtime", () => {
    expect(requiredBundledPluginPackPaths).toEqual(
      expect.arrayContaining([
        "dist/extensions/matrix/helper-api.js",
        "dist/extensions/matrix/runtime-api.js",
        "dist/extensions/matrix/thread-bindings-runtime.js",
        "dist/extensions/whatsapp/light-runtime-api.js",
        "dist/extensions/whatsapp/runtime-api.js",
      ]),
    );
  });
});

describe("collectUndeclaredRuntimePackages", () => {
  it("normalizes subpath imports to package names before checking the root manifest", () => {
    expect(
      collectUndeclaredRuntimePackages({
        manifest: {
          dependencies: {
            "@slack/web-api": "^7.15.0",
            "discord-api-types": "^0.38.42",
          },
          peerDependencies: {
            "@napi-rs/canvas": "^0.1.89",
          },
        },
        importSpecifiers: ["@slack/web-api", "discord-api-types/v10", "@napi-rs/canvas"],
      }),
    ).toEqual([]);
  });

  it("flags runtime imports missing from root, optional, and peer dependency declarations", () => {
    expect(
      collectUndeclaredRuntimePackages({
        manifest: {
          dependencies: {
            "@slack/web-api": "^7.15.0",
          },
        },
        importSpecifiers: ["@slack/web-api", "@slack/bolt", "grammy"],
      }),
    ).toEqual(["@slack/bolt", "grammy"]);
  });
});

describe("collectUndeclaredDistRuntimeDependencyErrors", () => {
  it("reports undeclared packages with the dist files that import them", () => {
    expect(
      collectUndeclaredDistRuntimeDependencyErrors({
        manifest: {
          dependencies: {
            "@slack/web-api": "^7.15.0",
          },
        },
        files: [
          {
            path: "dist/auth-profiles.js",
            source: 'import { WebClient } from "@slack/web-api";\nimport { Bot } from "grammy";\n',
          },
          {
            path: "dist/telegram.js",
            source: 'export { run } from "@grammyjs/runner";\n',
          },
        ],
      }),
    ).toEqual([
      "dist runtime imports undeclared package '@grammyjs/runner' (dist/telegram.js).",
      "dist runtime imports undeclared package 'grammy' (dist/auth-profiles.js).",
    ]);
  });
});

describe("collectReachableDistRuntimeFiles", () => {
  it("limits runtime dependency checks to files reachable from the entry graph", () => {
    const root = mkdtempSync(join(tmpdir(), "openclaw-release-check-"));
    const distDir = join(root, "dist");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "index.js"), 'import "./shared.js";\n');
    writeFileSync(join(distDir, "shared.js"), 'await import("./lazy.js");\n');
    writeFileSync(join(distDir, "lazy.js"), 'import "declared-package";\n');
    writeFileSync(join(distDir, "orphan.js"), 'import "plugin-only-package";\n');

    expect(collectReachableDistRuntimeFiles([join(distDir, "index.js")])).toEqual([
      join(distDir, "index.js"),
      join(distDir, "lazy.js"),
      join(distDir, "shared.js"),
    ]);
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
      "openclaw-2026.3.12.tgz unpackedSize 224002564 bytes (213.6 MiB) exceeds budget 199229440 bytes (190.0 MiB). Investigate duplicate channel shims, copied extension trees, or other accidental pack bloat before release.",
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
