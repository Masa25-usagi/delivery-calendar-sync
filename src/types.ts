export type Carrier = "yamato" | "sagawa" | "japanpost" | "apple" | "amazon" | "unknown";

export type DeliveryStatus = "scheduled" | "shipped" | "out_for_delivery" | "delivered" | "delayed";

export interface TimeSlot {
  raw: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface DeliveryNotice {
  carrier: Carrier;
  carrierName: string;
  trackingNumber?: string;
  sender?: string;
  itemDescription?: string;
  estimatedDate: string; // YYYY-MM-DD (JST)
  estimatedEndDate?: string; // YYYY-MM-DD (JST) for multi-day delivery windows
  timeSlot?: TimeSlot;
  status: DeliveryStatus;
  trackingUrl?: string;
  rawSubject?: string;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime?: string; // ISO 8601 string
    date?: string;     // YYYY-MM-DD for all day
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
}

export interface MorningBriefing {
  date: string;
  deliveries: DeliveryNotice[];
  summaryText: string;
  markdown: string;
  discordEmbed: {
    title: string;
    description: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    footer: { text: string };
  };
}
