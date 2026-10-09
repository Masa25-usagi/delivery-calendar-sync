import type { DeliveryNotice } from "../types.ts";
import { parseYamatoNotice } from "./yamato.ts";
import { parseSagawaNotice } from "./sagawa.ts";
import { parseJapanPostNotice } from "./japanpost.ts";
import { parseAppleNotice } from "./apple.ts";
import { parseAmazonNotice } from "./amazon.ts";

export function stripQuotedEmailHistory(text: string): string {
  // If there's an older reply quote (e.g. "-----Original Message-----" or "On ... wrote:"), remove text after it
  const replyIndex = text.search(/(?:\r?\n)(?:[-]+Original Message[-]+|On [^\n]+ wrote:|20[0-9]{2}年[0-9]{1,2}月[0-9]{1,2}日[^\n]+のメール:)/i);
  if (replyIndex !== -1) {
    return text.substring(0, replyIndex);
  }
  return text;
}

export function detectAndParseNotice(text: string, subject = ""): DeliveryNotice {
  const cleanText = stripQuotedEmailHistory(text);

  // Check specific carrier parsers in order of specificity
  const apple = parseAppleNotice(cleanText, subject);
  if (apple) return apple;

  const amazon = parseAmazonNotice(cleanText, subject);
  if (amazon) return amazon;

  const yamato = parseYamatoNotice(cleanText, subject);
  if (yamato) return yamato;

  const sagawa = parseSagawaNotice(cleanText, subject);
  if (sagawa) return sagawa;

  const japanPost = parseJapanPostNotice(cleanText, subject);
  if (japanPost) return japanPost;

  // Fallback generic parser
  let estimatedDate = new Date().toISOString().split("T")[0];
  const dateMatch = (subject + "\n" + text).match(/([0-9]{4}年)?[0-9]{1,2}月[0-9]{1,2}日/);
  if (dateMatch) {
    const raw = dateMatch[0];
    const yMatch = raw.match(/([0-9]{4})年/);
    const year = yMatch ? yMatch[1] : new Date().getFullYear().toString();
    const mdMatch = raw.match(/([0-9]{1,2})月([0-9]{1,2})日/);
    if (mdMatch) {
      estimatedDate = `${year}-${mdMatch[1].padStart(2, "0")}-${mdMatch[2].padStart(2, "0")}`;
    }
  }

  return {
    carrier: "unknown",
    carrierName: "宅配便・荷物配送",
    itemDescription: subject || "荷物お届け予定",
    estimatedDate,
    status: "scheduled",
    rawSubject: subject
  };
}
