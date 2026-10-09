import type { DeliveryNotice, TimeSlot } from "../types.ts";

export function parseSagawaNotice(text: string, subject = ""): DeliveryNotice | null {
  if (!text.includes("佐川急便") && !subject.includes("佐川急便")) {
    return null;
  }

  // Tracking number: 12 digits
  const trackingMatch = text.match(/(?:お問い?合(?:せ|わせ)送り状(?:No\.?|番号))[\s:：]*([0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4})/);
  const trackingNumber = trackingMatch ? trackingMatch[1].replace(/[-\s]/g, "") : undefined;

  // Estimated Date
  let estimatedDate = "";
  const dateMatch = text.match(/(?:お届け予定日時?|配達予定日)[\s:：]*([0-9]{4}年)?[0-9]{1,2}月[0-9]{1,2}日/);
  if (dateMatch) {
    const rawDate = dateMatch[0];
    const yearMatch = rawDate.match(/([0-9]{4})年/);
    const currentYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    const mdMatch = rawDate.match(/([0-9]{1,2})月([0-9]{1,2})日/);
    if (mdMatch) {
      const month = mdMatch[1].padStart(2, "0");
      const day = mdMatch[2].padStart(2, "0");
      estimatedDate = `${currentYear}-${month}-${day}`;
    }
  }

  // Time slot
  let timeSlot: TimeSlot | undefined;
  if (/午前中/i.test(text)) {
    timeSlot = { raw: "午前中", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 };
  } else {
    const timeMatch = text.match(/([0-9]{1,2})時(?:[〜~\-]([0-9]{1,2})時)?/);
    if (timeMatch) {
      const start = parseInt(timeMatch[1], 10);
      const end = timeMatch[2] ? parseInt(timeMatch[2], 10) : start + 2;
      timeSlot = { raw: timeMatch[0], startHour: start, startMinute: 0, endHour: end, endMinute: 0 };
    }
  }

  // Sender
  const senderMatch = text.match(/(?:ご依頼主|出荷元|発送元)[\s:：]*([^\n\r]+)/);
  const sender = senderMatch ? senderMatch[1].trim() : undefined;

  // Item description
  const itemMatch = text.match(/(?:品名|商品名)[\s:：]*([^\n\r]+)/);
  const itemDescription = itemMatch ? itemMatch[1].trim() : undefined;

  return {
    carrier: "sagawa",
    carrierName: "佐川急便",
    trackingNumber,
    sender,
    itemDescription,
    estimatedDate: estimatedDate || new Date().toISOString().split("T")[0],
    timeSlot,
    status: "scheduled",
    trackingUrl: trackingNumber ? `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}` : undefined,
    rawSubject: subject
  };
}
