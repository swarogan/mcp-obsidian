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

  const host = String(settings.bindingHost || "127.0.0.1");
  let url: string;
  if (settings.enableInsecureServer && settings.insecurePort) {
    url = `http://${host}:${String(settings.insecurePort)}`;
  } else {
    url = `https://${host}:${String(settings.port || 27124)}`;
  }

  return { apiKey: String(settings.apiKey), url };
}
