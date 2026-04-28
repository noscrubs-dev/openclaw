import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const WORKSPACE_TEMPLATE_PACK_PATHS = [
  "docs/reference/templates/AGENTS.md",
  "docs/reference/templates/SOUL.md",
  "docs/reference/templates/TOOLS.md",
  "docs/reference/templates/IDENTITY.md",
  "docs/reference/templates/USER.md",
  "docs/reference/templates/HEARTBEAT.md",
  "docs/reference/templates/BOOTSTRAP.md",
];

const REQUIRED_BOOTSTRAP_WORKSPACE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
];

function collectMissingBootstrapWorkspaceFiles(workspaceDir) {
  return REQUIRED_BOOTSTRAP_WORKSPACE_FILES.filter(
    (filename) => !existsSync(join(workspaceDir, filename)),
  );
}

async function loadExtensionApi(packageRoot) {
  return await import(pathToFileURL(join(packageRoot, "dist", "extensionAPI.js")).href);
}

export async function runInstalledWorkspaceBootstrapSmoke(params) {
  const tempRoot = mkdtempSync(join(tmpdir(), "openclaw-workspace-bootstrap-smoke-"));
  const homeDir = join(tempRoot, "home");
  mkdirSync(homeDir, { recursive: true });

  try {
    const workspaceDir = join(homeDir, ".openclaw", "workspace");
    const previousHome = process.env.HOME;
    const previousOpenClawHome = process.env.OPENCLAW_HOME;
    const previousSuppressNotes = process.env.OPENCLAW_SUPPRESS_EXTENSION_API_WARNING;
    try {
      process.env.HOME = homeDir;
      process.env.OPENCLAW_HOME = homeDir;
      process.env.OPENCLAW_SUPPRESS_EXTENSION_API_WARNING = "1";
      const extensionApi = await loadExtensionApi(params.packageRoot);
      if (typeof extensionApi.ensureAgentWorkspace !== "function") {
        throw new Error("installed workspace bootstrap missing ensureAgentWorkspace export");
      }
      await extensionApi.ensureAgentWorkspace({ dir: workspaceDir, ensureBootstrapFiles: true });
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousOpenClawHome === undefined) {
        delete process.env.OPENCLAW_HOME;
      } else {
        process.env.OPENCLAW_HOME = previousOpenClawHome;
      }
      if (previousSuppressNotes === undefined) {
        delete process.env.OPENCLAW_SUPPRESS_EXTENSION_API_WARNING;
      } else {
        process.env.OPENCLAW_SUPPRESS_EXTENSION_API_WARNING = previousSuppressNotes;
      }
    }

    const missingFiles = collectMissingBootstrapWorkspaceFiles(workspaceDir);
    if (missingFiles.length > 0) {
      throw new Error(
        `installed workspace bootstrap did not create required files in ${workspaceDir}: ${missingFiles.join(", ")}`,
      );
    }
  } finally {
    try {
      rmSync(tempRoot, { force: true, recursive: true });
    } catch {
      // best effort cleanup only
    }
  }
}
