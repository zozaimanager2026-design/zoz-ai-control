const crypto = require("crypto");
const { Pool } = require("pg");
const { getService } = require("./digital-business-services");
const TABLE = "zoz_execution_state";
const FINANCIAL = /دفع|شراء|تحويل|سحب|استلام\s*أموال|استلام\s*اموال|بنك|بطاقة|payment|purchase|transfer|withdraw|receive\s+money|subscription/i;
const SKILLS = {
  brand_identity:{label:"هوية بصرية",outputs:["logo","visual_identity","brand_guidelines","social_assets","final_package"]},
  pdf_documents:{label:"PDF وملفات",outputs:["document","pdf","final_package"]},
  marketing_design:{label:"تصميم وتسويق",outputs:["social_posts","ads","mockups","campaign_assets"]},
  content_writing:{label:"كتابة ومحتوى",outputs:["copy","articles","scripts","emails"]},
  websites:{label:"مواقع",outputs:["source_code","deployment","documentation"]},
  software:{label:"برمجيات",outputs:["source_code","tests","release"]},
  automation:{label:"أتمتة وAPI",outputs:["workflow","api_integration","documentation"]},
  data:{label:"بيانات وتحليل",outputs:["dataset","analysis","report"]},
  media:{label:"صور وفيديو",outputs:["images","video","storyboard","final_package"]}
};
const TOOLS = {
  phone:{mode:"mobile_control",purpose:"استلام ومتابعة ومراجعة وتسليم"}, github:{mode:"connector",purpose:"source_control_and_delivery"}, vercel:{mode:"connector",purpose:"web_deployments"},
  codex:{mode:"connector_or_executor",purpose:"software_execution"}, design_tools:{mode:"external_tool",purpose:"design"}, document_tools:{mode:"external_tool",purpose:"documents_pdf"}, media_tools:{mode:"external_tool",purpose:"image_video"},
  automation_tools:{mode:"connector",purpose:"workflows_apis"}, data_tools:{mode:"runtime_or_external_tool",purpose:"analysis"}
};
const now=()=>new Date().toISOString();
const id=p=>`${p}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
const isFinanciallySensitive=text=>FINANCIAL.test(String(text||""));
function inferSkills(title="",description=""){
 const t=`${title} ${description}`.toLowerCase(),m=[];
 const tests=[["brand_identity",/براند|هوية|لوجو|شعار|branding|brand identity|logo/],["pdf_documents",/pdf|ملف|مستند|document|report/],["marketing_design",/تصميم|إعلان|اعلان|social|marketing|banner|منشور/],["content_writing",/كتابة|محتوى|مقال|script|article|copywriting|email/],["websites",/موقع|website|landing page|frontend|web/],["software",/برنامج|software|app|application|bug|backend|database|code/],["automation",/أتمتة|automation|n8n|api|webhook|workflow|ذكاء اصطناعي|ai/],["data",/بيانات|data|excel|sheet|تحليل|analysis|إدخال/],["media",/فيديو|video|صورة|image|reel|thumbnail|مونتاج/]];
 for(const [s,r] of tests)if(r.test(t))m.push(s);return m.length?[...new Set(m)]:["general_digital_work"];
}
function resolveService(input={}){return input.serviceId?getService(input.serviceId):null;}
function resolveSkills(input,service){if(service?.skills?.length)return [...service.skills];return input.skills?.length?[...input.skills]:inferSkills(input.title,input.description);}
function scoreOpportunity(input={}){
 const service=resolveService(input),skills=resolveSkills(input,service),known=skills.filter(s=>SKILLS[s]);
 const completeness=Math.max(0,Math.min(100,Number(input.requirementCompleteness??70))),budget=Math.max(0,Math.min(100,Number(input.budgetFit??60))),competition=Math.max(0,Math.min(100,Number(input.competition??50))),risk=Math.max(0,Math.min(100,Number(input.risk??20)));
 const skillFit=Math.max(0,known.length?90-(skills.length-known.length)*25:20),score=Math.round(skillFit*.35+completeness*.2+budget*.15+(100-competition)*.1+(100-risk)*.2);
 return {score,skillFit,requirementCompleteness:completeness,budgetFit:budget,competition,risk,skills,serviceId:input.serviceId||null,ready:score>=70&&known.length===skills.length};
}
function buildPlan(input={}){
 const service=resolveService(input),skills=resolveSkills(input,service),financial=Boolean(input.financial)||isFinanciallySensitive(`${input.title||""} ${input.description||""}`);
 const toolMap={brand_identity:"design_tools",marketing_design:"design_tools",pdf_documents:"document_tools",content_writing:"document_tools",media:"media_tools",automation:"automation_tools",data:"data_tools",websites:"github",software:"github"};
 const declared=service?.primaryTools?.length?service.primaryTools:["phone",...skills.map(s=>toolMap[s]).filter(Boolean)];
 const tools=[...new Set(declared)];
 return {id:id("plan"),title:String(input.title||service?.label||"Digital work"),description:String(input.description||""),serviceId:input.serviceId||null,serviceLabel:service?.label||null,skills,tools,alternatives:service?.alternatives||[],deliverables:service?.deliverables||skills.flatMap(s=>SKILLS[s]?.outputs||[]),stages:["intake","requirements","planning","execution","quality_check","deliverable_packaging","delivery","follow_up"],score:scoreOpportunity({...input,skills,serviceId:input.serviceId}),financial,humanApprovalRequired:financial,autonomous:!financial,mobileControl:true,createdAt:now()};
}
function createInitialState(){return {version:2,autonomy:{enabled:true,durable:true,mobileControl:true,financialApprovalRequired:true,lastCycleAt:null,nextCycleAt:null},tasks:[],opportunities:[],skills:SKILLS,tools:TOOLS,experience:[],audit:[]};}
function audit(state,event,details={}){state.audit.push({id:id("audit"),event,details,at:now()});if(state.audit.length>500)state.audit=state.audit.slice(-500);}
function createTask(state,input={}){const plan=buildPlan(input),task={id:id("exec"),title:plan.title,description:plan.description,clientRef:input.clientRef||null,source:input.source||"manual",serviceId:plan.serviceId,status:plan.financial?"approval_required":"queued",stage:"intake",plan,financial:plan.financial,humanApprovalRequired:plan.humanApprovalRequired,autoExecutable:plan.autonomous,createdAt:now(),updatedAt:now()};state.tasks.push(task);audit(state,"execution_task_created",{taskId:task.id,serviceId:task.serviceId,skills:plan.skills,deliverables:plan.deliverables,financial:task.financial});return task;}
function advanceSafeTask(state,task){if(task.financial||isFinanciallySensitive(`${task.title} ${task.description}`)){task.financial=true;task.humanApprovalRequired=true;task.autoExecutable=false;task.status="approval_required";task.updatedAt=now();audit(state,"financial_gate_blocked",{taskId:task.id});return {taskId:task.id,executed:false,reason:"financial_approval_required"};}if(!task.autoExecutable)return {taskId:task.id,executed:false,reason:"connector_or_human_step_required"};const seq=task.plan.stages,current=seq.indexOf(task.stage),next=seq[Math.min(current+1,seq.length-1)];task.stage=next;task.status=next==="follow_up"?"completed":"in_progress";task.updatedAt=now();if(task.status==="completed")state.experience.push({id:id("exp"),taskId:task.id,serviceId:task.serviceId||null,skills:task.plan.skills,result:"completed",recordedAt:now()});audit(state,"execution_stage_advanced",{taskId:task.id,serviceId:task.serviceId||null,stage:task.stage});return {taskId:task.id,executed:true,stage:task.stage,status:task.status};}
function runCycle(state){const results=[];for(const task of state.tasks)if(["queued","in_progress"].includes(task.status))results.push(advanceSafeTask(state,task));state.autonomy.lastCycleAt=now();state.autonomy.nextCycleAt=new Date(Date.now()+86400000).toISOString();audit(state,"autonomous_execution_cycle",{processed:results.length});return {results,autonomy:state.autonomy};}
function createStore(){const connectionString=process.env.DATABASE_URL||process.env.ZOZ_DATABASE_URL;let pool=null,memory=createInitialState();if(connectionString)pool=new Pool({connectionString,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:8000,ssl:process.env.PGSSLMODE==="disable"?false:{rejectUnauthorized:false}});async function init(){if(!pool)return false;await pool.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (id integer PRIMARY KEY,state jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`);const r=await pool.query(`SELECT state FROM ${TABLE} WHERE id=1`);if(r.rows[0]?.state)memory={...createInitialState(),...r.rows[0].state};else await save(memory);return true;}async function load(){if(!pool)return memory;const r=await pool.query(`SELECT state FROM ${TABLE} WHERE id=1`);if(r.rows[0]?.state)memory={...createInitialState(),...r.rows[0].state};return memory;}async function save(state){memory=state;if(!pool)return {durable:false};await pool.query(`INSERT INTO ${TABLE}(id,state,updated_at) VALUES(1,$1::jsonb,now()) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()`,[JSON.stringify(state)]);return {durable:true};}return {durable:Boolean(pool),init,load,save};}
module.exports={SKILLS,TOOLS,isFinanciallySensitive,inferSkills,scoreOpportunity,buildPlan,createInitialState,createTask,advanceSafeTask,runCycle,createStore};
