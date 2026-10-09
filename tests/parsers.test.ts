import test from "node:test";
import assert from "node:assert/strict";
import { parseYamatoNotice } from "../src/parsers/yamato.ts";
import { parseSagawaNotice } from "../src/parsers/sagawa.ts";
import { parseJapanPostNotice } from "../src/parsers/japanpost.ts";
import { parseAppleNotice } from "../src/parsers/apple.ts";
import { parseAmazonNotice } from "../src/parsers/amazon.ts";
import { detectAndParseNotice } from "../src/parsers/detector.ts";

test("parseYamatoNotice parses tracking number, date, slot and sender", () => {
  const email = `
ヤマト運輸をご利用いただきありがとうございます。
お荷物のお届け予定日時をお知らせいたします。

■お届け予定日時
2026年10月04日(日)
午前中

■お荷物情報
伝票番号：1234-5678-9012
ご依頼主：ヨドバシカメラ
品名：PC周辺機器・ケーブル
`;
  const notice = parseYamatoNotice(email, "【クロネコヤマト】お荷物お届けのお知らせ");
  assert.notEqual(notice, null);
  assert.equal(notice?.carrier, "yamato");
  assert.equal(notice?.trackingNumber, "123456789012");
  assert.equal(notice?.estimatedDate, "2026-10-04");
  assert.equal(notice?.timeSlot?.raw, "午前中");
  assert.equal(notice?.timeSlot?.startHour, 9);
  assert.equal(notice?.timeSlot?.endHour, 12);
  assert.equal(notice?.sender, "ヨドバシカメラ");
});

test("parseSagawaNotice parses Sagawa notice with afternoon time slot", () => {
  const email = `
佐川急便よりお荷物お届け予定のお知らせです。

お問い合せ送り状No.：3456-7890-1234
お届け予定日時：2026年10月05日(月) 14時〜16時
ご依頼主：ZOZOTOWN
品名：衣類
`;
  const notice = parseSagawaNotice(email);
  assert.notEqual(notice, null);
  assert.equal(notice?.carrier, "sagawa");
  assert.equal(notice?.trackingNumber, "345678901234");
  assert.equal(notice?.estimatedDate, "2026-10-05");
  assert.equal(notice?.timeSlot?.startHour, 14);
  assert.equal(notice?.timeSlot?.endHour, 16);
  assert.equal(notice?.sender, "ZOZOTOWN");
});

test("parseJapanPostNotice parses Yu-Pack tracking and morning slot", () => {
  const email = `
日本郵便をご利用いただきありがとうございます。
ゆうパックのお届け予定をお知らせします。

お問い合わせ番号：9876-5432-1098
お届け予定日：2026年10月06日(火)
お届け時間帯：午前中
差出人様：メルカリ
`;
  const notice = parseJapanPostNotice(email);
  assert.notEqual(notice, null);
  assert.equal(notice?.carrier, "japanpost");
  assert.equal(notice?.trackingNumber, "987654321098");
  assert.equal(notice?.estimatedDate, "2026-10-06");
  assert.equal(notice?.timeSlot?.raw, "午前中");
  assert.equal(notice?.sender, "メルカリ");
});

test("parseAppleNotice parses Apple Store earphone order as mentioned in meeting", () => {
  const email = `
お客様のご注文商品を出荷いたしました。
ご注文ありがとうございます。

ご注文番号：W1982736450
配送業者：ヤマト運輸
配送伝票番号：4321-8765-2109
お届け予定日：2026/10/04

出荷された商品：
EarPods with USB-C Connector
数量：1
`;
  const notice = parseAppleNotice(email, "お客様のご注文商品を出荷いたしました。");
  assert.notEqual(notice, null);
  assert.equal(notice?.carrier, "apple");
  assert.equal(notice?.trackingNumber, "432187652109");
  assert.equal(notice?.estimatedDate, "2026-10-04");
  assert.equal(notice?.itemDescription, "EarPods with USB-C Connector");
});

test("parseAmazonNotice parses Amazon package dispatch", () => {
  const email = `
Amazon.co.jp ご注文の発送

注文番号： 250-9876543-1234567
お届け予定日： 2026年10月04日
お届け時間： 18:00 - 20:00

お届け商品：
"Anker USB-C 急速充電器 65W"
`;
  const notice = parseAmazonNotice(email, "Amazon.co.jp ご注文の発送");
  assert.notEqual(notice, null);
  assert.equal(notice?.carrier, "amazon");
  assert.equal(notice?.trackingNumber, "250-9876543-1234567");
  assert.equal(notice?.estimatedDate, "2026-10-04");
  assert.equal(notice?.timeSlot?.startHour, 18);
  assert.equal(notice?.timeSlot?.endHour, 20);
  assert.equal(notice?.itemDescription, "Anker USB-C 急速充電器 65W");
});

test("detectAndParseNotice automatically detects carrier", () => {
  const appleNotice = detectAndParseNotice(`
Apple Storeより配送のお知らせ
ご注文番号：W1122334455
お届け予定日：2026/10/08
出荷された商品：iPad Air
`);
  assert.equal(appleNotice.carrier, "apple");
  assert.equal(appleNotice.itemDescription, "iPad Air");
});

test("parseAmazonNotice parses multi-day span delivery estimate", () => {
  const email = `
Amazon.co.jp ご注文の発送
注文番号： 250-1234567-8901234
お届け予定日： 10月5日 - 10月8日
お届け商品： "TypeScript実践プログラミング"
`;
  const notice = parseAmazonNotice(email, "Amazon.co.jp ご注文の発送");
  assert.notEqual(notice, null);
  assert.equal(notice?.estimatedDate.endsWith("-10-05"), true);
  assert.equal(notice?.estimatedEndDate?.endsWith("-10-08"), true);
  assert.equal(notice?.itemDescription, "TypeScript実践プログラミング");
});

test("detectAndParseNotice ignores conflicting dates in quoted email history", () => {
  const forwardedEmail = `
Fwd: ヤマト運輸からのお届け予定

---------- Forwarded message ---------
From: ヤマト運輸 <user-887418e@example.com>
Date: 2026年10月07日 09:00
Subject: お荷物お届けのお知らせ

お荷物のお届け予定日時をお知らせいたします。
お届け予定日時：2026年10月08日(木) 14時〜16時
伝票番号：998877665544
ご依頼主：任天堂オンライン

On 2026年10月01日, someone wrote:
お届け予定日時：2026年10月02日 09:00-12:00
伝票番号：112233445566
`;
  const notice = detectAndParseNotice(forwardedEmail, "Fwd: お荷物お届けのお知らせ");
  assert.equal(notice.carrier, "yamato");
  assert.equal(notice.trackingNumber, "998877665544");
  assert.equal(notice.estimatedDate, "2026-10-08");
  assert.equal(notice.timeSlot?.startHour, 14);
});
