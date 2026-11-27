// Used by the program tests (Tests/SolarSizer.Tests/PhoneRemoteTests.cs) to check that the phone page makes the same
// keys, prices and receipts as Seller Tools. Input: one JSON argument. Output: JSON on stdout.
import * as R from "../seller/remote.js";

const job = JSON.parse(process.argv[2]);
const d = (t) => R.parseDay(t);
let out;
if (job.mode === "sign") {
  const key = await R.unlockKey(job.locked, job.passphrase);
  out = { key: await R.makeLicence(key, { company: job.company, until: d(job.until), users: job.users, issued: d(job.issued), id: job.id }) };
} else if (job.mode === "wrong") {
  try { await R.unlockKey(job.locked, job.passphrase); out = { opened: true }; } catch (e) { out = { opened: false, error: e.message }; }
} else if (job.mode === "receipt") {
  const q = R.priceFor(job.users, job.months, job.code ?? "");
  out = { q, text: R.receipt(job.id, d(job.date), job.company, d(job.until), job.users, q, job.paidBy, job.from ? d(job.from) : undefined) };
} else if (job.mode === "period") {
  const p = R.renewalPeriod(d(job.today), job.end ? d(job.end) : null, job.months);
  out = { from: R.isoDay(p.from), until: R.isoDay(p.until), between: R.monthsBetween(p.from, p.until) };
}
process.stdout.write(JSON.stringify(out));
