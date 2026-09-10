const assert = require("node:assert/strict");
const {
  createBusinessState,
  normalizePhone,
  normalizeWhatsAppEvent,
  upsertLeadFromWhatsApp,
  businessSummary
} = require("./business");

const state = createBusinessState();

assert.equal(normalizePhone("+20 100-123-4567"), "+201001234567");

const payload = {
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        contacts: [{ wa_id: "201001234567", profile: { name: "Test Customer" } }],
        messages: [{ id: "wamid.test", from: "201001234567", type: "text", text: { body: "محتاج تلاجة جديدة" }, timestamp: "1234567890" }]
      }
    }]
  }]
};

const events = normalizeWhatsAppEvent(payload);
assert.equal(events.length, 1);
assert.equal(events[0].from, "201001234567");
assert.equal(events[0].name, "Test Customer");
assert.equal(events[0].text, "محتاج تلاجة جديدة");

const first = upsertLeadFromWhatsApp(state, {
  phone: events[0].from,
  name: events[0].name,
  request: events[0].text
});
assert.equal(first.created, true);
assert.equal(state.customers.length, 1);
assert.equal(state.leads.length, 1);
assert.equal(state.leads[0].source, "whatsapp");

const second = upsertLeadFromWhatsApp(state, {
  phone: "+20 100-123-4567",
  name: "Test Customer Updated",
  request: "محتاج تلاجة جديدة بسرعة"
});
assert.equal(second.created, false);
assert.equal(state.customers.length, 1);
assert.equal(state.leads.length, 1);
assert.equal(state.leads[0].request, "محتاج تلاجة جديدة بسرعة");
assert.equal(businessSummary(state).activeLeads, 1);

console.log("WhatsApp CRM layer: healthy");
