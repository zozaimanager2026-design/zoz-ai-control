const fs = require('fs');
const path = require('path');
const { createExecutionPlan } = require('../digital-business-execution');

const artifact = path.join(__dirname, '..', 'artifacts/execution-test/landing-page.html');
const request = {
  templateId: 'landing-page',
  title: 'Digital execution deploy check',
  source: 'digital_execution_deploy_check',
  availableTools: ['github'],
  skills: ['websites'],
  inputs: { business_name: 'ZOZ AI Test', offer: 'runtime verification', audience: 'internal', cta: 'test' }
};

const plan = createExecutionPlan(request);
if (!plan.ok || plan.approval.required) throw new Error('Landing-page execution plan is not safely executable');
if (!fs.existsSync(artifact)) throw new Error('Execution test artifact is missing');

console.log(JSON.stringify({
  ok: true,
  template: plan.template.id,
  executionMode: plan.executionMode,
  artifact: 'artifacts/execution-test/landing-page.html'
}));
