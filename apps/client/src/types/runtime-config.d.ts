export interface RuntimeConfig {
  apiGatewayUrl?: string;
  wsUrl?: string;
  environment?: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export {};

