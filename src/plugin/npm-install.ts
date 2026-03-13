import { execFile } from "child_process";
import { homedir, platform } from "os";
import { join } from "path";

const PACKAGE = "@swarogan/obsidian-mcp-rest";

function prefixArgs(): string[] {
  // Linux npm global defaults to /usr which requires root.
  // ~/.local/bin is typically in PATH on modern Linux distros.
  // Windows/macOS npm global installs to user-writable locations by default.
  if (platform() === "linux") {
    return ["--prefix", join(homedir(), ".local")];
  }
  return [];
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export function installMcpServer(): Promise<string> {
  return run("npm", ["install", "-g", ...prefixArgs(), PACKAGE]);
}

export function uninstallMcpServer(): Promise<string> {
  return run("npm", ["uninstall", "-g", ...prefixArgs(), PACKAGE]);
}

export async function getInstalledVersion(): Promise<string | null> {
  try {
    const out = await run("npm", ["ls", "-g", ...prefixArgs(), PACKAGE, "--depth=0", "--json"]);
    const data = JSON.parse(out);
    return data.dependencies?.[PACKAGE]?.version ?? null;
  } catch (_err: unknown) {
    return null;
  }
}
