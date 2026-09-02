import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PathResolver } from '../codex/pathResolver.js';
import { CodexConfigManager } from '../codex/configManager.js';
import { ProviderRegistry } from '../providers/registry.js';
import { sanitizeText } from '../security/redactor.js';

const execAsync = promisify(exec);

export class DiagnosticsRunner {
  public static async run(
    configManager: CodexConfigManager,
    registry: ProviderRegistry,
    outputChannel: vscode.OutputChannel
  ): Promise<void> {
    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine('==================================================');
    outputChannel.appendLine('Codex Model Switcher: Diagnostic Report');
    outputChannel.appendLine('==================================================\n');

    const env = PathResolver.resolve();

    // 1. Environment
    outputChannel.appendLine('--- Environment ---');
    outputChannel.appendLine(`OS Platform:     ${env.platform}`);
    outputChannel.appendLine(`Is WSL:          ${env.isWsl ? 'YES' : 'NO'}`);
    outputChannel.appendLine(`WSL Distro:      ${env.wslDistro || 'N/A'}`);
    outputChannel.appendLine(`VS Code Remote:  ${vscode.env.remoteName || 'Local'}`);
    outputChannel.appendLine(`Home Directory:  ${env.homeDir}`);
    outputChannel.appendLine(`Codex Home:      ${env.codexHome}\n`);

    // 2. Codex Executable
    outputChannel.appendLine('--- Codex Executable ---');
    outputChannel.appendLine(`Executable Path: ${env.codexExecutable || 'Not Found'}`);
    if (env.codexExecutable) {
      try {
        const { stdout } = await execAsync(`"${env.codexExecutable}" --version`);
        outputChannel.appendLine(`Version:         ${stdout.trim()}`);
      } catch (err: any) {
        outputChannel.appendLine(`Version Check:   Failed (${err.message})`);
      }
    } else {
      outputChannel.appendLine('Note: Codex CLI executable is not on PATH or standard extension directories.');
    }
    outputChannel.appendLine('');

    // 3. Configuration Files
    outputChannel.appendLine('--- Configuration Files ---');
    outputChannel.appendLine(`config.toml:     ${env.configTomlPath}`);
    const configExists = fs.existsSync(env.configTomlPath);
    outputChannel.appendLine(`  Exists:        ${configExists ? 'YES' : 'NO'}`);
    if (configExists) {
      try {
        const stat = fs.statSync(env.configTomlPath);
        outputChannel.appendLine(`  File Size:     ${stat.size} bytes`);
        outputChannel.appendLine(`  Mode:          ${(stat.mode & 0o777).toString(8)}`);
        const cfg = configManager.read();
        outputChannel.appendLine(`  Active Model:  ${cfg.model || 'None'}`);
        outputChannel.appendLine(`  Review Model:  ${cfg.review_model || 'None'}`);
        outputChannel.appendLine(`  Active Provider:${cfg.model_provider || 'None'}`);
        outputChannel.appendLine(`  Reasoning:     ${cfg.model_reasoning_effort || 'default'}`);
        outputChannel.appendLine(`  Custom Catalog:${cfg.model_catalog_json || 'Not set'}`);
      } catch (e: any) {
        outputChannel.appendLine(`  Parse Error:   ${e.message}`);
      }
    }

    outputChannel.appendLine(`auth.json:       ${env.authJsonPath}`);
    const authExists = fs.existsSync(env.authJsonPath);
    outputChannel.appendLine(`  Exists:        ${authExists ? 'YES' : 'NO'}`);
    if (authExists) {
      try {
        const stat = fs.statSync(env.authJsonPath);
        outputChannel.appendLine(`  Mode:          ${(stat.mode & 0o777).toString(8)}`);
        const authContent = JSON.parse(fs.readFileSync(env.authJsonPath, 'utf8'));
        const keys = Object.keys(authContent);
        outputChannel.appendLine(`  Stored Auth:   ${keys.join(', ')}`);
      } catch {}
    }

    outputChannel.appendLine(`model_catalog:   ${env.modelCatalogJsonPath}`);
    const catalogExists = fs.existsSync(env.modelCatalogJsonPath);
    outputChannel.appendLine(`  Exists:        ${catalogExists ? 'YES' : 'NO'}`);
    if (catalogExists) {
      try {
        const cat = JSON.parse(fs.readFileSync(env.modelCatalogJsonPath, 'utf8'));
        const count = cat.models?.length || 0;
        outputChannel.appendLine(`  Models in Cat: ${count}`);
      } catch {}
    }
    outputChannel.appendLine('');

    // 4. Configured Providers
    outputChannel.appendLine('--- Registered Providers ---');
    const providers = registry.list();
    outputChannel.appendLine(`Total Providers: ${providers.length}`);
    for (const p of providers) {
      outputChannel.appendLine(`  [${p.id}] ${p.name}`);
      outputChannel.appendLine(`    URL:         ${sanitizeText(p.baseUrl || 'N/A')}`);
      outputChannel.appendLine(`    Protocol:    ${p.protocol}`);
      outputChannel.appendLine(`    Models:      ${p.models?.length || 0}`);
      outputChannel.appendLine(`    Health:      ${p.healthStatus || 'untested'}${p.latencyMs ? ` (${p.latencyMs}ms)` : ''}`);
    }
    outputChannel.appendLine('');

    // 5. Backups
    outputChannel.appendLine('--- Backup History ---');
    const backups = configManager.listBackups();
    outputChannel.appendLine(`Total Backups:   ${backups.length}`);
    for (const b of backups.slice(0, 5)) {
      outputChannel.appendLine(`  ${b.filename} (${b.size} bytes)`);
    }

    outputChannel.appendLine('\n==================================================');
    outputChannel.appendLine('Diagnostic complete.');
    vscode.window.showInformationMessage('Codex diagnostic report generated in output channel.');
  }
}
