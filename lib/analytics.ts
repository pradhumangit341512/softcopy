export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
    });
  }
}

export const ANALYTICS_EVENTS = {
  USER_SIGNUP: { action: 'signup', category: 'auth' },
  USER_LOGIN: { action: 'login', category: 'auth' },
  CLIENT_ADDED: { action: 'add_client', category: 'clients' },
  CLIENT_UPDATED: { action: 'update_client', category: 'clients' },
  COMMISSION_CREATED: { action: 'create_commission', category: 'commissions' },
  EXPORT_CLIENT: { action: 'export_clients', category: 'export' },
};