import { encodeJsonRpcError, type JsonRpcRequest, type JsonRpcResponse, RpcError } from '@hexmcp/codec-jsonrpc';
import type { TransportDispatch, TransportMetadata } from '@hexmcp/transport';

import type { RequestGate } from '../lifecycle/types.js';
import type { MiddlewareEngine, MiddlewareRegistry, RequestContext } from './types.js';

export interface MiddlewareDispatcherOptions {
  requestGate: RequestGate;
  middlewareRegistry: MiddlewareRegistry;
  middlewareEngine: MiddlewareEngine;
  coreDispatcher: (ctx: RequestContext) => Promise<void>;
}

export class MiddlewareDispatcher {
  private readonly _requestGate: RequestGate;
  private readonly _middlewareRegistry: MiddlewareRegistry;
  private readonly _middlewareEngine: MiddlewareEngine;
  private readonly _coreDispatcher: (ctx: RequestContext) => Promise<void>;

  constructor(options: MiddlewareDispatcherOptions) {
    this._requestGate = options.requestGate;
    this._middlewareRegistry = options.middlewareRegistry;
    this._middlewareEngine = options.middlewareEngine;
    this._coreDispatcher = options.coreDispatcher;
  }

  createTransportDispatch(transportName: string): TransportDispatch {
    return async (message: unknown, respond: (response: unknown) => Promise<void>, metadata?: TransportMetadata) => {
      let request: JsonRpcRequest;

      try {
        request = this._validateJsonRpcRequest(message);
      } catch (error) {
        const errorResponse = this._createErrorResponse(message, error);
        await respond(errorResponse);
        return;
      }

      const ctx: RequestContext = {
        request,
        send: respond,
        transport: {
          name: transportName,
          peer: metadata?.peer,
        },
        state: {},
      };

      try {
        const middlewareStack = this._middlewareRegistry.getMiddlewareStack();
        const composedMiddleware = this._middlewareEngine.applyMiddleware(middlewareStack);

        const coreHandler = async () => {
          try {
            this._requestGate.validateRequest(ctx.request.method);
            await this._coreDispatcher(ctx);
          } catch (error) {
            const validationError = this._requestGate.getValidationError(ctx.request.method);
            if (validationError) {
              ctx.response = encodeJsonRpcError(
                ctx.request.id,
                new RpcError(validationError.code, validationError.message, validationError.data)
              );
            } else {
              ctx.response = encodeJsonRpcError(
                ctx.request.id,
                new RpcError(-32603, error instanceof Error ? error.message : 'Internal error')
              );
            }
          }
        };

        await composedMiddleware(ctx, coreHandler);

        if (ctx.response) {
          await respond(ctx.response);
        }
      } catch (error) {
        const errorResponse = this._createErrorResponse(message, error);
        await respond(errorResponse);
      }
    };
  }

  private _validateJsonRpcRequest(message: unknown): JsonRpcRequest {
    if (!message || typeof message !== 'object') {
      throw new RpcError(-32700, 'Parse error: Invalid JSON-RPC message');
    }

    const obj = message as Record<string, unknown>;

    if (obj.jsonrpc !== '2.0') {
      throw new RpcError(-32600, 'Invalid Request: Missing or invalid jsonrpc version');
    }

    if (typeof obj.method !== 'string') {
      throw new RpcError(-32600, 'Invalid Request: Missing or invalid method');
    }

    if ('id' in obj && obj.id !== null && typeof obj.id !== 'string' && typeof obj.id !== 'number') {
      throw new RpcError(-32600, 'Invalid Request: ID must be a string, number, or null');
    }

    return obj as unknown as JsonRpcRequest;
  }

  private _createErrorResponse(message: unknown, error: unknown): JsonRpcResponse {
    let id: string | number | null = null;

    if (message && typeof message === 'object' && 'id' in message) {
      const messageWithId = message as { id: string | number | null };
      id = messageWithId.id;
    }

    if (error instanceof RpcError) {
      return encodeJsonRpcError(id, error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return encodeJsonRpcError(id, new RpcError(-32603, errorMessage));
  }

  getRequestGate(): RequestGate {
    return this._requestGate;
  }

  getMiddlewareRegistry(): MiddlewareRegistry {
    return this._middlewareRegistry;
  }

  getMiddlewareEngine(): MiddlewareEngine {
    return this._middlewareEngine;
  }
}
