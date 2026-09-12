const PEACH_EVENTS = new Set([
  "message_delivery.sent",
  "message_delivery.delivered",
  "message_delivery.failed",
  "message_delivery.read",
  "message_delivery.replied"
]);

function normalizeLiquidValues(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("liquid_values must be an object");
  return value;
}

function buildPeachTemplatePayload({ to, templateId, liquidValues, name, email, metadata, businessPhoneNumber, replyAutomationAppId } = {}) {
  if (!to) throw new Error("recipient phone number is required");
  if (!templateId) throw new Error("Peach template id is required");
  const contact = { phone_number: String(to) };
  if (name) contact.name = String(name);
  if (email) contact.email = String(email);
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) contact.metadata = metadata;
  const templateMessage = { whats_app_template_id: String(templateId), liquid_values: normalizeLiquidValues(liquidValues) };
  if (businessPhoneNumber) templateMessage.business_phone_number = String(businessPhoneNumber);
  if (replyAutomationAppId) templateMessage.reply_automation = { app_id: String(replyAutomationAppId) };
  return { event_type: "send_template_message", contact, template_message: templateMessage };
}

function normalizePeachWebhook(payload = {}) {
  const type = String(payload.type || payload.event_type || payload.eventType || payload.event?.type || "").trim();
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const contact = data.contact || payload.contact || {};
  const message = data.message || payload.message || {};
  const reply = message.reply || data.reply || payload.reply || {};
  const author = reply.author || {};
  const phone = String(contact.phone_number || author.phone_number || reply._phone_number || "").trim();
  const name = String(contact.name || author.name || "").trim();
  const text = String(reply.text || payload.reply?.text || "").trim();
  return { type, supported: PEACH_EVENTS.has(type), phone, name, text, messageId: message.id || null, status: message.status || null, reason: message.reason || null, contactId: contact.id || null, replyId: reply.id || null };
}

function publicWebhookAudit(event) {
  return { type: event.type || null, messageId: event.messageId || null, status: event.status || null, reason: event.reason ? String(event.reason).slice(0, 200) : null, hasPhone: Boolean(event.phone), hasName: Boolean(event.name), hasText: Boolean(event.text) };
}

module.exports = { PEACH_EVENTS, buildPeachTemplatePayload, normalizePeachWebhook, publicWebhookAudit };
