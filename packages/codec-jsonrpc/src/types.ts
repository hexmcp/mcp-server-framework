export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: T;
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;

export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

export type JsonRpcMessage<T = unknown> = JsonRpcRequest<T> | JsonRpcNotification<T>;

export function isJsonRpcRequest<T = unknown>(message: JsonRpcMessage<T>): message is JsonRpcRequest<T> {
  return 'id' in message;
}

export function isJsonRpcNotification<T = unknown>(message: JsonRpcMessage<T>): message is JsonRpcNotification<T> {
  return !('id' in message);
}

export function isJsonRpcSuccess<T = unknown>(response: JsonRpcResponse<T>): response is JsonRpcSuccess<T> {
  return 'result' in response;
}

export function isJsonRpcError(response: JsonRpcResponse): response is JsonRpcError {
  return 'error' in response;
}
