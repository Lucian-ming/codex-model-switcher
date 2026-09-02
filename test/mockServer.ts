import * as http from 'http';

export class MockProviderServer {
  private server?: http.Server;
  public port: number = 0;

  public async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || '';

        // 1. GET /v1/models or /models
        if (req.method === 'GET' && (url.endsWith('/models') || url.endsWith('/v1/models'))) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            data: [
              {
                id: 'mock-deepseek-r1',
                name: 'Mock DeepSeek R1',
                context_window: 128000
              },
              {
                id: 'mock-claude-3-7-sonnet',
                name: 'Mock Claude 3.7 Sonnet',
                context_window: 200000
              },
              {
                id: 'mock-qwen-coder',
                name: 'Mock Qwen 2.5 Coder',
                context_window: 32768
              }
            ]
          }));
          return;
        }

        // 2. POST /v1/responses or /responses (Codex Responses API wire protocol)
        if (req.method === 'POST' && (url.includes('/responses'))) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          res.write('event: response.created\ndata: {"response":{"id":"resp_123"}}\n\n');
          res.write('event: response.completed\ndata: {"response":{"id":"resp_123","status":"completed"}}\n\n');
          res.end();
          return;
        }

        // Fallback
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        resolve(`http://127.0.0.1:${this.port}/v1`);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
