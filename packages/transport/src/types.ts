export interface TransportMetadata {
  peer?: {
    ip?: string;
    userAgent?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type TransportDispatch = (
  message: unknown,
  respond: (response: unknown) => Promise<void>,
  metadata?: TransportMetadata
) => void;

export interface ServerTransport {
  readonly name: string;
  start(dispatch: TransportDispatch): Promise<void>;
  stop(): Promise<void>;
}

export enum TransportState {
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enums
  STOPPED = "stopped",
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enums
  STARTING = "starting",
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enums
  RUNNING = "running",
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enums
  STOPPING = "stopping",
  // biome-ignore lint/style/useNamingConvention: SCREAMING_SNAKE_CASE preferred for enums
  ERROR = "error",
}
