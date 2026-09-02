import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sanitizeSecret, sanitizeText, sanitizeObject } from '../src/security/redactor.js';
import { SecretManager } from '../src/security/secretManager.js';

describe('Security and Redaction', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-test-'));
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should mask API keys properly', () => {
    expect(sanitizeSecret('sk-1234567890abcdef')).toBe('sk-1****cdef');
    expect(sanitizeSecret('short')).toBe('***');
  });

  it('should sanitize sensitive tokens in string logs', () => {
    const log = 'Request failed with key sk-abcdef1234567890xyz and Bearer my-secret-token-value';
    const clean = sanitizeText(log);
    expect(clean).not.toContain('sk-abcdef1234567890xyz');
    expect(clean).not.toContain('my-secret-token-value');
    expect(clean).toContain('sk-abcd****0xyz');
  });

  it('should recursively sanitize objects', () => {
    const data = {
      name: 'Test',
      apiKey: 'sk-9876543210zyxwvu',
      headers: {
        Authorization: 'Bearer super-secret-12345'
      }
    };
    const sanitized = sanitizeObject(data);
    expect((sanitized as any).apiKey).toBe('sk-9****xwvu');
  });

  it('should store secrets securely with 0600 file permissions in fallback mode', async () => {
    const sm = new SecretManager(undefined, tempDir);
    await sm.storeSecret('provider.test.apiKey', 'sk-super-secret');

    const retrieved = await sm.getSecret('provider.test.apiKey');
    expect(retrieved).toBe('sk-super-secret');

    const credFile = path.join(tempDir, 'credentials.json');
    expect(fs.existsSync(credFile)).toBe(true);

    if (process.platform !== 'win32') {
      const stat = fs.statSync(credFile);
      expect((stat.mode & 0o777)).toBe(0o600);
    }

    await sm.deleteSecret('provider.test.apiKey');
    expect(await sm.getSecret('provider.test.apiKey')).toBeUndefined();
  });
});
