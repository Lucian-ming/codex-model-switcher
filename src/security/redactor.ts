/**
 * Utility functions for redacting sensitive secrets in logs and diagnostics.
 */

export function sanitizeSecret(secret: string): string {
  if (!secret || secret.length <= 8) {
    return '***';
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}****${suffix}`;
}

export function sanitizeText(text: string): string {
  if (!text) return text;
  // Match Bearer tokens, OpenAI/OpenRouter keys (sk-...), and generic keys
  return text
    .replace(/(sk-[a-zA-Z0-9_\-]{4})[a-zA-Z0-9_\-]+([a-zA-Z0-9_\-]{4})/g, '$1****$2')
    .replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1****')
    .replace(/("api_?key"\s*:\s*")[^"]+(")/gi, '$1****$2')
    .replace(/("Authorization"\s*:\s*")[^"]+(")/gi, '$1****$2');
}

export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('auth')) {
      if (typeof value === 'string') {
        result[key] = sanitizeSecret(value);
      } else {
        result[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
