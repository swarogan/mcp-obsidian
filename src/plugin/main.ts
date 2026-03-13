import { Plugin } from "obsidian";
import type { McpObsidianSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { McpObsidianSettingTab } from "./settings";
import { detectObsidianApi } from "./obsidian-api-bridge";

export default class McpObsidianPlugin extends Plugin {
  settings!: McpObsidianSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    if (this.settings.autoDetectApiKey) {
      this.autoDetect();
    }

    this.addSettingTab(new McpObsidianSettingTab(this.app, this));

    console.debug("[obsidian-mcp-rest] Plugin loaded.");
  }

  onunload(): void {
    console.debug("[obsidian-mcp-rest] Plugin unloaded.");
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  autoDetect(): void {
    const info = detectObsidianApi(this.app);
    if (info) {
      this.settings.obsidianApiKey = info.apiKey;
      this.settings.obsidianApiUrl = info.url;
    }
  }
}
