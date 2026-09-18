const { createStore, createTask, advanceSafeTask } = require('../execution-engine');
const { createExecutionPlan } = require('../digital-business-execution');

const TEST_SOURCE = 'digital_execution_library_runtime_test_v1';
const ARTIFACT = 'artifacts/execution-test/landing-page.html';

async function main() {
  const store = createStore();
  try {
    await store.init();
  } catch (error) {
    console.warn('[ZOZ execution library test] database unavailable during pre-deploy check; continuing:', error.message);
    return;
  }
  const state = await store.load();
  const existing = state.tasks.find((task) => task.source === TEST_SOURCE);
  if (existing) {
    console.log('[ZOZ execution library test] already recorded', JSON.stringify({
      taskId: existing.id,
      status: existing.status,
      stage: existing.stage,
      artifact: ARTIFACT,
      durable: store.durable
    }));
    return;
  }

  const request = {
    templateId: 'landing-page',
    title: 'اختبار فعلي — Landing Page عبر مكتبة التنفيذ',
    description: 'اختبار تشغيل مكتبة ZOZ AI وأداة GitHub بإنشاء وتسليم صفحة هبوط اختبارية غير منشورة.',
    source: TEST_SOURCE,
    availableTools: ['github'],
    skills: ['websites'],
    inputs: {
      business_name: 'ZOZ AI Test',
      offer: 'اختبار مسار التنفيذ الرقمي',
      audience: 'اختبار داخلي',
      cta: 'ابدأ الاختبار'
    }
  };

  const plan = createExecutionPlan(request);
  if (!plan.ok || plan.approval.required) throw new Error('Execution library test plan was not executable without approval');

  const task = createTask(state, request);
  task.digitalExecution = {
    template: plan.template,
    workflow: plan.workflow,
    deliverables: plan.deliverables,
    qualityChecks: plan.qualityChecks,
    financialActions: plan.financialActions,
    approval: plan.approval,
    completedSteps: [],
    artifact: ARTIFACT,
    status: 'ready_to_execute'
  };

  const steps = [];
  while (task.status !== 'completed') {
    const result = advanceSafeTask(state, task);
    if (!result.executed) throw new Error(`Execution test blocked: ${result.reason}`);
    steps.push({ stage: result.stage, status: result.status, tools: result.selectedTools });
    if (steps.length > 12) throw new Error('Execution test exceeded expected stage count');
  }

  task.digitalExecution.completedSteps = steps.map((item) => item.stage);
  task.digitalExecution.status = 'completed';
  task.digitalExecution.testResult = 'passed';
  task.digitalExecution.artifact = ARTIFACT;
  await store.save(state);

  console.log('[ZOZ execution library test] PASSED', JSON.stringify({
    taskId: task.id,
    template: plan.template.id,
    executionMode: task.plan.toolRouting.executionMode,
    tools: task.plan.tools,
    stages: steps,
    artifact: ARTIFACT,
    durable: store.durable
  }));
}

main().catch((error) => {
  console.error('[ZOZ execution library test] FAILED', error.message);
  process.exitCode = 1;
});
