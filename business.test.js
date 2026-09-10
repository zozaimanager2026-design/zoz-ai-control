const assert = require("node:assert/strict");
const {
  createBusinessState,
  addLead,
  moveLead,
  createOrder,
  registerOpportunity,
  planAction,
  businessSummary
} = require("./business");

const state = createBusinessState();
const lead = addLead(state, {
  name: "Test Customer",
  request: "مكيف جديد",
  budget: 10000,
  source: "test"
});
assert.equal(lead.stage, "lead");

moveLead(state, lead.id, "qualified");
assert.equal(state.leads[0].stage, "qualified");

const order = createOrder(state, {
  leadId: lead.id,
  product: "مكيف جديد",
  quotedPrice: 12000,
  depositRequired: 2000
});
assert.equal(order.status, "deposit_pending");
assert.equal(order.financialApprovalRequired, true);

const opportunity = registerOpportunity(state, {
  title: "طلب مكيف جديد",
  description: "عميل جاهز للتواصل",
  score: 85,
  source: "test"
});
assert.equal(opportunity.status, "new");

assert.equal(planAction("send_quote").status, "ready");
assert.equal(planAction("collect_deposit").status, "approval_required");
assert.equal(planAction("collect_deposit").humanApprovalRequired, true);

const summary = businessSummary(state);
assert.equal(summary.leads, 1);
assert.equal(summary.activeOrders, 1);
assert.equal(summary.hotOpportunities, 1);
assert.equal(summary.financialApprovalRequired, true);

console.log("Business layer: healthy");
