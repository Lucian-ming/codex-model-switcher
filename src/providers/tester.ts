import { ProviderConfig, ProviderHealth } from './types.js';

export class ProviderTester {
  public static async test(provider: ProviderConfig, apiKey?: string): Promise<ProviderHealth> {
    const startTime = Date.now();
    const headers: Record<string, string> = {
      'User-Agent': 'Codex-Model-Switcher/0.1.0',
      'Accept': 'application/json',
      ...(provider.headers || {})
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Determine candidate models endpoint
    let testUrl = provider.baseUrl.replace(/\/+$/, '');
    if (!testUrl.endsWith('/models') && !testUrl.endsWith('/v1/models')) {
      testUrl = `${testUrl}/models`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.status === 401 || response.status === 403) {
        return {
          reachable: true,
          latencyMs,
          authValid: false,
          modelCount: 0,
          message: `Authentication failed (HTTP ${response.status}). Please verify your API Key.`,
          error: `HTTP ${response.status}`
        };
      }

      if (!response.ok) {
        return {
          reachable: true,
          latencyMs,
          authValid: false,
          modelCount: 0,
          message: `Endpoint responded with HTTP error: ${response.status} ${response.statusText}`,
          error: `HTTP ${response.status}`
        };
      }

      const data = await response.json() as any;
      let count = 0;
      if (Array.isArray(data)) {
        count = data.length;
      } else if (data && Array.isArray(data.data)) {
        count = data.data.length;
      } else if (data && Array.isArray(data.models)) {
        count = data.models.length;
      }

      return {
        reachable: true,
        latencyMs,
        authValid: true,
        modelCount: count,
        message: `Endpoint reachable (${latencyMs}ms). Discovered ${count} models.`
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout ? 'Request timed out after 10 seconds' : err.message;

      return {
        reachable: false,
        latencyMs,
        authValid: false,
        modelCount: 0,
        message: `Connection failed: ${errMsg}`,
        error: errMsg
      };
    }
  }
}
