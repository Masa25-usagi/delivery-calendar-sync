import type { DeliveryNotice } from "../types.ts";

export function parseAppleNotice(text: string, subject = ""): DeliveryNotice | null {
  const isApple = text.includes("Apple") || subject.includes("Apple") || text.includes("apple.com") || /[Ww][0-9]{9,10}/.test(text);
  if (!isApple) {
    return null;
  }

  // Order number: starts with W followed by digits
  const orderMatch = text.match(/(?:ご注文番号|Order Number)[\s:：]*([Ww][0-9]{9,10})/i);
  const trackingMatch = text.match(/(?:お問い合わせ伝票番号|配送伝票番号|Tracking Number)[\s:：]*([0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{3,4})/i);
  const trackingNumber = trackingMatch ? trackingMatch[1].replace(/[-\s]/g, "") : undefined;

  // Delivery date
  let estimatedDate = "";
  const fullDateMatch = text.match(/(?:お届け予定日|配達予定日)[\s:：]*([0-9]{4})[\/\-年]([0-9]{1,2})[\/\-月]([0-9]{1,2})日?/);
  if (fullDateMatch) {
    const year = fullDateMatch[1];
    const month = fullDateMatch[2].padStart(2, "0");
    const day = fullDateMatch[3].padStart(2, "0");
    estimatedDate = `${year}-${month}-${day}`;
  } else {
    const shortDateMatch = text.match(/(?:お届け予定日|配達予定日)[\s:：]*([0-9]{1,2})[\/\-月]([0-9]{1,2})日?/);
    if (shortDateMatch) {
      const year = new Date().getFullYear().toString();
      const month = shortDateMatch[1].padStart(2, "0");
      const day = shortDateMatch[2].padStart(2, "0");
      estimatedDate = `${year}-${month}-${day}`;
    }
  }

  // Carrier detection inside Apple email
  let carrierName = "Apple Store（配送業者配送）";
  if (text.includes("ヤマト運輸")) carrierName = "Apple Store（ヤマト運輸）";
  else if (text.includes("日本郵便")) carrierName = "Apple Store（日本郵便）";
  else if (text.includes("佐川急便")) carrierName = "Apple Store（佐川急便）";

  // Item description
  const itemMatch = text.match(/(?:出荷された商品|お買い上げ商品|ご注文内容|商品名)[\s:：]*\n?([^\n\r]+)/);
  let itemDescription: string | undefined;
  if (itemMatch && !itemMatch[1].includes("出荷いたしました") && !itemMatch[1].includes("ご注文ありがとうございます")) {
    itemDescription = itemMatch[1].trim();
  }

  return {
    carrier: "apple",
    carrierName,
    trackingNumber,
    sender: "Apple Store",
    itemDescription: itemDescription || "Apple Store注文商品",
    estimatedDate: estimatedDate || new Date().toISOString().split("T")[0],
    status: "shipped",
    trackingUrl: trackingNumber ? `https://track.apple.com/` : undefined,
    rawSubject: subject
  };
}
