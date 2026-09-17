const assert = require('node:assert/strict');
const {
  createExecutionPlan,
  advanceExecution
} = require('./digital-business-execution');

const plan = createExecutionPlan({
  description: 'محتاج صفحة هبوط لشركة عقارات',
  inputs: { business_name: 'Example Realty' }
});

assert.equal(plan.ok, true);
assert.equal(plan.template.id, 'landing-page');
assert.equal(plan.status, 'ready_to_execute');
assert.equal(plan.approval.required, false);

const next = advanceExecution(plan, ['requirements', 'wireframe']);
assert.equal(next.status, 'in_progress');
assert.equal(next.nextStep, 'copy');

const financialPlan = createExecutionPlan({
  description: 'محتاج متجر ومنتجات',
  financialActions: ['purchase']
});
assert.equal(financialPlan.approval.required, true);
assert.equal(financialPlan.status, 'ready_pending_approval');
assert.deepEqual(financialPlan.financialActions, ['purchase']);

const done = advanceExecution(plan, plan.workflow);
assert.equal(done.status, 'ready_for_delivery');
assert.equal(done.nextStep, null);

console.log('digital-business-execution tests passed');
