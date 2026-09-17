const { createStore, runCycle } = require("../execution-engine");
const { dispatchExecutableTasks } = require("../execution-renderer-bridge");
const store = createStore();

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.EXECUTION_API_SECRET;
  if (!secret) return true;
  const header = String(req.headers.authorization || "");
  return header === `Bearer ${secret}`;
}

module.exports = async (req,res) => {
  res.setHeader("Cache-Control","no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
  if (!authorized(req)) return res.status(401).json({ok:false,error:"unauthorized"});
  try {
    await store.init();
    const state=await store.load();
    const result=runCycle(state);
    const rendererResults=await dispatchExecutableTasks(state);
    const persisted=await store.save(state);
    return res.status(200).json({ok:true,service:"ZOZ AI Digital Business Execution",durable:store.durable,persisted,rendererResults,...result});
  } catch(error) { return res.status(500).json({ok:false,error:"execution_cycle_error",message:error.message}); }
};
