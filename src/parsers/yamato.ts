import type { DeliveryNotice, TimeSlot } from "../types.ts";

export function parseYamatoTimeSlot(text: string): TimeSlot | undefined {
  if (/午前中|午前/i.test(text)) {
    return { raw: "午前中", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 };
  }
  const matchRange = text.match(/(\d{1,2})時?(?:[〜~\-:](\d{1,2})時?)?/);
  if (matchRange) {
    const start = parseInt(matchRange[1], 10);
    const end = matchRange[2] ? parseInt(matchRange[2], 10) : start + 2;
    return { raw: text.trim(), startHour: start, startMinute: 0, endHour: end, endMinute: 0 };
  }
  return undefined;
}

export function parseYamatoNotice(text: string, subject = ""): DeliveryNotice | null {
  if (!text.includes("ヤマト運輸") && !subject.includes("ヤマト運輸") && !text.includes("クロネコヤマト")) {
    return null;
  }

  // Tracking number: 12 digits
  const trackingMatch = text.match(/(?:伝票番号|お問い?合わせ(?:番号|No\.?))[\s:：]*([0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4})/);
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
  const timeMatch = text.match(/(?:時間帯|お届け予定日時?)[\s\S]*?(午前中|[0-9]{1,2}時[〜~\-][0-9]{1,2}時|[0-9]{1,2}:[0-9]{2}[〜~\-][0-9]{1,2}:[0-9]{2}|希望なし|指定なし)/);
  if (timeMatch && !/希望なし|指定なし/.test(timeMatch[1])) {
    timeSlot = parseYamatoTimeSlot(timeMatch[1]);
  }

  // Sender
  const senderMatch = text.match(/(?:ご依頼主|依頼主|ご請求先|発送元)[\s:：]*([^\n\r]+)/);
  const sender = senderMatch ? senderMatch[1].trim() : undefined;

  // Item
  const itemMatch = text.match(/(?:品名|商品名|お荷物内容)[\s:：]*([^\n\r]+)/);
  const itemDescription = itemMatch ? itemMatch[1].trim() : undefined;

  return {
    carrier: "yamato",
    carrierName: "ヤマト運輸（クロネコヤマト）",
    trackingNumber,
    sender,
    itemDescription,
    estimatedDate: estimatedDate || new Date().toISOString().split("T")[0],
    timeSlot,
    status: "scheduled",
    trackingUrl: trackingNumber ? `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?tracking_number=${trackingNumber}` : undefined,
    rawSubject: subject
  };
}
