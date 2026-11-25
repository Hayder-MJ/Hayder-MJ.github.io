// Solar Sizer seller remote: the phone side of Seller Tools.
// Runs in the phone's browser (and in Node for the tests). It holds no secrets: the signing key arrives locked
// (AES-256-GCM, key from the phone passphrase by PBKDF2-SHA256) from the seller's own customer list, and is
// unlocked only here, in memory. Seller Tools on the PC (LicenseMaker/RemoteKey.cs) locks it the same way.

export const LIST_URL = "https://anbmbwdloixibhcwvvav.supabase.co";
export const LIST_KEY = "sb_publishable_s5MQwqyzNjuGwtPQ2hmzdw_RKJndbLd";
export const SELLER_WHATSAPP = "+964 784 373 1036";
// The public half of the signing key, built into every Solar Sizer (SolarSizer/Services/Licensing.cs).
export const PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEUzDzjt7WWUgUDEqKfoQYOkoblmsHjUdOnIXpPGizUEdr+CfymxHlYy2PjPu9axX/NXPluKjklWY3ed5rEgn6aw==";
export const TRIAL_DAYS = 30;
export const INCLUDED_USERS = 3;

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const b64 = (bytes) => { let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); };
export const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const b64url = (bytes) => b64(bytes).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Locks a PKCS#8 private key with a passphrase. Same format as RemoteKey.Lock in Seller Tools. */
export async function lockKey(pkcs8, passphrase, publicKey, iterations = 600000) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const aes = await passphraseKey(passphrase, salt, iterations);
  const data = await subtle.encrypt({ name: "AES-GCM", iv }, aes, pkcs8);
  return { v: 1, kdf: "PBKDF2-SHA256", iter: iterations, salt: b64(salt), iv: b64(iv), data: b64(data), public: publicKey };
}

/** Unlocks the signing key. Throws "wrong passphrase" when the passphrase doesn't open it. */
export async function unlockKey(blob, passphrase) {
  if (!blob || blob.v !== 1 || blob.kdf !== "PBKDF2-SHA256") throw new Error("This locked key is from a newer Seller Tools. Update the phone page.");
  const aes = await passphraseKey(passphrase, unb64(blob.salt), blob.iter);
  let pkcs8;
  try { pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, aes, unb64(blob.data)); }
  catch { throw new Error("wrong passphrase"); }
  return subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

const isoDay = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
export { isoDay, dmy };

/** A date with no time, as a UTC midnight Date. */
export const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
export const today = () => { const n = new Date(); return day(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
export const parseDay = (text) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text ?? ""); return m ? day(+m[1], +m[2], +m[3]) : null; };

/** Like .NET AddMonths: the same day of the month, or the month's last day when it has fewer days. */
export function addMonths(d, months) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** Seller Tools' MonthsBetween: whole months from one date to the other. */
export function monthsBetween(from, until) {
  let m = (until.getUTCFullYear() - from.getUTCFullYear()) * 12 + until.getUTCMonth() - from.getUTCMonth();
  if (until.getUTCDate() < from.getUTCDate()) m--;
  return Math.max(m, 0);
}

/** Seller Tools' RenewalPeriod: a renewal starts when the current key ends, anything else today. */
export function renewalPeriod(now, currentEnd, months) {
  const from = currentEnd && currentEnd > now ? currentEnd : now;
  return { from, until: addMonths(from, months), months };
}

/** Seller Tools' price rules: 3 users included, extra users added, 10% off for 6+ months and 17% for 12+ (main price only). */
export function priceFor(basePerMonth, extraUserPerMonth, users, months) {
  const extra = Math.max(users - INCLUDED_USERS, 0);
  const perMonth = basePerMonth + extra * extraUserPerMonth;
  const subtotal = perMonth * months;
  const pct = months >= 12 ? 17 : months >= 6 ? 10 : 0;
  const discount = Math.floor((basePerMonth * months * pct + 50) / 100);
  return { basePerMonth, extraUserPerMonth, extraUsers: extra, perMonth, months, subtotal, discountPct: pct, discount, total: subtotal - discount };
}

const n0 = (n) => n.toLocaleString("en-US");

/** The receipt text, Arabic first, as Seller Tools makes it. */
export function receipt(id, date, company, until, users, q, paidBy, from) {
  const start = from ?? date;
  const paidAr = paidBy === "Qi Card" ? "بطاقة كي كارد (Qi Card)" : "نقداً";
  const ar = ["وصل استلام: Solar Sizer", `رقم الوصل: ${id}`, `التاريخ: ${dmy(date)}`, `الشركة: ${company}`,
    `الاشتراك: ${q.months} شهر، من ${dmy(start)} إلى ${dmy(until)}`, `عدد المستخدمين: ${users}`];
  if (q.discountPct > 0) { ar.push(`المجموع: ${n0(q.subtotal)} دينار`, `المدفوع بعد الخصم: ${n0(q.total)} دينار`); }
  else ar.push(`المجموع المدفوع: ${n0(q.total)} دينار`);
  ar.push(`طريقة الدفع: ${paidAr}`, "شكراً لكم.");
  const en = ["Receipt: Solar Sizer", `Receipt no.: ${id}`, `Date: ${dmy(date)}`, `Company: ${company}`,
    `Subscription: ${q.months} month(s), ${dmy(start)} to ${dmy(until)}`, `Users: ${users}`];
  if (q.discountPct > 0) { en.push(`Subtotal: ${n0(q.subtotal)} IQD`, `After discount, total paid: ${n0(q.total)} IQD`); }
  else en.push(`Total paid: ${n0(q.total)} IQD`);
  en.push(`Paid by: ${paidBy}`, "Thank you.");
  return ar.join("\n") + "\n\n" + en.join("\n") + `\n\nWhatsApp: ${SELLER_WHATSAPP}\n`;
}

/** The text a licence key signs: the same fields and names Solar Sizer reads (LicenseInfo). */
export function licencePayload({ company, until, users, issued, id }) {
  return JSON.stringify({ Company: company, Expires: isoDay(until) + "T00:00:00", Users: users, Issued: isoDay(issued) + "T00:00:00", Id: id });
}

export const newId = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");

/** A Solar Sizer licence key: SSL1-<payload>.<signature>, signed with ECDSA P-256 / SHA-256 like Seller Tools. */
export async function makeLicence(privateKey, info) {
  const payload = enc.encode(licencePayload(info));
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, payload);
  return "SSL1-" + b64url(payload) + "." + b64url(sig);
}

/** True when a key opens in Solar Sizer: signed by the given public key (SPKI, base64). Same check as Licensing.Read. */
export async function licenceIsGenuine(key, publicKey = PUBLIC_KEY) {
  const m = /^SSL1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key ?? "");
  if (!m) return false;
  const fromUrl = (s) => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const pub = await subtle.importKey("spki", unb64(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, fromUrl(m[2]), fromUrl(m[1]));
}

/** The WhatsApp message with the key, as Seller Tools sends it. */
export const keyMessage = (company, key) =>
  `Your Solar Sizer licence key for ${company}:\n\n${key}\n\nIn Solar Sizer: Help → Licence… → paste the key → Activate.`;

/** Seller Tools' WhatsApp number rule: digits only, 00 dropped, an Iraqi 07… number gets 964. "" when too short. */
export function whatsappDigits(phone) {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = "964" + d.slice(1);
  return d.length >= 8 ? d : "";
}

/** A field of a licence request as text: requests come from any copy, so a field may be missing or of another type. */
export const asked = (request, field) => {
  const v = request?.[field];
  return v == null || typeof v === "object" ? "" : String(v);
};
export const askedNumber = (request, field) => { const n = parseInt(asked(request, field), 10); return n > 0 && n < 1000 ? n : null; };

/** One computer in the list, with what Seller Tools shows for it. */
export function customer(row, now = today()) {
  const trialStart = parseDay(row.trial_start), licenceEnd = parseDay(row.licence_until);
  const requestAt = row.request_at ? new Date(row.request_at) : null, activatedAt = row.activated_at ? new Date(row.activated_at) : null;
  const wantsLicence = !!requestAt && (!activatedAt || requestAt > activatedAt);
  const trialEnd = trialStart ? new Date(trialStart.getTime() + TRIAL_DAYS * 86400000) : null;
  const end = licenceEnd ?? trialEnd;
  const daysLeft = end ? Math.round((end - now) / 86400000) : null;
  const status = wantsLicence ? "Wants a licence"
    : licenceEnd ? (licenceEnd >= now ? "Subscribed" : "Subscription ended")
    : trialEnd && trialEnd >= now ? "On trial" : "Trial ended";
  return {
    id: row.install_id, company: asked(row.request, "company") || row.company || row.licence_company || "",
    phone: asked(row.request, "phone") || row.phone || "", status, wantsLicence, daysLeft, licenceEnd, trialEnd,
    users: askedNumber(row.request, "users") ?? row.licence_users ?? 3, months: askedNumber(row.request, "months") ?? 12,
    paidBy: asked(row.request, "payment") === "Qi Card" ? "Qi Card" : "Cash", note: asked(row.request, "note"),
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
  };
}

/** Calls a password-protected function of the customer list. Throws the list's own message on a refusal. */
export async function rpc(name, args, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${LIST_URL}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: LIST_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`The customer list can't be reached right now (${res.status}).`);
  const body = await res.json();
  if (body && typeof body === "object" && !Array.isArray(body) && body.error) throw new Error(body.error);
  return body;
}
