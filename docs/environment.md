# Environment Diagnostic & Survey (Phase 0)

## 1. Operating System & WSL Architecture
- **Host OS**: Windows 11 (build architecture x86_64)
- **WSL Distribution**: Ubuntu (Linux 6.6.87.2-microsoft-standard-WSL2)
- **WSL User**: `lucian` (UID 1000, GID 1000)
- **WSL Home**: `/home/lucian`
- **Windows UNC Path**: `\\wsl.localhost\Ubuntu\home\lucian`
- **Project Directory**: `/home/lucian/projects/codex-model-switcher` (`\\wsl.localhost\Ubuntu\home\lucian\projects\codex-model-switcher`)

## 2. Runtime & Development Tools
- **Node.js**: `v20.20.2` (`/usr/local/bin/node`)
- **npm**: `10.8.2` (`/usr/local/bin/npm`)
- **Git**: `2.43.0` (`/usr/bin/git`)
- **Python**: `3.12.3` (`/usr/bin/python3`)
- **VS Code Extension Host**: Runs in WSL (`vscode-server`), connected from Windows VS Code via Remote-WSL (`vscode.env.remoteName === "wsl"`).

## 3. Codex CLI & Binary Installation
- **Binary Path**: `/home/lucian/.vscode-server/extensions/openai.chatgpt-26.825.51511-linux-x64/bin/linux-x86_64/codex`
- **Version**: `codex-cli 0.151.0-alpha.7.2`
- **Latest Upstream Version Check**: `version.json` indicates latest released version `0.147.0` (active version is pre-release alpha bundled with VS Code extension).

## 4. Codex Extension Architecture
- **Extension ID**: `openai.chatgpt`
- **Version**: `26.825.51511`
- **Platform**: `linux-x64`
- **Process Architecture**:
  1. VS Code Extension host spawns `codex app-server --stdio` inside WSL.
  2. The extension's webview UI communicates with `extension.js` via VS Code message passing.
  3. `extension.js` translates webview requests to JSON-RPC 2.0 messages over stdin/stdout to `codex app-server`.
  4. The model picker in the Codex webview calls the `model/list` RPC method.

## 5. Configuration & Auth Locations
- **Config Path**: `~/.codex/config.toml` (`/home/lucian/.codex/config.toml`)
- **Auth Path**: `~/.codex/auth.json` (`/home/lucian/.codex/auth.json`)
- **Current Configured Provider**: `PinAI`
- **Current Configured Model**: `gpt-5.6-sol`
- **Current Review Model**: `gpt-5.5`
- **Current Permissions**: All files owned by `lucian:lucian`, readable/writable with `0600` permissions on sensitive files.
