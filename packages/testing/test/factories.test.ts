import {
  createErrorResponse,
  createEventChunk,
  createFixture,
  createImageChunk,
  createLifecycleError,
  createPromptRequest,
  createPromptsListRequest,
  createResourceRequest,
  createResourcesListRequest,
  createStreamingChunks,
  createSuccessResponse,
  createToolRequest,
  createToolsListRequest,
  ErrorCodes,
} from '../src/factories';

describe('Fixture Factories', () => {
  describe('createToolRequest', () => {
    it('should create a valid tool request with default ID', () => {
      const request = createToolRequest('echo', { message: 'hello' });

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: { message: 'hello' },
        },
      });
    });

    it('should create a tool request with custom ID', () => {
      const request = createToolRequest('translate', { text: 'hello', lang: 'es' }, 'custom-id');

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 'custom-id',
        method: 'tools/call',
        params: {
          name: 'translate',
          arguments: { text: 'hello', lang: 'es' },
        },
      });
    });
  });

  describe('createPromptRequest', () => {
    it('should create a valid prompt request', () => {
      const request = createPromptRequest('summarize', { topic: 'AI' });

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/get',
        params: {
          name: 'summarize',
          arguments: { topic: 'AI' },
        },
      });
    });

    it('should create a prompt request with custom ID', () => {
      const request = createPromptRequest('analyze', { data: [1, 2, 3] }, 42);

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 42,
        method: 'prompts/get',
        params: {
          name: 'analyze',
          arguments: { data: [1, 2, 3] },
        },
      });
    });
  });

  describe('createResourceRequest', () => {
    it('should create a valid resource request', () => {
      const request = createResourceRequest('file:///path/to/file.txt');

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'file:///path/to/file.txt',
        },
      });
    });
  });

  describe('list requests', () => {
    it('should create tools list request', () => {
      const request = createToolsListRequest();

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });
    });

    it('should create prompts list request', () => {
      const request = createPromptsListRequest(2);

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/list',
      });
    });

    it('should create resources list request', () => {
      const request = createResourcesListRequest('list-id');

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 'list-id',
        method: 'resources/list',
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response without data', () => {
      const response = createErrorResponse(1, -32601, 'Method not found');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      });
    });

    it('should create error response with data', () => {
      const response = createErrorResponse('req-1', -32602, 'Invalid params', { field: 'name', issue: 'required' });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'req-1',
        error: {
          code: -32602,
          message: 'Invalid params',
          data: { field: 'name', issue: 'required' },
        },
      });
    });

    it('should handle null ID', () => {
      const response = createErrorResponse(null, -32700, 'Parse error');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response', () => {
      const response = createSuccessResponse(1, { content: 'Hello, World!' });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { content: 'Hello, World!' },
      });
    });

    it('should handle null result', () => {
      const response = createSuccessResponse(2, null);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 2,
        result: null,
      });
    });
  });

  describe('streaming chunks', () => {
    it('should create text streaming chunks', () => {
      const chunks = createStreamingChunks('Hello', ' ', 'World!');

      expect(chunks).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: ' ' },
        { type: 'text', content: 'World!' },
      ]);
    });

    it('should create event chunk without data', () => {
      const chunk = createEventChunk('completion');

      expect(chunk).toEqual({
        type: 'event',
        name: 'completion',
      });
    });

    it('should create event chunk with data', () => {
      const chunk = createEventChunk('progress', { percent: 50 });

      expect(chunk).toEqual({
        type: 'event',
        name: 'progress',
        data: { percent: 50 },
      });
    });

    it('should create image chunk without alt text', () => {
      const chunk = createImageChunk('https://example.com/image.png');

      expect(chunk).toEqual({
        type: 'image',
        url: 'https://example.com/image.png',
      });
    });

    it('should create image chunk with alt text', () => {
      const chunk = createImageChunk('data:image/png;base64,abc123', 'Test image');

      expect(chunk).toEqual({
        type: 'image',
        url: 'data:image/png;base64,abc123',
        alt: 'Test image',
      });
    });
  });

  describe('createFixture', () => {
    it('should create fixture with response', () => {
      const input = createToolRequest('echo', { message: 'test' });
      const expected = createSuccessResponse(1, { content: 'test' });
      const fixture = createFixture('echo-test', input, expected);

      expect(fixture).toEqual({
        name: 'echo-test',
        input,
        expected,
      });
    });

    it('should create fixture with streaming chunks', () => {
      const input = createPromptRequest('stream', { topic: 'test' });
      const expected = createStreamingChunks('chunk1', 'chunk2');
      const fixture = createFixture('streaming-test', input, expected);

      expect(fixture).toEqual({
        name: 'streaming-test',
        input,
        expected,
      });
    });
  });

  describe('ErrorCodes', () => {
    it('should have standard JSON-RPC error codes', () => {
      expect(ErrorCodes.PARSE_ERROR).toBe(-32700);
      expect(ErrorCodes.INVALID_REQUEST).toBe(-32600);
      expect(ErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
      expect(ErrorCodes.INVALID_PARAMS).toBe(-32602);
      expect(ErrorCodes.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have MCP-specific error codes', () => {
      expect(ErrorCodes.LIFECYCLE_ERROR).toBe(-32000);
      expect(ErrorCodes.CAPABILITY_ERROR).toBe(-32001);
      expect(ErrorCodes.AUTHORIZATION_ERROR).toBe(-32002);
    });
  });

  describe('createLifecycleError', () => {
    it('should create lifecycle error with default state', () => {
      const response = createLifecycleError(1, 'tools/call');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32000,
          message: "Operational request 'tools/call' requires server to be in ready state",
          data: {
            currentState: 'initializing',
            operation: 'tools/call',
          },
        },
      });
    });

    it('should create lifecycle error with custom state', () => {
      const response = createLifecycleError('req-1', 'prompts/get', 'shutting-down');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'req-1',
        error: {
          code: -32000,
          message: "Operational request 'prompts/get' requires server to be in ready state",
          data: {
            currentState: 'shutting-down',
            operation: 'prompts/get',
          },
        },
      });
    });
  });
});
