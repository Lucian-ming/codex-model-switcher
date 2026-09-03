# Codex 模型切换器 (Codex Model Switcher)

<p align="center">
  <strong>在 VS Code 中自由管理与极速切换 OpenAI Codex 的第三方中转站、大语言模型、上下文容量与系统提示词。</strong>
</p>

<p align="center">
  <a href="https://github.com/Lucian-ming/codex-model-switcher/actions/workflows/ci.yml"><img src="https://github.com/Lucian-ming/codex-model-switcher/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://github.com/Lucian-ming/codex-model-switcher/releases"><img src="https://img.shields.io/github/v/release/Lucian-ming/codex-model-switcher?color=blue" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="README.md"><img src="https://img.shields.io/badge/README-English-blue" alt="English Documentation" /></a>
</p>

---

## 🌟 项目亮点

**Codex 模型切换器 (Codex Model Switcher)** 是专为 OpenAI Codex 打造的一站式服务商接入与模型热切换 VS Code 扩展。支持原生 Remote-WSL、Linux、macOS 与 Windows 环境。

它彻底打破了官方 Codex 对单一 API Endpoint 的绑定限制，让开发者能够自由使用 **OrcaRouter、OpenRouter、DeepSeek、月之暗面 Kimi、硅基流动 SiliconFlow、通义千问 Qwen、智谱 GLM、本地 Ollama** 以及各类私有中转站。

### 核心特性
- 🚀 **极速静默切换（Zero-Interruption）**：毫秒级原子修改 `~/.codex/config.toml` 与 `model_catalog.json`，状态栏实时更新，**完全不重启窗口、不打断编程心流**。
- 🌐 **多服务商并发管理**：原生支持 OrcaRouter、OpenRouter 等聚合网关，支持同时配置多个第三方中转站，所有站点的模型统一汇聚，自由按需切换。
- 👁 **一键禁用/隐藏**：支持禁用整个中转站或隐藏某个具体模型，彻底保持快速切换列表清爽。
- 📏 **四层高精度上下文容量引擎**：
  - 深度兼容 12 种网关扩展字段（`context_length`, `max_tokens`, `max_model_len` 等）；
  - 模型名规格后缀智能正则识别（如 `-32k`、`-128k`、`-1m`）；
  - 全球主流大模型规格指纹库（Claude 3.5 为 200K、Gemini 1.5/2.0 为 1M/2M、o1/o3 为 200K 等）；
  - 支持一键齿轮自定义覆盖（Override）。
- 📝 **系统提示词定制（Prompt System）**：
  - **全局基础提示词 (`base_instructions`)**：可视化编辑，Ctrl+S 保存即刻热注入；
  - **项目级最高优先级指令 (`AGENTS.md`)**：一键在当前工作区生成官方标准模板。
- 🛡 **企业级凭据加密存储**：API Key 安全托管在 VS Code `SecretStorage`（或 `0600` 权限安全凭据库），代码库、日志与 Git 零泄露风险。
- ⚡ **无缝无感接入**：纯配置层编排，无需修改任何官方插件二进制或逆向补丁。

---

## 📐 架构原理

```
                    ┌──────────────────────────────────┐
                    │       VS Code UI / 交互层        │
                    │  - 状态栏 $(sparkle) Codex       │
                    │  - 侧边栏活动栏树状视图          │
                    │  - 快捷切换 (Ctrl+Alt+M)         │
                    │  - 提示词与上下文设置            │
                    └─────────────────┬────────────────┘
                                      │
                          Codex Model Switcher 核心
                                      │
     ┌─────────────────┬──────────────┴───────────────┬─────────────────┐
     │                 │                              │                 │
     ▼                 ▼                              ▼                 ▼
┌──────────┐   ┌───────────────┐              ┌───────────────┐   ┌────────────┐
│ Provider │   │ Model Catalog │              │ Codex Config  │   │  Security  │
│ 注册中心 │   │   & Discovery │              │    Manager    │   │  安全存储  │
│          │   │               │              │               │   │            │
│- 预设模版│   │- /v1/models   │              │- TOML 读写器  │   │- VS Code   │
│- 连通测试│   │- 多字段推导   │              │- 原子写入保障 │   │  Secret-   │
│- 启停控制│   │- 注入并导出至 │              │- 历史备份回滚 │   │  Storage   │
│- 毫秒生成│   │  catalog.json │              │- 变动监听器   │   │- 0600 凭据 │
└────┬─────┘   └───────┬───────┘              └───────┬───────┘   └────────────┘
     │                 │                              │
     │                 │                              │
     ▼                 ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
     官方 Codex 运行时与底层架构
  1. ~/.codex/config.toml (服务商配置与当前模型指向)
  2. ~/.codex/model_catalog.json (注入多站聚合模型元数据)
  3. ~/.codex-model-switcher/base_instructions.md (系统提示词)
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ 快捷键与常用命令

| 快捷键 | 命令描述 | 内部命令 ID |
| :--- | :--- | :--- |
| `Ctrl + Alt + M` | 快速弹出模型切换器 | `codexModelSwitcher.switchModel` |
| `Ctrl + Alt + P` | 快速切换活动服务商 | `codexModelSwitcher.switchProvider` |
| - | 添加自定义中转站 | `codexModelSwitcher.addProvider` |
| - | 修改全局系统提示词 | `codexModelSwitcher.editBaseInstructions` |
| - | 在当前项目创建指令 (`AGENTS.md`) | `codexModelSwitcher.createProjectInstructions` |
| - | 重启扩展主机 (轻量重载) | `codexModelSwitcher.restartExtensionHost` |
| - | 重新加载窗口 (彻底重置) | `codexModelSwitcher.reloadWindow` |

---

## 📦 安装方法

### 方式一：从 GitHub Releases 下载安装
1. 前往 [Releases 页面](https://github.com/Lucian-ming/codex-model-switcher/releases) 下载最新版的 `.vsix` 文件；
2. 打开 VS Code，按下快捷键 `Ctrl + Shift + P`；
3. 输入并执行：`扩展: 从 VSIX 安装...` (Extensions: Install from VSIX...)，选择下载的文件即可。

### 方式二：源码编译安装
```bash
git clone https://github.com/Lucian-ming/codex-model-switcher.git
cd codex-model-switcher
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension *.vsix
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。欢迎提 PR 或 Issue！
