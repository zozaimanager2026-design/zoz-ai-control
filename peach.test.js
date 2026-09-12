const assert = require("node:assert/strict");
const { buildPeachTemplatePayload, normalizePeachWebhook, publicWebhookAudit } = require("./peach");

const payload = buildPeachTemplatePayload({ to: "+201001234567", templateId: "wat_test_template", liquidValues: { customer_name: "Test Customer", product_name: "Freezer", price: 12000 }, name: "Test Customer", businessPhoneNumber: "201099999999" });
assert.equal(payload.event_type, "send_template_message");
assert.equal(payload.contact.phone_number, "+201001234567");
assert.equal(payload.contact.name, "Test Customer");
assert.equal(payload.template_message.whats_app_template_id, "wat_test_template");
assert.deepEqual(payload.template_message.liquid_values, { customer_name: "Test Customer", product_name: "Freezer", price: 12000 });
assert.equal(Object.prototype.hasOwnProperty.call(payload.template_message.liquid_values, "message"), false);
const noVariablePayload = buildPeachTemplatePayload({ to: "+201001234567", templateId: "wat_no_variable_template", liquidValues: {} });
assert.deepEqual(noVariablePayload.template_message.liquid_values, {});

const peachReplyPayload = { type: "message_delivery.replied", data: { message: { id: "cmsg_test", status: "read", type: "template_message", reason: "", reply: { id: 1, author: { name: "Test Customer", phone_number: "+201001234567" }, text: "محتاج تكييف 3 حصان" } }, contact: { name: "Test Customer", phone_number: "+201001234567" }, event: null } };
const event = normalizePeachWebhook(peachReplyPayload);
assert.equal(event.type, "message_delivery.replied");
assert.equal(event.supported, true);
assert.equal(event.phone, "+201001234567");
assert.equal(event.name, "Test Customer");
assert.equal(event.text, "محتاج تكييف 3 حصان");
assert.equal(event.messageId, "cmsg_test");
const audit = publicWebhookAudit(event);
assert.equal(audit.hasPhone, true);
assert.equal(audit.hasName, true);
assert.equal(audit.hasText, true);
assert.equal(JSON.stringify(audit).includes("PEACH_API_KEY"), false);
console.log("Peach payload/webhook structure: healthy");
