// ZOZ Creative Engine v1 — provider-independent orchestration.
const fs = require("fs");
const path = require("path");
const { renderImage } = require("./native-image-adapter");
const costMeter = require("./cost-meter");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, ".zoz-renderer", "creative-engine");
function ensure(){fs.mkdirSync(DIR,{recursive:true});}
function saveManifest(type,input,result){ensure(); const id="creative-"+Date.now(); const file=path.join(DIR,id+".json"); fs.writeFileSync(file,JSON.stringify({id,type,createdAt:new Date().toISOString(),input,result},null,2)); return {id,file};}
function policy(){return {version:1,owner:"ZOZ AI",primary:"zoz-native-image-renderer",freeFallback:"explicit-only",paidProviders:"optional-only",costModel:"usage_based",gpuRateEgpPerHour:costMeter.config().gpuCostEgpPerHour,humanApprovalRequiredForFinance:true,video:"adapter-ready; GPU required for heavy generation"};}
function estimate(input={}){const minutes=Math.max(0,Number(input.durationMinutes||0)); return costMeter.estimateTotal({gpuDurationMs:minutes*60000,storageGb:Math.max(0,Number(input.storageGb||0)),storageDays:Math.max(0,Number(input.storageDays||0))});}
async function image(input){const result=await renderImage(input); return {...result, engine:"ZOZ Creative Engine v1", manifest:saveManifest("image",input,result)};}
async function execute(type,input={}){if(type==="image")return image(input); if(type==="video")return {ok:false,status:"waiting_for_renderer",reason:"zoz_native_video_renderer_not_attached",engine:"ZOZ Creative Engine v1",next:"Attach a GPU video adapter without changing the Core API."}; return {ok:false,status:"blocked",reason:"unsupported_creative_type"};}
module.exports={policy,image,estimate,execute};
