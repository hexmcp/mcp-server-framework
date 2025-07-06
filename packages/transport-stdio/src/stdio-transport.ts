import * as readline from 'node:readline';
import { decodeJsonRpcMessage, encodeJsonRpcParseError, type JsonRpcMessage } from '@hexmcp/codec-jsonrpc';
import type { ServerTransport, TransportDispatch, TransportMetadata } from '@hexmcp/transport';

export interface StdioTransportOptions {
  silent?: boolean;
}

export class StdioTransport implements ServerTransport {
  readonly name = 'stdio';

  private dispatch?: TransportDispatch | undefined;
  private readlineInterface?: readline.Interface | undefined;
  private isStarted = false;
  private isStopping = false;
  private options: StdioTransportOptions;
  private originalConsole:
    | {
        log: typeof console.log;
        info: typeof console.info;
        warn: typeof console.warn;
        error: typeof console.error;
      }
    | undefined;

  constructor(options: StdioTransportOptions = {}) {
    this.options = { silent: true, ...options };
  }

  async start(dispatch: TransportDispatch): Promise<void> {
    if (this.isStarted) {
      throw new Error('StdioTransport is already started');
    }

    if (this.options.silent) {
      this.configureSilentMode();
    }

    this.dispatch = dispatch;
    this.isStarted = true;
    this.isStopping = false;

    this.readlineInterface = readline.createInterface({
      input: process.stdin,
      output: undefined,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    this.readlineInterface.on('line', (line: string) => {
      if (this.isStopping || !this.dispatch) {
        return;
      }

      this.handleLine(line);
    });

    this.readlineInterface.on('close', () => {
      if (!this.isStopping) {
        this.isStopping = true;
        this.cleanup();
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isStarted || this.isStopping) {
      return;
    }

    this.isStopping = true;
    this.cleanup();
    this.restoreConsole();
  }

  private cleanup(): void {
    if (this.readlineInterface) {
      this.readlineInterface.removeAllListeners();
      this.readlineInterface.close();
      this.readlineInterface = undefined;
    }

    this.dispatch = undefined;
    this.isStarted = false;
    this.isStopping = false;
  }

  private handleLine(line: string): void {
    if (!this.dispatch || this.isStopping) {
      return;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) {
      const errorResponse = encodeJsonRpcParseError(null);
      this.writeResponse(errorResponse);
      return;
    }

    let message: JsonRpcMessage;

    try {
      message = decodeJsonRpcMessage(trimmedLine);
    } catch (_error) {
      const errorResponse = encodeJsonRpcParseError(null);
      this.writeResponse(errorResponse);
      return;
    }

    const metadata: TransportMetadata = {
      transport: {
        name: this.name,
      },
    };

    const respond = async (response: unknown): Promise<void> => {
      if (!this.isStopping) {
        this.writeResponse(response);
      }
    };

    this.dispatch(message, respond, metadata);
  }

  private writeResponse(response: unknown): void {
    if (this.isStopping) {
      return;
    }

    try {
      const jsonString = JSON.stringify(response);
      process.stdout.write(`${jsonString}\n`);
    } catch (_error) {
      // Silently ignore JSON serialization errors
    }
  }

  private configureSilentMode(): void {
    if (this.originalConsole) {
      return;
    }

    this.originalConsole = {
      // biome-ignore lint/suspicious/noConsole: Need to capture original console methods for silent mode
      log: console.log,
      // biome-ignore lint/suspicious/noConsole: Need to capture original console methods for silent mode
      info: console.info,
      // biome-ignore lint/suspicious/noConsole: Need to capture original console methods for silent mode
      warn: console.warn,
      // biome-ignore lint/suspicious/noConsole: Need to capture original console methods for silent mode
      error: console.error,
    };

    console.log = () => {
      // Suppress stdout output to prevent JSON-RPC pollution
    };
    console.info = () => {
      // Suppress stdout output to prevent JSON-RPC pollution
    };
    console.warn = (...args: unknown[]) => this.originalConsole?.error(...args);
    console.error = (...args: unknown[]) => this.originalConsole?.error(...args);
  }

  private restoreConsole(): void {
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.info = this.originalConsole.info;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      this.originalConsole = undefined;
    }
  }
}
