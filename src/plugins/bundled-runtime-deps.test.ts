import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
};

function readJson<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
}

describe("bundled plugin runtime dependencies", () => {
  function expectPluginDeclaresRuntimeDep(pluginPath: string, dependencyName: string) {
    const pluginManifest = readJson<PackageManifest>(pluginPath);
    const pluginSpec = pluginManifest.dependencies?.[dependencyName];

    expect(pluginSpec).toBeTruthy();
  }

  function expectPluginOwnsRuntimeDep(pluginPath: string, dependencyName: string) {
    const rootManifest = readJson<PackageManifest>("package.json");
    const pluginManifest = readJson<PackageManifest>(pluginPath);
    const pluginSpec = pluginManifest.dependencies?.[dependencyName];
    const rootSpec = rootManifest.dependencies?.[dependencyName];

    expect(pluginSpec).toBeTruthy();
    expect(rootSpec).toBeUndefined();
  }

  it("keeps bundled Feishu runtime deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/feishu/package.json", "@larksuiteoapi/node-sdk");
  });

  it("keeps memory-lancedb runtime deps plugin-local so packaged installs fetch them on demand", () => {
    expectPluginOwnsRuntimeDep("extensions/memory-lancedb/package.json", "@lancedb/lancedb");
  });

  it("keeps bundled Discord runtime deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/discord/package.json", "@buape/carbon");
  });

  it("keeps bundled Slack runtime deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/slack/package.json", "@slack/bolt");
  });

  it("keeps bundled Telegram runtime deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/telegram/package.json", "grammy");
  });

  it("keeps WhatsApp runtime deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/whatsapp/package.json", "@whiskeysockets/baileys");
  });

  it("keeps WhatsApp image helper deps plugin-local so bundled builds resolve Baileys peers", () => {
    expectPluginOwnsRuntimeDep("extensions/whatsapp/package.json", "jimp");
  });

  it("keeps bundled proxy-agent deps declared on the plugin package", () => {
    expectPluginDeclaresRuntimeDep("extensions/discord/package.json", "https-proxy-agent");
  });
});
