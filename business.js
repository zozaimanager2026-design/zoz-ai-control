const PIPELINE_STAGES = [
  "lead",
  "qualified",
  "quote_sent",
  "deposit_pending",
  "deposit_received",
  "sourcing",
  "delivery",
  "completed",
  "cancelled"
];

const FINANCIAL_ACTIONS = new Set([
  "collect_deposit",
  "purchase_product",
  "pay_supplier",
  "transfer_money",
  "refund",
  "receive_money"
]);

function createBusinessState() {
  return {
    customers: [],
    leads: [],
    orders: [],
    products: [],
    suppliers: [],
    expenses: [],
    opportunities: [],
    reports: []
  };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addLead(state, input = {}) {
  const lead = {
    id: makeId("lead"),
    name: String(input.name || "").trim(),
    phone: String(input.phone || "").trim(),
    request: String(input.request || "").trim(),
    budget: input.budget ?? null,
    source: String(input.source || "manual"),
    stage: "lead",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.leads.push(lead);
  return lead;
}

function moveLead(state, leadId, stage) {
  if (!PIPELINE_STAGES.includes(stage)) throw new Error("Invalid pipeline stage");
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) throw new Error("Lead not found");
  lead.stage = stage;
  lead.updatedAt = new Date().toISOString();
  return lead;
}

function createOrder(state, input = {}) {
  const order = {
    id: makeId("order"),
    leadId: input.leadId || null,
    customerId: input.customerId || null,
    product: String(input.product || "").trim(),
    quotedPrice: input.quotedPrice ?? null,
    depositRequired: input.depositRequired ?? null,
    status: "deposit_pending",
    financialApprovalRequired: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.orders.push(order);
  return order;
}

function registerOpportunity(state, input = {}) {
  const opportunity = {
    id: makeId("opp"),
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    score: Math.max(0, Math.min(100, Number(input.score ?? 0))),
    source: String(input.source || "manual"),
    status: "new",
    financialActionRequired: false,
    createdAt: new Date().toISOString()
  };
  state.opportunities.push(opportunity);
  return opportunity;
}

function planAction(action, payload = {}) {
  const financial = FINANCIAL_ACTIONS.has(action);
  return {
    id: makeId("action"),
    action,
    payload,
    status: financial ? "approval_required" : "ready",
    financial,
    humanApprovalRequired: financial,
    createdAt: new Date().toISOString()
  };
}

function businessSummary(state) {
  const activeOrders = state.orders.filter((o) => !["completed", "cancelled"].includes(o.status));
  const pendingDeposits = state.orders.filter((o) => o.status === "deposit_pending");
  const hotOpportunities = state.opportunities.filter((o) => o.status === "new" && o.score >= 70);
  return {
    customers: state.customers.length,
    leads: state.leads.length,
    activeOrders: activeOrders.length,
    pendingDeposits: pendingDeposits.length,
    products: state.products.length,
    suppliers: state.suppliers.length,
    expenses: state.expenses.length,
    opportunities: state.opportunities.length,
    hotOpportunities: hotOpportunities.length,
    financialApprovalRequired: true,
    pipelineStages: PIPELINE_STAGES
  };
}

module.exports = {
  PIPELINE_STAGES,
  FINANCIAL_ACTIONS,
  createBusinessState,
  addLead,
  moveLead,
  createOrder,
  registerOpportunity,
  planAction,
  businessSummary
};
