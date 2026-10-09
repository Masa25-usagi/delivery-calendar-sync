import type { DeliveryNotice, CalendarEvent } from "./types.ts";
import { createHash } from "node:crypto";

/**
 * Validates and parses YYYY-MM-DD date strictly, preventing overflow (e.g. 2026-02-30)
 */
export function parseDateOnly(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`日付はYYYY-MM-DD形式の文字列が必要です: ${value}`);
  }

  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error(`存在しない日付です: ${value}`);
  }
  return dt;
}

/**
 * Returns the next day in YYYY-MM-DD format (exclusive end date for all-day events)
 */
export function getNextDayDateStr(dateStr: string): string {
  const dt = parseDateOnly(dateStr);
  const next = new Date(dt.getTime() + 86400000);
  const ny = next.getUTCFullYear();
  const nm = (next.getUTCMonth() + 1).toString().padStart(2, "0");
  const nd = next.getUTCDate().toString().padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Creates Google Calendar API v3 Event object from DeliveryNotice with strict validation
 */
export function noticeToCalendarEvent(notice: DeliveryNotice): CalendarEvent {
  parseDateOnly(notice.estimatedDate);

  if (notice.estimatedEndDate !== undefined) {
    parseDateOnly(notice.estimatedEndDate);
    if (notice.estimatedEndDate < notice.estimatedDate) {
      throw new Error(`配送終了日(${notice.estimatedEndDate})が開始日(${notice.estimatedDate})より前です`);
    }
  }

  const summaryPrefix = "📦 ";
  const timeDesc = notice.timeSlot ? ` (${notice.timeSlot.raw})` : "";
  const itemDesc = notice.itemDescription ? `: ${notice.itemDescription}` : "";
  const summary = `${summaryPrefix}【${notice.carrierName}】お届け予定${timeDesc}${itemDesc}`;

  const descLines: string[] = [
    `配送業者: ${notice.carrierName}`,
    notice.trackingNumber ? `追跡番号: ${notice.trackingNumber}` : "",
    notice.sender ? `発送元: ${notice.sender}` : "",
    notice.itemDescription ? `品名: ${notice.itemDescription}` : "",
    notice.timeSlot ? `指定時間帯: ${notice.timeSlot.raw}` : "時間指定: なし",
    notice.trackingUrl ? `追跡URL: ${notice.trackingUrl}` : "",
    "",
    "自動登録: delivery-calendar-sync (Codex/Hermes Personal Assistant)"
  ].filter(line => line !== "");

  const description = descLines.join("\n");

  if (notice.timeSlot) {
    const { startHour, startMinute, endHour, endMinute } = notice.timeSlot;
    if (
      !Number.isInteger(startHour) || startHour < 0 || startHour > 23 ||
      !Number.isInteger(endHour) || endHour < 0 || endHour > 24 ||
      !Number.isInteger(startMinute) || startMinute < 0 || startMinute > 59 ||
      !Number.isInteger(endMinute) || endMinute < 0 || endMinute > 59 ||
      (endHour === 24 && endMinute !== 0)
    ) {
      throw new Error(`時間帯の時分が不正です: ${startHour}:${startMinute}〜${endHour}:${endMinute}`);
    }

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (endTotal <= startTotal) {
      throw new Error(`時間帯の終了時刻は開始時刻より後である必要があります: ${startHour}:${startMinute}〜${endHour}:${endMinute}`);
    }

    const sH = startHour.toString().padStart(2, "0");
    const sM = startMinute.toString().padStart(2, "0");
    const endDateTime = endHour === 24
      ? `${getNextDayDateStr(notice.estimatedDate)}T00:00:00+09:00`
      : `${notice.estimatedDate}T${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}:00+09:00`;

    return {
      summary,
      description,
      start: {
        dateTime: `${notice.estimatedDate}T${sH}:${sM}:00+09:00`,
        timeZone: "Asia/Tokyo"
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Asia/Tokyo"
      },
      location: "自宅"
    };
  }

  // All day event if no specific time slot
  // Note: Per Google Calendar API v3 and RFC 5545 specs, end.date for DATE values is non-inclusive (exclusive)
  const endDateExclusive = notice.estimatedEndDate
    ? getNextDayDateStr(notice.estimatedEndDate)
    : getNextDayDateStr(notice.estimatedDate);

  return {
    summary,
    description,
    start: {
      date: notice.estimatedDate
    },
    end: {
      date: endDateExclusive
    },
    location: "自宅"
  };
}

/**
 * Escapes characters for RFC 5545 iCalendar text values
 */
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Folds RFC 5545 line at 75 octets without breaking UTF-8 multibyte characters
 */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 80) return line;

  const chunks: string[] = [];
  let offset = 0;
  let maxBytes = 75;

  while (offset < bytes.length) {
    let end = Math.min(offset + maxBytes, bytes.length);
    // Do not cut in the middle of UTF-8 continuation bytes (0x80..0xBF)
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    const piece = bytes.subarray(offset, end).toString("utf8");
    chunks.push(offset === 0 ? piece : ` ${piece}`);
    offset = end;
    maxBytes = 74; // Subsequent lines start with a single space (1 byte)
  }

  return chunks.join("\r\n");
}

/**
 * Deterministic stable UID generator from notice properties
 */
export function getStableNoticeUid(notice: DeliveryNotice, index: number): string {
  const rawKey = notice.trackingNumber
    ? `${notice.carrier}:${notice.trackingNumber}`
    : `${notice.carrier}:${notice.estimatedDate}:${notice.itemDescription || ""}:${index}`;
  const hash = createHash("sha256").update(rawKey).digest("hex").slice(0, 24);
  return `delivery-${notice.carrier}-${hash}@codex.local`;
}

/**
 * Generates an RFC 5545 standard iCalendar (.ics) string from notices
 */
export function generateIcs(notices: DeliveryNotice[], calendarName = "荷物お届け予定"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codex Personal Assistant//Delivery Calendar Sync//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:Asia/Tokyo"
  ];

  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i];
    const event = noticeToCalendarEvent(notice);
    const uid = getStableNoticeUid(notice, i);
    const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);

    if (event.start.dateTime && event.end.dateTime) {
      // Local time with explicit TZID
      const dtStart = event.start.dateTime.slice(0, 19).replace(/[-:]/g, "");
      const dtEnd = event.end.dateTime.slice(0, 19).replace(/[-:]/g, "");
      lines.push(`DTSTART;TZID=Asia/Tokyo:${dtStart}`);
      lines.push(`DTEND;TZID=Asia/Tokyo:${dtEnd}`);

      // 15-minute advance reminder for timed deliveries
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeIcsText(event.summary)}`);
      lines.push("TRIGGER:-PT15M");
      lines.push("END:VALARM");
    } else if (event.start.date) {
      const dStart = event.start.date.replace(/[-]/g, "");
      const dEnd = (event.end.date || event.start.date).replace(/[-]/g, "");
      lines.push(`DTSTART;VALUE=DATE:${dStart}`);
      lines.push(`DTEND;VALUE=DATE:${dEnd}`);
      // All-day deliveries intentionally do not have a -PT15M alarm to avoid midnight alerts
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n");
}
