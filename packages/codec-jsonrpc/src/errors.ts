// biome-ignore lint/style/useNamingConvention: JSON-RPC standard uses SCREAMING_SNAKE_CASE
export enum JSON_RPC_ERROR_CODES {
  // biome-ignore lint/style/useNamingConvention: JSON-RPC standard error code
  PARSE_ERROR = -32700,
  // biome-ignore lint/style/useNamingConvention: JSON-RPC standard error code
  INVALID_REQUEST = -32600,
  // biome-ignore lint/style/useNamingConvention: JSON-RPC standard error code
  METHOD_NOT_FOUND = -32601,
  // biome-ignore lint/style/useNamingConvention: JSON-RPC standard error code
  INVALID_PARAMS = -32602,
  // biome-ignore lint/style/useNamingConvention: JSON-RPC standard error code
  INTERNAL_ERROR = -32603,
}

export class RpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "RpcError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RpcError);
    }
  }

  static parseError(data?: unknown): RpcError {
    return new RpcError(JSON_RPC_ERROR_CODES.PARSE_ERROR, "Parse error", data);
  }

  static invalidRequest(data?: unknown): RpcError {
    return new RpcError(JSON_RPC_ERROR_CODES.INVALID_REQUEST, "Invalid Request", data);
  }

  static methodNotFound(method: string, data?: unknown): RpcError {
    return new RpcError(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, data);
  }

  static invalidParams(data?: unknown): RpcError {
    return new RpcError(JSON_RPC_ERROR_CODES.INVALID_PARAMS, "Invalid params", data);
  }

  static internalError(data?: unknown): RpcError {
    return new RpcError(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, "Internal error", data);
  }

  static custom(code: number, message: string, data?: unknown): RpcError {
    return new RpcError(code, message, data);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }
}
