import test from "node:test";
import assert from "node:assert/strict";
import { noticeToCalendarEvent, generateIcs } from "../src/calendar.ts";
import type { DeliveryNotice } from "../src/types.ts";

const sampleNotice: DeliveryNotice = {
  carrier: "yamato",
  carrierName: "ヤマト運輸",
  trackingNumber: "123456789012",
  sender: "ヨドバシカメラ",
  itemDescription: "USB-Cケーブル",
  estimatedDate: "2026-10-04",
  timeSlot: {
    raw: "午前中",
    startHour: 9,
    startMinute: 0,
    endHour: 12,
    endMinute: 0
  },
  status: "scheduled",
  trackingUrl: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?tracking_number=123456789012"
};

test("noticeToCalendarEvent creates Google Calendar API v3 payload with timezone", () => {
  const event = noticeToCalendarEvent(sampleNotice);
  assert.equal(event.summary.includes("ヤマト運輸"), true);
  assert.equal(event.summary.includes("午前中"), true);
  assert.equal(event.start.dateTime, "2026-10-04T09:00:00+09:00");
  assert.equal(event.end.dateTime, "2026-10-04T12:00:00+09:00");
  assert.equal(event.start.timeZone, "Asia/Tokyo");
  assert.equal(event.description.includes("123456789012"), true);
});

test("generateIcs produces valid RFC 5545 iCalendar format", () => {
  const ics = generateIcs([sampleNotice]);
  assert.equal(ics.includes("BEGIN:VCALENDAR"), true);
  assert.equal(ics.includes("VERSION:2.0"), true);
  assert.equal(ics.includes("BEGIN:VEVENT"), true);
  assert.equal(ics.includes("SUMMARY:📦 【ヤマト運輸】お届け予定 (午前中): USB-Cケーブル"), true);
  assert.equal(ics.includes("DTSTART;TZID=Asia/Tokyo:20261004T090000"), true);
  assert.equal(ics.includes("DTEND;TZID=Asia/Tokyo:20261004T120000"), true);
  assert.equal(ics.includes("BEGIN:VALARM"), true);
  assert.equal(ics.includes("END:VCALENDAR"), true);
});

test("noticeToCalendarEvent creates compliant exclusive end date for all-day events (single & multi-day)", () => {
  // Single-day notice without timeSlot
  const allDayNotice: DeliveryNotice = {
    carrier: "apple",
    carrierName: "Apple Store",
    itemDescription: "EarPods",
    estimatedDate: "2026-10-04",
    status: "shipped"
  };
  const event = noticeToCalendarEvent(allDayNotice);
  assert.equal(event.start.date, "2026-10-04");
  // In Google Calendar API v3, single-day all-day event end.date must be exclusive (day + 1)
  assert.equal(event.end.date, "2026-10-05");

  const ics = generateIcs([allDayNotice]);
  assert.equal(ics.includes("DTSTART;VALUE=DATE:20261004"), true);
  assert.equal(ics.includes("DTEND;VALUE=DATE:20261005"), true);

  // Multi-day window notice (e.g. Amazon 10/05 - 10/08)
  const multiDayNotice: DeliveryNotice = {
    carrier: "amazon",
    carrierName: "Amazon.co.jp配送",
    itemDescription: "技術書",
    estimatedDate: "2026-10-05",
    estimatedEndDate: "2026-10-08",
    status: "shipped"
  };
  const multiEvent = noticeToCalendarEvent(multiDayNotice);
  assert.equal(multiEvent.start.date, "2026-10-05");
  // End date exclusive: Oct 8 + 1 = Oct 9
  assert.equal(multiEvent.end.date, "2026-10-09");
  const multiIcs = generateIcs([multiDayNotice]);
  assert.equal(multiIcs.includes("DTSTART;VALUE=DATE:20261005"), true);
  assert.equal(multiIcs.includes("DTEND;VALUE=DATE:20261009"), true);
});

test("strict validation rejects invalid dates, inverted dates, and invalid time slots", () => {
  // Invalid date format or non-existent date
  assert.throws(() => {
    noticeToCalendarEvent({ ...sampleNotice, estimatedDate: "2026-02-30" });
  }, /存在しない日付です/);

  // Inverted multi-day window
  assert.throws(() => {
    noticeToCalendarEvent({
      ...sampleNotice,
      estimatedDate: "2026-10-10",
      estimatedEndDate: "2026-10-05"
    });
  }, /配送終了日.*より前です/);

  // Inverted time slot
  assert.throws(() => {
    noticeToCalendarEvent({
      ...sampleNotice,
      timeSlot: { raw: "逆転", startHour: 15, startMinute: 0, endHour: 14, endMinute: 0 }
    });
  }, /時間帯の終了時刻は開始時刻より後である必要があります/);
});

test("generateIcs produces deterministic UIDs and folds long lines safely", () => {
  const ics1 = generateIcs([sampleNotice]);
  const ics2 = generateIcs([sampleNotice]);
  assert.equal(ics1, ics2, "Same notice must produce deterministic identical ICS");

  const longNotice: DeliveryNotice = {
    carrier: "yamato",
    carrierName: "ヤマト運輸",
    estimatedDate: "2026-10-04",
    status: "scheduled",
    itemDescription: "非常に長い商品名のテストであります。日本語のマルチバイト文字がRFC5545の75オクテット制限を超過した際に安全に折り返されるかを検証するためのテキストデータです。"
  };
  const icsLong = generateIcs([longNotice]);
  const lines = icsLong.split("\r\n");
  for (const line of lines) {
    assert.equal(Buffer.byteLength(line, "utf8") <= 80, true, `Line exceeded 80 bytes: ${line}`);
  }
});

test("noticeToCalendarEvent safely handles 24:00 midnight endHour and rejects 24:xx", () => {
  // 24:00 is valid midnight representation and rolls over to next day 00:00:00
  const midnightNotice: DeliveryNotice = {
    ...sampleNotice,
    estimatedDate: "2026-10-04",
    timeSlot: { raw: "夜間便", startHour: 20, startMinute: 0, endHour: 24, endMinute: 0 }
  };
  const ev = noticeToCalendarEvent(midnightNotice);
  assert.equal(ev.start.dateTime, "2026-10-04T20:00:00+09:00");
  assert.equal(ev.end.dateTime, "2026-10-05T00:00:00+09:00");

  const ics = generateIcs([midnightNotice]);
  assert.equal(ics.includes("DTEND;TZID=Asia/Tokyo:20261005T000000"), true);

  // 24:30 is invalid time
  assert.throws(() => {
    noticeToCalendarEvent({
      ...sampleNotice,
      timeSlot: { raw: "不正時間", startHour: 20, startMinute: 0, endHour: 24, endMinute: 30 }
    });
  }, /時間帯の時分が不正です/);
});

