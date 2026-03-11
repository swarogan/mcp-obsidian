import { Notice, PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type McpObsidianPlugin from "./main";
import { detectObsidianApi } from "./obsidian-api-bridge";
import { installMcpServer, uninstallMcpServer, getInstalledVersion } from "./npm-install";

export class McpObsidianSettingTab extends PluginSettingTab {
  plugin: McpObsidianPlugin;
  private installedVersion: string | null = null;
  private versionChecked = false;

  constructor(app: App, plugin: McpObsidianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("MCP tools settings").setHeading();

    // --- Status obsidian-api ---
    const info = detectObsidianApi(this.plugin.app);
    const statusEl = containerEl.createEl("div", {
      cls: "setting-item-description",
    });
    if (info) {
      statusEl.setText("obsidian-api detected — API key and URL auto-configured.");
      statusEl.style.color = "var(--text-success)";
    } else {
      statusEl.setText("obsidian-api not found — configure manually below.");
      statusEl.style.color = "var(--text-warning)";
    }
    statusEl.style.marginBottom = "1em";

    // --- Auto-detect toggle ---
    new Setting(containerEl)
      .setName("Auto-detect obsidian-api")
      .setDesc("Automatically read API key and URL from obsidian-api plugin")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoDetectApiKey)
          .onChange(async (value) => {
            this.plugin.settings.autoDetectApiKey = value;
            if (value) {
              this.plugin.autoDetect();
            }
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    // --- API Key ---
    new Setting(containerEl)
      .setName("API key")
      .setDesc("REST API bearer token")
      .addText((text) =>
        text
          .setPlaceholder("API key")
          .setValue(this.plugin.settings.obsidianApiKey)
          .setDisabled(this.plugin.settings.autoDetectApiKey && !!info)
          .onChange(async (value) => {
            this.plugin.settings.obsidianApiKey = value;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((button) =>
        button.setButtonText("Copy").onClick(async () => {
          await navigator.clipboard.writeText(this.plugin.settings.obsidianApiKey);
        }),
      );

    // --- API URL ---
    new Setting(containerEl)
      .setName("API url")
      .setDesc("REST API base URL")
      .addText((text) =>
        text
          .setPlaceholder("https://127.0.0.1:27124")
          .setValue(this.plugin.settings.obsidianApiUrl)
          .setDisabled(this.plugin.settings.autoDetectApiKey && !!info)
          .onChange(async (value) => {
            this.plugin.settings.obsidianApiUrl = value;
            await this.plugin.saveSettings();
          }),
      );

    // --- Timeout ---
    new Setting(containerEl)
      .setName("Request timeout (ms)")
      .setDesc("Timeout for MCP server requests to obsidian-api")
      .addText((text) =>
        text
          .setPlaceholder("30000")
          .setValue(String(this.plugin.settings.requestTimeoutMs))
          .onChange(async (value) => {
            const ms = parseInt(value, 10);
            if (!isNaN(ms) && ms > 0) {
              this.plugin.settings.requestTimeoutMs = ms;
              await this.plugin.saveSettings();
            }
          }),
      );

    // --- MCP Server Install ---
    new Setting(containerEl).setName("MCP server").setHeading();

    const installSetting = new Setting(containerEl).setName("mcp-obsidian");

    if (!this.versionChecked) {
      installSetting.setDesc("Checking...");
      getInstalledVersion().then((version) => {
        this.installedVersion = version;
        this.versionChecked = true;
        this.display();
      });
    } else if (this.installedVersion) {
      installSetting.setDesc(`Installed: v${this.installedVersion}`);
      installSetting.addButton((button) =>
        button
          .setButtonText("Reinstall")
          .onClick(async () => {
            try {
              new Notice("Installing mcp-obsidian...");
              await installMcpServer();
              this.installedVersion = await getInstalledVersion();
              new Notice("mcp-obsidian reinstalled.");
              this.display();
            } catch (e) {
              new Notice(`Install failed: ${e}`);
            }
          }),
      );
      installSetting.addButton((button) =>
        button
          .setButtonText("Uninstall")
          .setWarning()
          .onClick(async () => {
            try {
              await uninstallMcpServer();
              this.installedVersion = null;
              new Notice("mcp-obsidian uninstalled.");
              this.display();
            } catch (e) {
              new Notice(`Uninstall failed: ${e}`);
            }
          }),
      );
    } else {
      installSetting.setDesc("Not installed");
      installSetting.addButton((button) =>
        button
          .setButtonText("Install")
          .setCta()
          .onClick(async () => {
            try {
              new Notice("Installing mcp-obsidian...");
              await installMcpServer();
              this.installedVersion = await getInstalledVersion();
              new Notice("mcp-obsidian installed.");
              this.display();
            } catch (e) {
              new Notice(`Install failed: ${e}`);
            }
          }),
      );
    }

    // --- MCP Config ---
    new Setting(containerEl).setName("MCP configuration").setHeading();
    new Setting(containerEl)
      .setDesc("Add this to your MCP client config (Claude Code, Claude Desktop, etc.):");

    const mcpConfig = JSON.stringify(
      {
        mcpServers: {
          obsidian: {
            command: "npx",
            args: ["-y", "mcp-obsidian"],
            env: {
              OBSIDIAN_API_KEY: this.plugin.settings.obsidianApiKey || "<your-api-key>",
              OBSIDIAN_REST_URL: this.plugin.settings.obsidianApiUrl,
            },
          },
        },
      },
      null,
      2,
    );

    const codeEl = containerEl.createEl("pre");
    codeEl.createEl("code", { text: mcpConfig });
    codeEl.style.userSelect = "all";
    codeEl.style.cursor = "pointer";
    codeEl.style.fontSize = "0.85em";

    new Setting(containerEl).addButton((button) =>
      button.setButtonText("Copy MCP config").onClick(async () => {
        await navigator.clipboard.writeText(mcpConfig);
        new Notice("MCP config copied to clipboard.");
      }),
    );
  }
}
