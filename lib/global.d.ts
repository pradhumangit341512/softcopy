export {};

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      action: string,
      params?: Record<string, any>
    ) => void;
  }
}