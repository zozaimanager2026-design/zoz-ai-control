const { createStore, createTask, scoreOpportunity } = require("../execution-engine");
const { listServices, getService, fallbackTools } = require("../digital-business-services");
const { createExecutionPlan, advanceExecution } = require("../digital-business-execution");
const { listTemplates, getTemplate, matchTemplates } = require("../config/digital-business-template-library");
const store = createStore();

function auth(req, res) {
  const secret = process.env.EXECUTION_API_SECRET || process.env.CRON_SECRET;
  if (!secret) return true;
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) { res.status(401).json({ ok:false, error:"unauthorized" }); return false; }
  return true;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!auth(req,res)) return;
  try {
    await store.init();
    const state = await store.load();
    if (req.method === "GET") return res.status(200).json({ ok:true, service:"ZOZ AI Digital Business Execution", durable:store.durable, mobileControl:true, autonomy:state.autonomy, services:listServices(), templates:listTemplates(), skills:state.skills, tools:state.tools, tasks:state.tasks.slice(-50), opportunities:state.opportunities.slice(-50), experience:state.experience.slice(-50), audit:state.audit.slice(-50) });
    if (req.method !== "POST") return res.status(405).json({ ok:false,error:"method_not_allowed" });
    const body=req.body||{}, action=String(body.action||"").trim();
    if(action==="create_task") { const task=createTask(state,body); await store.save(state); return res.status(201).json({ok:true,durable:store.durable,task}); }
    if(action==="score_opportunity") return res.status(200).json({ok:true,score:scoreOpportunity(body)});
    if(action==="get_service") { const service=getService(body.serviceId); if(!service) return res.status(404).json({ok:false,error:"service_not_found"}); return res.status(200).json({ok:true,service}); }
    if(action==="fallback_tools") return res.status(200).json({ok:true,serviceId:body.serviceId,tools:fallbackTools(body.serviceId,Array.isArray(body.unavailable)?body.unavailable:[])});
    if(action==="list_templates") return res.status(200).json({ok:true,templates:listTemplates(body.filters||{})});
    if(action==="match_template") return res.status(200).json({ok:true,templates:matchTemplates(body.request||body.description||"")});
    if(action==="create_business_plan") return res.status(200).json(createExecutionPlan(body.request||body));
    if(action==="advance_business_plan") return res.status(200).json(advanceExecution(body.plan,Array.isArray(body.completedSteps)?body.completedSteps:[]));
    if(action==="create_task_from_request") {
      const request=body.request&&typeof body.request==="object"?body.request:{...body};
      const plan=createExecutionPlan(request);
      if(!plan.ok) return res.status(422).json(plan);

      const task=createTask(state,{
        ...body,
        ...request,
        title:body.title||plan.template.name,
        description:body.description||request.description||request.request||"Digital business execution",
        serviceId:body.serviceId||request.serviceId||null,
        templateId:plan.template.id,
        clientRef:body.clientRef||request.clientRef||null,
        source:body.source||request.source||"digital_business_request"
      });

      task.digitalExecution={
        template:plan.template,
        workflow:plan.workflow,
        deliverables:plan.deliverables,
        qualityChecks:plan.qualityChecks,
        financialActions:plan.financialActions,
        approval:plan.approval,
        completedSteps:[],
        status:plan.approval.required?"approval_required":"ready_to_execute"
      };

      if (plan.approval.required) {
        task.status="approval_required";
        task.humanApprovalRequired=true;
        task.autoExecutable=false;
      }

      await store.save(state);
      return res.status(201).json({ok:true,durable:store.durable,plan,task});
    }
    return res.status(400).json({ok:false,error:"unknown_action",allowed:["create_task","score_opportunity","get_service","fallback_tools","list_templates","match_template","create_business_plan","advance_business_plan","create_task_from_request"]});
  } catch(error) { return res.status(500).json({ok:false,error:"execution_api_error",message:error.message}); }
};
