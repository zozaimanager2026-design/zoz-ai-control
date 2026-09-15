const assert = require("assert");
const { normalizePhone, shouldSuppress, createContactEvent } = require("./contact-history");

assert.strictEqual(normalizePhone("01150044446"), "+201150044446");
assert.strictEqual(normalizePhone("+20 11 50044446"), "+201150044446");

const first = createContactEvent({ phone: "01150044446", name: "Helio Dental" }, { status: "contacted", channel: "whatsapp", source: "manual" });
const decision = shouldSuppress({ phone: "+201150044446", name: "Different Name" }, [first]);
assert.strictEqual(decision.suppressed, true);
assert.strictEqual(decision.reason, "phone");

const byWebsite = shouldSuppress({ website: "https://www.example.com/" }, [createContactEvent({ website: "example.com", name: "Example" }, { status: "sent" })]);
assert.strictEqual(byWebsite.suppressed, true);
assert.strictEqual(byWebsite.reason, "website");

const byNameAddress = shouldSuppress({ name: "Example Clinic", address: "Cairo" }, [createContactEvent({ name: "Example Clinic", address: "Cairo" }, { status: "discovered" })]);
assert.strictEqual(byNameAddress.suppressed, true);
assert.strictEqual(byNameAddress.reason, "name_address");

const newLead = shouldSuppress({ phone: "01000000000", name: "New Lead" }, [first]);
assert.strictEqual(newLead.suppressed, false);

console.log("Contact history tests passed: phone/email/website/name-address duplicate suppression works.");
