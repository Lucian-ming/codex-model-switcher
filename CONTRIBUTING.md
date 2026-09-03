# Contributing to Codex Model Switcher

Thank you for your interest in contributing to **Codex Model Switcher**! We welcome bug reports, feature suggestions, documentation enhancements, and pull requests.

---

## 🛠️ Development Setup

### Prerequisites
- Node.js `>= 20.x`
- npm `>= 10.x`
- Visual Studio Code `>= 1.96.0`

### Getting Started

1. **Fork and Clone the repository**:
   ```bash
   git clone https://github.com/Lucian-ming/codex-model-switcher.git
   cd codex-model-switcher
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run compile
   ```

4. **Run automated test suites**:
   ```bash
   npm test
   ```

5. **Debug in VS Code**:
   - Open the project in VS Code: `code .`
   - Press `F5` to launch an **Extension Development Host** window.

---

## 🧪 Testing Guidelines

Before opening a pull request, ensure all checks pass:

```bash
# Type check and lint
npm run lint

# Compile bundle
npm run compile

# Run all test suites
npm test
```

When introducing new features or bug fixes, please write corresponding unit tests under the `test/` directory.

---

## 📦 Packaging

To package the extension into a `.vsix` file:

```bash
npx @vscode/vsce package --no-dependencies
```

---

## 📜 License

By contributing to Codex Model Switcher, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
