const crypto = require("crypto");

const now = () => new Date().toISOString();
const CONTACT_DUPLICATE_POLICY_VERSION = 2;

function digits(value = "") {
  return String(value).replace(/\D/g, "");
}

function normalizePhone(value = "") {
  let d = digits(value);
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20") && d.length === 12) return `+${d}`;
  if (d.startsWith("1") && d.length === 11) return `+${d}`;
  if (d.startsWith("0") && d.length >= 10) return `+20${d.slice(1)}`;
  return `+${d}`;
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeWebsite(value = "") {
  return normalizeText(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function fingerprint(contact = {}) {
  const phone = normalizePhone(contact.phone || contact.phone_number || contact.contact);
  const email = normalizeText(contact.email);
  const website = normalizeWebsite(contact.website || contact.url);
  const name = normalizeText(contact.name || contact.title || contact.company);
  const strong = phone || email || website;
  const key = strong || `${name}|${normalizeText(contact.address || "")}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

function matchContact(candidate = {}, history = []) {
  const phone = normalizePhone(candidate.phone || candidate.phone_number || candidate.contact);
  const email = normalizeText(candidate.email);
  const website = normalizeWebsite(candidate.website || candidate.url);
  const name = normalizeText(candidate.name || candidate.title || candidate.company);
  const address = normalizeText(candidate.address);
  for (const record of Array.isArray(history) ? history : []) {
    const rp = normalizePhone(record.phone || record.phone_number);
    const re = normalizeText(record.email);
    const rw = normalizeWebsite(record.website);
    const rn = normalizeText(record.name || record.company || record.title);
    const ra = normalizeText(record.address);
    if (phone && rp && phone === rp) return { matched: true, reason: "phone", record };
    if (email && re && email === re) return { matched: true, reason: "email", record };
    if (website && rw && website === rw) return { matched: true, reason: "website", record };
    if (name && address && rn === name && ra === address) return { matched: true, reason: "name_address", record };
  }
  return { matched: false, reason: null, record: null };
}

function shouldSuppress(candidate = {}, history = []) {
  const match = matchContact(candidate, history);
  if (!match.matched) return { suppressed: false, ...match };
  const status = String(match.record?.status || "").toLowerCase();
  const hard = new Set(["contacted", "sent", "replied", "qualified", "rejected", "opted_out", "do_not_contact", "invalid"]);
  return {
    suppressed: hard.has(status) || Boolean(match.record?.suppress) || match.reason === "website" || match.reason === "name_address",
    ...match
  };
}

function createContactEvent(contact = {}, event = {}) {
  return {
    id: `contact_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    fingerprint: fingerprint(contact),
    phone: normalizePhone(contact.phone || contact.phone_number || contact.contact) || null,
    email: normalizeText(contact.email) || null,
    website: normalizeWebsite(contact.website || contact.url) || null,
    name: String(contact.name || contact.title || contact.company || "").trim() || null,
    address: String(contact.address || "").trim() || null,
    status: event.status || "discovered",
    source: event.source || "unknown",
    channel: event.channel || "unknown",
    suppress: Boolean(event.suppress),
    reason: event.reason || null,
    timestamp: event.timestamp || now(),
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  };
}

module.exports = { CONTACT_DUPLICATE_POLICY_VERSION, normalizePhone, normalizeText, normalizeWebsite, fingerprint, matchContact, shouldSuppress, createContactEvent };
