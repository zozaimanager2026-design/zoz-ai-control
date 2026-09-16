const { createStore, createTask, scoreOpportunity } = require("../execution-engine");
const { listServices, getService, fallbackTools } = require("../digital-business-services");
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
    if (req.method === "GET") return res.status(200).json({ ok:true, service:"ZOZ AI Digital Business Execution", durable:store.durable, mobileControl:true, autonomy:state.autonomy, services:listServices(), skills:state.skills, tools:state.tools, tasks:state.tasks.slice(-50), opportunities:state.opportunities.slice(-50), experience:state.experience.slice(-50), audit:state.audit.slice(-50) });
    if (req.method !== "POST") return res.status(405).json({ ok:false,error:"method_not_allowed" });
    const body=req.body||{}, action=String(body.action||"").trim();
    if(action==="create_task") { const task=createTask(state,body); await store.save(state); return res.status(201).json({ok:true,durable:store.durable,task}); }
    if(action==="score_opportunity") return res.status(200).json({ok:true,score:scoreOpportunity(body)});
    if(action==="get_service") { const service=getService(body.serviceId); if(!service) return res.status(404).json({ok:false,error:"service_not_found"}); return res.status(200).json({ok:true,service}); }
    if(action==="fallback_tools") return res.status(200).json({ok:true,serviceId:body.serviceId,tools:fallbackTools(body.serviceId,Array.isArray(body.unavailable)?body.unavailable:[])});
    return res.status(400).json({ok:false,error:"unknown_action",allowed:["create_task","score_opportunity","get_service","fallback_tools"]});
  } catch(error) { return res.status(500).json({ok:false,error:"execution_api_error",message:error.message}); }
};
