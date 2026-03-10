import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";

const PACKAGE = "mcp-obsidian";

function userPrefix(): string {
  return join(homedir(), ".local");
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

export async function installMcpServer(): Promise<string> {
  return run("npm", ["install", "-g", "--prefix", userPrefix(), PACKAGE]);
}

export async function uninstallMcpServer(): Promise<string> {
  return run("npm", ["uninstall", "-g", "--prefix", userPrefix(), PACKAGE]);
}

export async function getInstalledVersion(): Promise<string | null> {
  try {
    const out = await run("npm", ["ls", "-g", "--prefix", userPrefix(), PACKAGE, "--depth=0", "--json"]);
    const data = JSON.parse(out);
    return data.dependencies?.[PACKAGE]?.version ?? null;
  } catch {
    return null;
  }
}
