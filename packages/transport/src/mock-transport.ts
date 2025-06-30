import type { ServerTransport, TransportDispatch, TransportMetadata } from "./types";
import { TransportState } from "./types";

export interface MockTransportMessage {
  message: unknown;
  metadata?: TransportMetadata;
}

export interface MockTransportResponse {
  response: unknown;
  messageIndex: number;
  timestamp: number;
}

export interface MockTransportOptions {
  name?: string;
  startDelay?: number;
  stopDelay?: number;
  simulateStartError?: boolean;
  simulateStopError?: boolean;
}

export class MockTransport implements ServerTransport {
  public readonly name: string;
  private _state: TransportState = TransportState.STOPPED;
  private _dispatch: TransportDispatch | null = null;
  private _responses: MockTransportResponse[] = [];
  private _messageQueue: MockTransportMessage[] = [];
  private _messageIndex = 0;
  private _options: Required<MockTransportOptions>;

  constructor(options: MockTransportOptions = {}) {
    this._options = {
      name: "mock",
      startDelay: 0,
      stopDelay: 0,
      simulateStartError: false,
      simulateStopError: false,
      ...options,
    };
    this.name = this._options.name;
  }

  get state(): TransportState {
    return this._state;
  }

  get responses(): readonly MockTransportResponse[] {
    return [...this._responses];
  }

  get messageCount(): number {
    return this._messageIndex;
  }

  async start(dispatch: TransportDispatch): Promise<void> {
    if (this._state !== TransportState.STOPPED) {
      throw new Error(`Cannot start transport in state: ${this._state}`);
    }

    this._state = TransportState.STARTING;

    if (this._options.simulateStartError) {
      this._state = TransportState.ERROR;
      throw new Error("Simulated start error");
    }

    if (this._options.startDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._options.startDelay));
    }

    this._dispatch = dispatch;
    this._state = TransportState.RUNNING;

    this._processQueuedMessages();
  }

  async stop(): Promise<void> {
    if (this._state === TransportState.STOPPED) {
      return;
    }

    if (this._state === TransportState.STOPPING) {
      return;
    }

    this._state = TransportState.STOPPING;

    if (this._options.simulateStopError) {
      this._state = TransportState.ERROR;
      throw new Error("Simulated stop error");
    }

    if (this._options.stopDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._options.stopDelay));
    }

    this._dispatch = null;
    this._state = TransportState.STOPPED;
  }

  sendMessage(message: unknown, metadata?: TransportMetadata): void {
    const transportMessage: MockTransportMessage = { message, ...(metadata && { metadata }) };

    if (this._state === TransportState.RUNNING && this._dispatch) {
      this._processMessage(transportMessage);
    } else {
      this._messageQueue.push(transportMessage);
    }
  }

  clearResponses(): void {
    this._responses = [];
  }

  clearMessageQueue(): void {
    this._messageQueue = [];
  }

  reset(): void {
    this._responses = [];
    this._messageQueue = [];
    this._messageIndex = 0;
    this._dispatch = null;
    this._state = TransportState.STOPPED;
  }

  private _processQueuedMessages(): void {
    if (!this._dispatch) {
      return;
    }

    const messages = [...this._messageQueue];
    this._messageQueue = [];

    for (const message of messages) {
      this._processMessage(message);
    }
  }

  private _processMessage(transportMessage: MockTransportMessage): void {
    if (!this._dispatch) {
      return;
    }

    const messageIndex = this._messageIndex++;
    const respondCallback = async (response: unknown): Promise<void> => {
      this._responses.push({
        response,
        messageIndex,
        timestamp: Date.now(),
      });
    };

    try {
      this._dispatch(transportMessage.message, respondCallback, transportMessage.metadata);
    } catch (_error) {
      // Silently catch dispatch errors to prevent transport crashes
    }
  }
}
