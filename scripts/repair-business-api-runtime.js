const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "server.js");
let text = fs.readFileSync(file, "utf8");

const customerGet = 'app.get("/api/business/customers", (req, res) => res.json(state.business.customers));';
const customerPost = 'app.post("/api/business/customers", async (req, res) => { try { const customer = business.upsertCustomer(state.business, req.body); audit("business_customer_upserted", { customerId: customer.id }); await saveState(); res.status(201).json(customer); } catch (error) { res.status(400).json({ error: error.message }); } });';

if (text.includes(customerGet) && !text.includes(customerPost)) {
  text = text.replace(customerGet, `${customerGet}\n${customerPost}`, 1);
}

const customerGetCount = text.split(customerGet).length - 1;
if (customerGetCount !== 1) {
  throw new Error(`Expected exactly one GET /api/business/customers route, found ${customerGetCount}`);
}

const leadGet = 'app.get("/api/business/leads", (req, res) => res.json(state.business.leads));';
const firstLead = text.indexOf(leadGet);
const secondLead = firstLead >= 0 ? text.indexOf(leadGet, firstLead + leadGet.length) : -1;
if (secondLead >= 0) {
  text = text.slice(0, secondLead) + text.slice(secondLead + leadGet.length);
}

if ((text.split(leadGet).length - 1) !== 1) {
  throw new Error("Expected exactly one GET /api/business/leads route after repair");
}

fs.writeFileSync(file, text, "utf8");
console.log("ZOZ runtime business API repair: customer POST enabled; duplicate lead GET removed if present.");
