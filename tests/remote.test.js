import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../seller/remote.js";

test("WhatsApp numbers follow Seller Tools' rule", () => {
  assert.equal(R.whatsappDigits("07714493319"), "9647714493319");
  assert.equal(R.whatsappDigits("+964 771 449 3319"), "9647714493319");
  assert.equal(R.whatsappDigits("00964 771 449 3319"), "9647714493319");
  assert.equal(R.whatsappDigits("123"), "");
});

test("a request's fields of another type don't break the list", () => {
  const c = R.customer({ install_id: "a", company: "Shop", request_at: "2026-11-25T08:00:00Z", trial_start: "2026-11-04",
    request: { phone: 7714493319, users: "5", months: "x", note: [], payment: "Qi Card" } }, R.day(2026, 11, 25));
  assert.equal(c.phone, "7714493319");
  assert.equal(c.users, 5);
  assert.equal(c.months, 12);
  assert.equal(c.note, "");
  assert.equal(c.paidBy, "Qi Card");
  assert.equal(c.wantsLicence, true);
  assert.equal(c.daysLeft, 9);
});

test("a key entered after the request means the request is done", () => {
  const c = R.customer({ install_id: "a", request_at: "2026-11-20T08:00:00Z", activated_at: "2026-11-21T08:00:00Z", licence_until: "2027-11-21" }, R.day(2026, 11, 25));
  assert.equal(c.wantsLicence, false);
  assert.equal(c.status, "Subscribed");
});

test("a key that was tampered with doesn't pass the check", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = R.b64(await crypto.subtle.exportKey("spki", pair.publicKey));
  const key = await R.makeLicence(pair.privateKey, { company: "A", until: R.day(2027, 1, 1), users: 3, issued: R.day(2026, 1, 1), id: "x" });
  assert.equal(await R.licenceIsGenuine(key, pub), true);
  assert.equal(await R.licenceIsGenuine(key.replace("SSL1-e", "SSL1-f"), pub), false);
  assert.equal(await R.licenceIsGenuine(key), false);   // not signed with the real key
});

test("a refused password comes back as the list's own message", async () => {
  const fake = async () => ({ ok: true, json: async () => ({ error: "Wrong password." }) });
  await assert.rejects(R.rpc("seller_phone_key", { p_password: "x" }, fake), /Wrong password\./);
});
