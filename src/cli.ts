#!/usr/bin/env node
import fs from "node:fs";
import { detectAndParseNotice } from "./parsers/detector.ts";
import { noticeToCalendarEvent, generateIcs } from "./calendar.ts";
import { buildMorningBriefing, generateMacNotificationScript } from "./notifier.ts";
import type { DeliveryNotice } from "./types.ts";

function printUsage() {
  console.log(`
delivery-sync - Delivery notification email parser and calendar/alert bridge

Usage:
  delivery-sync parse <email-file>
  delivery-sync to-ical <email-file...> [--out output.ics]
  delivery-sync briefing <email-file...> [--date YYYY-MM-DD] [--json]
  delivery-sync notify-mac <email-file...>
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  if (command === "parse") {
    const file = args[1];
    if (!file) {
      console.error("Error: Please specify email file to parse.");
      process.exit(1);
    }
    const content = fs.readFileSync(file, "utf-8");
    const notice = detectAndParseNotice(content);
    const event = noticeToCalendarEvent(notice);
    console.log(JSON.stringify({ notice, calendarEvent: event }, null, 2));
    return;
  }

  if (command === "to-ical") {
    let outPath = "";
    const files: string[] = [];
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--out" && args[i + 1]) {
        outPath = args[++i];
      } else {
        files.push(args[i]);
      }
    }
    const notices: DeliveryNotice[] = files.map(f => {
      const c = fs.readFileSync(f, "utf-8");
      return detectAndParseNotice(c);
    });
    const ics = generateIcs(notices);
    if (outPath) {
      fs.writeFileSync(outPath, ics, "utf-8");
      console.log(`iCalendar file generated at ${outPath}`);
    } else {
      console.log(ics);
    }
    return;
  }

  if (command === "briefing") {
    let targetDate = "";
    let asJson = false;
    const files: string[] = [];
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--date" && args[i + 1]) {
        targetDate = args[++i];
      } else if (args[i] === "--json") {
        asJson = true;
      } else {
        files.push(args[i]);
      }
    }
    const notices: DeliveryNotice[] = files.map(f => {
      const c = fs.readFileSync(f, "utf-8");
      return detectAndParseNotice(c);
    });
    const briefing = buildMorningBriefing(notices, targetDate);
    if (asJson) {
      console.log(JSON.stringify(briefing, null, 2));
    } else {
      console.log(briefing.markdown);
    }
    return;
  }

  if (command === "notify-mac") {
    const files = args.slice(1);
    const notices = files.map(f => detectAndParseNotice(fs.readFileSync(f, "utf-8")));
    const briefing = buildMorningBriefing(notices);
    const script = generateMacNotificationScript(briefing);
    if (script) {
      console.log("Run this command to show notification:");
      console.log(script);
    } else {
      console.log("No deliveries for today.");
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
