import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export const DEFAULT_INSTRUCTIONS = `You are a helpful assistant that can interact with the computer to solve coding and engineering tasks.`;

export class InstructionManager {
  private instructionsPath: string;

  constructor(customPath?: string) {
    this.instructionsPath = customPath || path.join(os.homedir(), '.codex-model-switcher', 'base_instructions.md');
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    try {
      const dir = path.dirname(this.instructionsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(this.instructionsPath)) {
        fs.writeFileSync(this.instructionsPath, DEFAULT_INSTRUCTIONS, { encoding: 'utf8', mode: 0o600 });
      }
    } catch (err) {
      console.error('Failed to initialize instructions file:', err);
    }
  }

  public getInstructionsPath(): string {
    return this.instructionsPath;
  }

  public getInstructions(): string {
    try {
      if (fs.existsSync(this.instructionsPath)) {
        const content = fs.readFileSync(this.instructionsPath, 'utf8').trim();
        if (content) return content;
      }
    } catch (err) {
      console.error('Failed to read custom instructions:', err);
    }
    return DEFAULT_INSTRUCTIONS;
  }

  public setInstructions(instructions: string): void {
    try {
      const dir = path.dirname(this.instructionsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(this.instructionsPath, instructions, { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.error('Failed to save custom instructions:', err);
      throw err;
    }
  }

  public reset(): void {
    this.setInstructions(DEFAULT_INSTRUCTIONS);
  }
}
