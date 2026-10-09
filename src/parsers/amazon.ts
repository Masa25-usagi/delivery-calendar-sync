import type { DeliveryNotice, TimeSlot } from "../types.ts";

export function parseAmazonNotice(text: string, subject = ""): DeliveryNotice | null {
  if (!text.includes("Amazon.co.jp") && !subject.includes("Amazon") && !text.includes("Amazonプライム")) {
    return null;
  }

  // Order Number: 3-7-7 digits
  const orderMatch = text.match(/(?:注文番号|Order #)[\s:：]*([0-9]{3}-[0-9]{7}-[0-9]{7})/);
  const trackingNumber = orderMatch ? orderMatch[1] : undefined;

  // Delivery date (supports single day or multi-day range like 10月5日 - 10月8日)
  let estimatedDate = "";
  let estimatedEndDate: string | undefined;

  const rangeDateMatch = text.match(/(?:お届け予定日?|配達予定日?|到着予定)[\s:：]*([0-9]{4}年)?([0-9]{1,2})月([0-9]{1,2})日(?:\([^\)]+\))?\s*[-〜~]\s*([0-9]{4}年)?([0-9]{1,2})月([0-9]{1,2})日/);
  if (rangeDateMatch) {
    const year1 = rangeDateMatch[1] ? rangeDateMatch[1].replace("年", "") : new Date().getFullYear().toString();
    const m1 = rangeDateMatch[2].padStart(2, "0");
    const d1 = rangeDateMatch[3].padStart(2, "0");
    estimatedDate = `${year1}-${m1}-${d1}`;

    const year2 = rangeDateMatch[4] ? rangeDateMatch[4].replace("年", "") : year1;
    const m2 = rangeDateMatch[5].padStart(2, "0");
    const d2 = rangeDateMatch[6].padStart(2, "0");
    estimatedEndDate = `${year2}-${m2}-${d2}`;
  } else {
    const dateMatch = text.match(/(?:お届け予定日?|配達予定日?|到着予定)[\s:：]*([0-9]{4}年)?([0-9]{1,2})月([0-9]{1,2})日/);
    if (dateMatch) {
      const year = dateMatch[1] ? dateMatch[1].replace("年", "") : new Date().getFullYear().toString();
      const month = dateMatch[2].padStart(2, "0");
      const day = dateMatch[3].padStart(2, "0");
      estimatedDate = `${year}-${month}-${day}`;
    }
  }

  // Time slot if specified
  let timeSlot: TimeSlot | undefined;
  const timeMatch = text.match(/([0-9]{1,2}:[0-9]{2})\s*[-〜~]\s*([0-9]{1,2}:[0-9]{2})/);
  if (timeMatch) {
    const [startH, startM] = timeMatch[1].split(":").map(Number);
    const [endH, endM] = timeMatch[2].split(":").map(Number);
    timeSlot = { raw: timeMatch[0], startHour: startH, startMinute: startM, endHour: endH, endMinute: endM };
  } else if (/午前中/.test(text)) {
    timeSlot = { raw: "午前中", startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 };
  }

  // Item description
  const itemMatch = text.match(/(?:\"([^\"]+)\"|「([^」]+)」)/);
  const itemDescription = itemMatch ? (itemMatch[1] || itemMatch[2]) : "Amazon注文商品";

  return {
    carrier: "amazon",
    carrierName: "Amazon.co.jp配送",
    trackingNumber,
    sender: "Amazon.co.jp",
    itemDescription,
    estimatedDate: estimatedDate || new Date().toISOString().split("T")[0],
    estimatedEndDate,
    timeSlot,
    status: "shipped",
    trackingUrl: trackingNumber ? `https://www.amazon.co.jp/gp/your-account/order-details?orderID=${trackingNumber}` : undefined,
    rawSubject: subject
  };
}
