const {
  getTemplate,
  matchTemplates,
  listTemplates
} = require('./config/digital-business-template-library');
const { getService } = require('./digital-business-services');

const FINANCIAL_ACTIONS = new Set([
  'payment',
  'purchase',
  'transfer',
  'receive_money',
  'collection'
]);

function createExecutionPlan(request = {}, options = {}) {
  const text = typeof request === 'string' ? request : request.description || request.request || '';
  const requestedTemplateId = typeof request === 'object' ? request.templateId : null;
  const template = requestedTemplateId ? getTemplate(requestedTemplateId) : matchTemplates(text)[0];

  if (!template) {
    return {
      ok: false,
      status: 'needs_clarification',
      reason: 'no_matching_template',
      availableTemplates: listTemplates().map(item => item.id)
    };
  }

  const serviceId = typeof request === 'object' ? request.serviceId : null;
  const service = serviceId ? getService(serviceId) : null;
  const financialActions = Array.isArray(request.financialActions)
    ? request.financialActions.filter(action => FINANCIAL_ACTIONS.has(action))
    : [];

  const requiresApproval = Boolean(template.approval_required || financialActions.length);

  return {
    ok: true,
    status: requiresApproval ? 'ready_pending_approval' : 'ready_to_execute',
    template: {
      id: template.id,
      name: template.name,
      category: template.category
    },
    service: service ? { id: serviceId, label: service.label } : null,
    inputs: request.inputs || {},
    workflow: template.workflow,
    deliverables: template.deliverables,
    qualityChecks: template.quality_checks,
    financialActions,
    approval: {
      required: requiresApproval,
      reason: financialActions.length ? 'financial_action' : (template.approval_required ? 'template_policy' : null)
    }
  };
}

function advanceExecution(plan, completedSteps = []) {
  if (!plan || !plan.ok) return { ok: false, reason: 'invalid_plan' };

  const completed = new Set(completedSteps);
  const nextStep = plan.workflow.find(step => !completed.has(step));
  if (!nextStep) {
    return {
      ok: true,
      status: 'ready_for_delivery',
      nextStep: null,
      remainingSteps: [],
      deliverables: plan.deliverables
    };
  }

  return {
    ok: true,
    status: 'in_progress',
    nextStep,
    remainingSteps: plan.workflow.filter(step => !completed.has(step))
  };
}

module.exports = {
  FINANCIAL_ACTIONS,
  createExecutionPlan,
  advanceExecution
};
