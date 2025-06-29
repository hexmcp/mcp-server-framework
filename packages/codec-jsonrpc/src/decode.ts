import { RpcError } from "./errors";
import type { JsonRpcMessage, JsonRpcNotification, JsonRpcRequest } from "./types";

function parseInput(input: unknown): unknown {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch (error) {
      throw RpcError.parseError({
        originalError: error instanceof Error ? error.message : "Unknown parse error",
        input: input.slice(0, 100),
      });
    }
  }

  if (typeof input === "object" && input !== null) {
    return input;
  }

  throw RpcError.invalidRequest({
    reason: "Input must be a string or object",
    receivedType: typeof input,
  });
}

function validateJsonRpcVersion(obj: Record<string, unknown>): void {
  if (obj.jsonrpc !== "2.0") {
    throw RpcError.invalidRequest({
      reason: "Missing or invalid jsonrpc version",
      expected: "2.0",
      received: obj.jsonrpc,
    });
  }
}

function validateMethod(obj: Record<string, unknown>): string {
  if (typeof obj.method !== "string") {
    throw RpcError.invalidRequest({
      reason: "Method must be a string",
      receivedType: typeof obj.method,
    });
  }

  if (obj.method.length === 0) {
    throw RpcError.invalidRequest({
      reason: "Method cannot be empty",
    });
  }

  return obj.method;
}

function validateId(obj: Record<string, unknown>): string | number | null {
  const { id } = obj;

  if (id === null || typeof id === "string" || typeof id === "number") {
    return id;
  }

  throw RpcError.invalidRequest({
    reason: "ID must be a string, number, or null",
    receivedType: typeof id,
  });
}

function validateParams<T = unknown>(obj: Record<string, unknown>): T | undefined {
  if (!("params" in obj)) {
    return undefined;
  }

  return obj.params as T;
}

export function decodeJsonRpcRequest<T = unknown>(input: unknown): JsonRpcRequest<T> {
  const parsed = parseInput(input);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw RpcError.invalidRequest({
      reason: "Request must be an object",
      receivedType: Array.isArray(parsed) ? "array" : typeof parsed,
    });
  }

  const obj = parsed as Record<string, unknown>;

  validateJsonRpcVersion(obj);
  const method = validateMethod(obj);
  const id = validateId(obj);
  const params = validateParams<T>(obj);

  return {
    jsonrpc: "2.0",
    id,
    method,
    ...(params !== undefined && { params }),
  };
}

export function decodeJsonRpcNotification<T = unknown>(input: unknown): JsonRpcNotification<T> {
  const parsed = parseInput(input);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw RpcError.invalidRequest({
      reason: "Notification must be an object",
      receivedType: Array.isArray(parsed) ? "array" : typeof parsed,
    });
  }

  const obj = parsed as Record<string, unknown>;

  validateJsonRpcVersion(obj);
  const method = validateMethod(obj);
  const params = validateParams<T>(obj);

  if ("id" in obj) {
    throw RpcError.invalidRequest({
      reason: "Notifications must not have an id field",
    });
  }

  return {
    jsonrpc: "2.0",
    method,
    ...(params !== undefined && { params }),
  };
}

export function decodeJsonRpcMessage<T = unknown>(input: unknown): JsonRpcMessage<T> {
  const parsed = parseInput(input);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw RpcError.invalidRequest({
      reason: "Message must be an object",
      receivedType: Array.isArray(parsed) ? "array" : typeof parsed,
    });
  }

  const obj = parsed as Record<string, unknown>;

  validateJsonRpcVersion(obj);
  const method = validateMethod(obj);
  const params = validateParams<T>(obj);

  if ("id" in obj) {
    const id = validateId(obj);
    return {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined && { params }),
    };
  }
  return {
    jsonrpc: "2.0",
    method,
    ...(params !== undefined && { params }),
  };
}
