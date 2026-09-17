const assert = require("assert");
const { createInitialState, createTask, advanceSafeTask, scoreOpportunity, isFinanciallySensitive, buildPlan } = require("./execution-engine");

assert.strictEqual(isFinanciallySensitive("شراء اشتراك"), true);
assert.strictEqual(isFinanciallySensitive("إنشاء هوية بصرية"), false);

const state=createInitialState();
const design=createTask(state,{title:"هوية بصرية كاملة",description:"لوجو وألوان وخطوط وBrand Guidelines",source:"test"});
assert.strictEqual(design.financial,false);
assert.strictEqual(design.autoExecutable,true);

// Autonomous execution must hand the execute stage to the real renderer bridge
// instead of silently advancing past it before the renderer can run.
design.stage="execute";
const handoff=advanceSafeTask(state,design);
assert.strictEqual(handoff.executed,false);
assert.strictEqual(handoff.reason,"renderer_execution_pending");
assert.strictEqual(handoff.handoff,"renderer");
assert.strictEqual(design.stage,"execute");

const money=createTask(state,{title:"شراء أداة تصميم",description:"دفع اشتراك شهري",source:"test"});
assert.strictEqual(money.status,"approval_required");
assert.strictEqual(advanceSafeTask(state,money).reason,"financial_approval_required");

const plan=buildPlan({title:"موقع شركة",description:"موقع ويب مع GitHub وVercel"});
assert.strictEqual(plan.mobileControl,true);
assert.ok(plan.skills.includes("websites"));

const score=scoreOpportunity({title:"Brand Identity",description:"logo and guidelines",requirementCompleteness:90,budgetFit:90,competition:10,risk:5});
assert.ok(score.score>=70);
console.log("execution-engine tests passed");
