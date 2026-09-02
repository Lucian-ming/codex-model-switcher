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
    outputChannel.appendLine('Codex 模型切换器: 系统与环境诊断报告');
    outputChannel.appendLine('==================================================\n');

    const env = PathResolver.resolve();

    // 1. 系统与运行环境
    outputChannel.appendLine('--- 1. 运行环境 ---');
    outputChannel.appendLine(`操作系统平台:    ${env.platform}`);
    outputChannel.appendLine(`是否运行在 WSL:  ${env.isWsl ? '是 (WSL2)' : '否 (本地系统)'}`);
    outputChannel.appendLine(`WSL 发行版名称:  ${env.wslDistro || '无'}`);
    outputChannel.appendLine(`VS Code 远端模式:${vscode.env.remoteName || '本地窗口'}`);
    outputChannel.appendLine(`用户 Home 目录:  ${env.homeDir}`);
    outputChannel.appendLine(`Codex 主配置目录:${env.codexHome}\n`);

    // 2. Codex CLI 二进制
    outputChannel.appendLine('--- 2. Codex CLI 运行路径 ---');
    outputChannel.appendLine(`可执行文件路径:  ${env.codexExecutable || '未找到'}`);
    if (env.codexExecutable) {
      try {
        const { stdout } = await execAsync(`"${env.codexExecutable}" --version`);
        outputChannel.appendLine(`实际运行版本:    ${stdout.trim()}`);
      } catch (err: any) {
        outputChannel.appendLine(`版本获取失败:    ${err.message}`);
      }
    } else {
      outputChannel.appendLine('提示: 未在 PATH 或标准扩展目录中探测到 codex 命令行程序。');
    }
    outputChannel.appendLine('');

    // 3. 配置文件探测
    outputChannel.appendLine('--- 3. 配置文件状态 ---');
    outputChannel.appendLine(`config.toml:     ${env.configTomlPath}`);
    const configExists = fs.existsSync(env.configTomlPath);
    outputChannel.appendLine(`  是否存在:      ${configExists ? '存在' : '不存在'}`);
    if (configExists) {
      try {
        const stat = fs.statSync(env.configTomlPath);
        outputChannel.appendLine(`  文件大小:      ${stat.size} 字节`);
        outputChannel.appendLine(`  文件权限:      ${(stat.mode & 0o777).toString(8)}`);
        const cfg = configManager.read();
        outputChannel.appendLine(`  当前激活模型:  ${cfg.model || '未设置'}`);
        outputChannel.appendLine(`  审查模型:      ${cfg.review_model || '未设置'}`);
        outputChannel.appendLine(`  当前服务商:    ${cfg.model_provider || '未设置'}`);
        outputChannel.appendLine(`  推理等级:      ${cfg.model_reasoning_effort || '默认'}`);
        outputChannel.appendLine(`  注入模型目录:  ${cfg.model_catalog_json || '未配置'}`);
      } catch (e: any) {
        outputChannel.appendLine(`  TOML 解析错误: ${e.message}`);
      }
    }

    outputChannel.appendLine(`auth.json:       ${env.authJsonPath}`);
    const authExists = fs.existsSync(env.authJsonPath);
    outputChannel.appendLine(`  是否存在:      ${authExists ? '存在' : '不存在'}`);
    if (authExists) {
      try {
        const stat = fs.statSync(env.authJsonPath);
        outputChannel.appendLine(`  文件权限:      ${(stat.mode & 0o777).toString(8)}`);
        const authContent = JSON.parse(fs.readFileSync(env.authJsonPath, 'utf8'));
        const keys = Object.keys(authContent);
        outputChannel.appendLine(`  已存凭据字段:  ${keys.join(', ')}`);
      } catch {}
    }

    outputChannel.appendLine(`model_catalog:   ${env.modelCatalogJsonPath}`);
    const catalogExists = fs.existsSync(env.modelCatalogJsonPath);
    outputChannel.appendLine(`  是否存在:      ${catalogExists ? '存在' : '不存在'}`);
    if (catalogExists) {
      try {
        const cat = JSON.parse(fs.readFileSync(env.modelCatalogJsonPath, 'utf8'));
        const count = cat.models?.length || 0;
        outputChannel.appendLine(`  目录内模型数:  ${count}`);
      } catch {}
    }
    outputChannel.appendLine('');

    // 4. 已注册中转站
    outputChannel.appendLine('--- 4. 当前已注册中转站 / 服务商 ---');
    const providers = registry.list();
    outputChannel.appendLine(`服务商总数:      ${providers.length}`);
    for (const p of providers) {
      outputChannel.appendLine(`  [${p.id}] ${p.name}`);
      outputChannel.appendLine(`    端点地址:    ${sanitizeText(p.baseUrl || '官方默认')}`);
      outputChannel.appendLine(`    通信协议:    ${p.protocol}`);
      outputChannel.appendLine(`    模型数量:    ${p.models?.length || 0}`);
      outputChannel.appendLine(`    健康状态:    ${p.healthStatus || '未检测'}${p.latencyMs ? ` (${p.latencyMs}ms)` : ''}`);
    }
    outputChannel.appendLine('');

    // 5. 备份历史
    outputChannel.appendLine('--- 5. 历史配置备份 ---');
    const backups = configManager.listBackups();
    outputChannel.appendLine(`历史备份数量:    ${backups.length}`);
    for (const b of backups.slice(0, 5)) {
      outputChannel.appendLine(`  ${b.filename} (${b.size} 字节)`);
    }

    outputChannel.appendLine('\n==================================================');
    outputChannel.appendLine('诊断检查完成。');
    vscode.window.showInformationMessage('Codex 诊断报告已生成，请在输出面板中查看。');
  }
}
