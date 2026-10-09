import type { DeliveryNotice, MorningBriefing } from "./types.ts";

/**
 * Formats morning delivery briefing for today's deliveries
 */
export function buildMorningBriefing(notices: DeliveryNotice[], targetDate?: string): MorningBriefing {
  const date = targetDate || new Date().toISOString().split("T")[0];
  const todayNotices = notices.filter(n => n.estimatedDate === date);

  if (todayNotices.length === 0) {
    return {
      date,
      deliveries: [],
      summaryText: `本日（${date}）配達予定の荷物はありません。`,
      markdown: `### 📦 本日（${date}）の荷物お届け予定\n\n本日予定されている配達はありません。`,
      discordEmbed: {
        title: `📦 本日の荷物お届け予定 (${date})`,
        description: "本日配達予定の荷物はありません。",
        color: 0x2ecc71, // Green
        fields: [],
        footer: { text: "delivery-calendar-sync" }
      }
    };
  }

  const itemsList = todayNotices.map((n, idx) => {
    const slot = n.timeSlot ? `【${n.timeSlot.raw}】` : "【時間指定なし】";
    const desc = n.itemDescription ? ` - ${n.itemDescription}` : "";
    const sender = n.sender ? ` (差出人: ${n.sender})` : "";
    return `${idx + 1}. ${slot} ${n.carrierName}${desc}${sender}`;
  });

  const summaryText = `本日（${date}）は ${todayNotices.length} 件の荷物がお届け予定です。\n` + itemsList.join("\n");

  const markdownLines = [
    `### 📦 本日（${date}）の荷物お届け予定 (${todayNotices.length}件)`,
    ""
  ];

  const fields = todayNotices.map(n => {
    const slot = n.timeSlot ? n.timeSlot.raw : "指定なし";
    const valueLines = [
      `・**配送業者**: ${n.carrierName}`,
      n.itemDescription ? `・**品名**: ${n.itemDescription}` : "",
      n.sender ? `・**発送元**: ${n.sender}` : "",
      n.trackingNumber ? `・**追跡番号**: \`${n.trackingNumber}\`` : "",
      n.trackingUrl ? `・[配送状況を確認](${n.trackingUrl})` : ""
    ].filter(Boolean);

    markdownLines.push(`#### ${slot}: ${n.carrierName}`);
    markdownLines.push(valueLines.join("\n"));
    markdownLines.push("");

    return {
      name: `⏰ ${slot}`,
      value: valueLines.join("\n") || "詳細なし",
      inline: false
    };
  });

  return {
    date,
    deliveries: todayNotices,
    summaryText,
    markdown: markdownLines.join("\n"),
    discordEmbed: {
      title: `📦 本日の荷物お届け予定 (${todayNotices.length}件)`,
      description: `本日（${date}）到着予定の荷物一覧です。在宅・受取準備にご活用ください。`,
      color: 0x3498db, // Blue
      fields,
      footer: { text: "delivery-calendar-sync" }
    }
  };
}

/**
 * Generates macOS AppleScript command for system notification
 */
export function generateMacNotificationScript(briefing: MorningBriefing): string {
  if (briefing.deliveries.length === 0) return "";
  const first = briefing.deliveries[0];
  const slot = first.timeSlot ? `(${first.timeSlot.raw}) ` : "";
  const body = `${slot}${first.carrierName}${first.itemDescription ? ": " + first.itemDescription : ""}` +
    (briefing.deliveries.length > 1 ? ` 他${briefing.deliveries.length - 1}件` : "");

  return `osascript -e 'display notification "${body.replace(/"/g, '\\"')}" with title "📦 今日の荷物お届け予定" subtitle "合計${briefing.deliveries.length}件"'`;
}
