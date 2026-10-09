import test from "node:test";
import assert from "node:assert/strict";
import { buildMorningBriefing, generateMacNotificationScript } from "../src/notifier.ts";
import type { DeliveryNotice } from "../src/types.ts";

const sampleNotices: DeliveryNotice[] = [
  {
    carrier: "apple",
    carrierName: "Apple Store",
    itemDescription: "EarPods with USB-C",
    estimatedDate: "2026-10-04",
    timeSlot: { raw: "午前中", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
    status: "shipped"
  },
  {
    carrier: "amazon",
    carrierName: "Amazon.co.jp",
    itemDescription: "USBハブ",
    estimatedDate: "2026-10-04",
    timeSlot: { raw: "18:00 - 20:00", startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 },
    status: "shipped"
  }
];

test("buildMorningBriefing correctly groups today's deliveries", () => {
  const briefing = buildMorningBriefing(sampleNotices, "2026-10-04");
  assert.equal(briefing.deliveries.length, 2);
  assert.equal(briefing.summaryText.includes("2 件"), true);
  assert.equal(briefing.discordEmbed.fields.length, 2);
  assert.equal(briefing.discordEmbed.fields[0].name.includes("午前中"), true);
});

test("buildMorningBriefing handles days with no deliveries", () => {
  const briefing = buildMorningBriefing(sampleNotices, "2026-10-10");
  assert.equal(briefing.deliveries.length, 0);
  assert.equal(briefing.summaryText.includes("ありません"), true);
});

test("generateMacNotificationScript generates osascript command", () => {
  const briefing = buildMorningBriefing(sampleNotices, "2026-10-04");
  const script = generateMacNotificationScript(briefing);
  assert.equal(script.includes("osascript -e"), true);
  assert.equal(script.includes("display notification"), true);
  assert.equal(script.includes("Apple Store"), true);
});
