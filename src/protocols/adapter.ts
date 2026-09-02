export type WireApiProtocol = 'responses' | 'chat' | 'anthropic' | 'custom';

export interface ProtocolCapabilities {
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsReasoningTokens: boolean;
  supportsResponsesApi: boolean;
}

export interface ProtocolAdapter {
  readonly protocol: WireApiProtocol;
  getCapabilities(): ProtocolCapabilities;
  normalizeModelsEndpoint(baseUrl: string): string;
  formatAuthHeader(apiKey: string): Record<string, string>;
}

export class ResponsesProtocolAdapter implements ProtocolAdapter {
  readonly protocol: WireApiProtocol = 'responses';

  getCapabilities(): ProtocolCapabilities {
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoningTokens: true,
      supportsResponsesApi: true
    };
  }

  normalizeModelsEndpoint(baseUrl: string): string {
    const clean = baseUrl.replace(/\/+$/, '');
    return clean.endsWith('/models') ? clean : `${clean}/models`;
  }

  formatAuthHeader(apiKey: string): Record<string, string> {
    return { 'Authorization': `Bearer ${apiKey}` };
  }
}

export class ChatCompletionsProtocolAdapter implements ProtocolAdapter {
  readonly protocol: WireApiProtocol = 'chat';

  getCapabilities(): ProtocolCapabilities {
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoningTokens: false,
      supportsResponsesApi: false
    };
  }

  normalizeModelsEndpoint(baseUrl: string): string {
    const clean = baseUrl.replace(/\/+$/, '');
    return clean.endsWith('/models') ? clean : `${clean}/models`;
  }

  formatAuthHeader(apiKey: string): Record<string, string> {
    return { 'Authorization': `Bearer ${apiKey}` };
  }
}

export class AnthropicProtocolAdapter implements ProtocolAdapter {
  readonly protocol: WireApiProtocol = 'anthropic';

  getCapabilities(): ProtocolCapabilities {
    return {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoningTokens: true,
      supportsResponsesApi: false
    };
  }

  normalizeModelsEndpoint(baseUrl: string): string {
    const clean = baseUrl.replace(/\/+$/, '');
    return clean.endsWith('/models') ? clean : `${clean}/models`;
  }

  formatAuthHeader(apiKey: string): Record<string, string> {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  }
}

export class ProtocolAdapterFactory {
  public static getAdapter(protocol: WireApiProtocol): ProtocolAdapter {
    switch (protocol) {
      case 'anthropic':
        return new AnthropicProtocolAdapter();
      case 'chat':
        return new ChatCompletionsProtocolAdapter();
      case 'responses':
      default:
        return new ResponsesProtocolAdapter();
    }
  }
}
