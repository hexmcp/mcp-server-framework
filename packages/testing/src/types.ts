/**
 * JSON-RPC 2.0 Request structure as defined by the specification.
 * Represents the exact format of requests received by the MCP server.
 *
 * @see https://www.jsonrpc.org/specification
 */
export interface JsonRpcRequest {
  /** JSON-RPC version identifier, must be exactly "2.0" */
  jsonrpc: '2.0';
  /** Request identifier, can be string, number, or null for notifications */
  id: string | number | null;
  /** Method name to invoke on the server */
  method: string;
  /** Optional parameters for the method call */
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Error object structure.
 * Contains standardized error information for failed requests.
 */
export interface JsonRpcError {
  /** Numeric error code indicating the error type */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Optional additional error data */
  data?: unknown;
}

/**
 * JSON-RPC 2.0 Response structure as defined by the specification.
 * Represents the exact format of responses sent by the MCP server.
 * Must contain either 'result' OR 'error', never both.
 */
export interface JsonRpcResponse {
  /** JSON-RPC version identifier, must be exactly "2.0" */
  jsonrpc: '2.0';
  /** Request identifier matching the original request */
  id: string | number | null;
  /** Successful response data (mutually exclusive with error) */
  result?: unknown;
  /** Error information (mutually exclusive with result) */
  error?: JsonRpcError;
}

/**
 * Streaming chunk for protocols that support chunked responses.
 * Used for testing streaming prompts, large tool outputs, or progressive responses.
 */
export interface JsonRpcChunk {
  /** Type of chunk content */
  type: 'text' | 'image' | 'event' | 'error';
  /** Extensible properties for different chunk types */
  [key: string]: unknown;
}

/**
 * Error chunk for streaming responses that fail mid-stream.
 * Allows structured error reporting without aborting the entire stream.
 */
export interface JsonRpcErrorChunk extends JsonRpcChunk {
  /** Always 'error' for error chunks */
  type: 'error';
  /** JSON-RPC or application-defined error code */
  code: number;
  /** Short error description */
  message: string;
  /** Optional error details, stack trace, or context */
  data?: unknown;
}

/**
 * Complete test fixture definition for MCP protocol testing.
 *
 * Fixtures simulate complete request/response pairs to verify:
 * - Protocol compliance with JSON-RPC 2.0 specification
 * - Correct error handling and status codes
 * - Handler implementation correctness
 * - Streaming response behavior
 *
 * Example fixture structure:
 * ```json
 * {
 *   "name": "valid-tool-call",
 *   "input": {
 *     "jsonrpc": "2.0",
 *     "id": 1,
 *     "method": "tools/call",
 *     "params": { "name": "echo", "arguments": { "message": "test" } }
 *   },
 *   "expected": {
 *     "jsonrpc": "2.0",
 *     "id": 1,
 *     "result": { "content": [{ "type": "text", "text": "test" }] }
 *   }
 * }
 * ```
 *
 * For streaming responses, use an array of chunks:
 * ```json
 * {
 *   "name": "streaming-prompt",
 *   "input": { ... },
 *   "expected": [
 *     { "type": "text", "content": "First chunk" },
 *     { "type": "text", "content": "Second chunk" }
 *   ]
 * }
 * ```
 */
export interface Fixture {
  /** Human-readable test name used for Jest test case identification */
  name: string;
  /** Raw JSON-RPC 2.0 request as received by codec/dispatcher */
  input: JsonRpcRequest;
  /** Expected response - either single response or array of streaming chunks */
  expected: JsonRpcResponse | JsonRpcChunk[];
}
