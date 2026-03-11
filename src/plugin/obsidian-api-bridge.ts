import type { App } from "obsidian";

export interface ObsidianApiInfo {
  apiKey: string;
  url: string;
}

interface ObsidianPluginManager {
  plugins: Record<string, { settings?: Record<string, unknown> }>;
  enabledPlugins?: Set<string>;
}

export function detectObsidianApi(app: App): ObsidianApiInfo | null {
  const plugins = (app as unknown as { plugins: ObsidianPluginManager }).plugins;
  if (!plugins?.plugins?.["obsidian-api"]) {
    return null;
  }

  const plugin = plugins.plugins["obsidian-api"];
  if (!plugins.enabledPlugins?.has("obsidian-api")) {
    return null;
  }

  const settings = plugin.settings;
  if (!settings?.apiKey) {
    return null;
  }

  let url: string;
  if (settings.enableInsecureServer && settings.insecurePort) {
    url = `http://${settings.bindingHost || "127.0.0.1"}:${settings.insecurePort}`;
  } else {
    url = `https://${settings.bindingHost || "127.0.0.1"}:${settings.port || 27124}`;
  }

  return { apiKey: settings.apiKey, url };
}
