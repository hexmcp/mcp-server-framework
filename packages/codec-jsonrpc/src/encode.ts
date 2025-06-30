import { RpcError } from './errors';
import type { JsonRpcError, JsonRpcSuccess } from './types';

export function encodeJsonRpcSuccess<T>(id: string | number | null, result: T): JsonRpcSuccess<T> {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

export function encodeJsonRpcError(id: string | number | null, error: RpcError): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: error.code,
      message: error.message,
      ...(error.data !== undefined && { data: error.data }),
    },
  };
}

export function encodeJsonRpcErrorFromPlain(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

export function encodeJsonRpcParseError(id: string | number | null = null): JsonRpcError {
  return encodeJsonRpcError(id, RpcError.parseError());
}

export function encodeJsonRpcInvalidRequest(id: string | number | null = null): JsonRpcError {
  return encodeJsonRpcError(id, RpcError.invalidRequest());
}

export function encodeJsonRpcMethodNotFound(id: string | number | null, method: string): JsonRpcError {
  return encodeJsonRpcError(id, RpcError.methodNotFound(method));
}

export function encodeJsonRpcInvalidParams(id: string | number | null): JsonRpcError {
  return encodeJsonRpcError(id, RpcError.invalidParams());
}

export function encodeJsonRpcInternalError(id: string | number | null): JsonRpcError {
  return encodeJsonRpcError(id, RpcError.internalError());
}
