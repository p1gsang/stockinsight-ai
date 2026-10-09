// Read-only production audit. Actual Groq requests; no provider substitution or retry.
import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
const base="https://stockinsight-midea-research.eagercomet2.chatgpt.site";
const folder="docs/auto-audit";
const privateValues=[process.env.LLM_API_KEY,process.env.RESEARCH_ACCESS_CODE].filter(Boolean);
assert.ok(process.env.RESEARCH_ACCESS_CODE&&process.env.LLM_API_KEY!=="TEST_ONLY","Private configuration required");
const report={started_at:new Date().toISOString(),target:base,source_commit:"62141347a0a8e48d779ad9c3dad15463e38e22ac",method:"Actual production HTTP; no Mock; 65-second spacing; no automatic retries",cases:[],status:"UNVERIFIED"};
const safe=text=>privateValues.reduce((s,key)=>s.replaceAll(key,"[REDACTED]"),text);
async function save(){await mkdir(folder,{recursive:true});await writeFile(`${folder}/public-llm.json`,safe(JSON.stringify(report,null,2))+"\n");}
const pause=()=>new Promise(resolve=>setTimeout(resolve,65000));
async function run(label,payload,requiredDimensions=[]){
 const entry={label,payload,started_at:new Date().toISOString(),status:"UNVERIFIED",checks:[]};report.cases.push(entry);
 try{
  const response=await fetch(new URL("/api/research",base),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,access_code:process.env.RESEARCH_ACCESS_CODE}),signal:AbortSignal.timeout(100000)});
  entry.http_status=response.status;entry.request_headers={"content-type":"application/json"};entry.authorization_transport="HTTPS body, removed before research";entry.response_headers=Object.fromEntries([...response.headers].filter(([k])=>["cf-ray","date","retry-after","content-type","cache-control"].includes(k)));
  const text=await response.text();entry.response_secret_scan=privateValues.every(x=>!text.includes(x))?"PASS":"FAIL";
  const r=JSON.parse(text);entry.response=r;
  const check=(name,ok,detail)=>entry.checks.push({name,status:ok?"PASS":"FAIL",detail});
  check("HTTP 200",response.status===200,response.status);
  check("actual validated LLM",r.engine==="llm"&&r.model_state==="active"&&r.plan?.engine==="llm",{engine:r.engine,model_state:r.model_state,planning:r.plan?.engine,warnings:r.warnings});
  check("Groq two-stage response metadata",r.model_usage?.provider==="Groq"&&r.model_usage?.calls?.length===2&&r.model_usage.calls.every(c=>c.response_id&&c.usage?.total_tokens>0&&c.provider==="Groq"),r.model_usage);
  check("required dimensions",requiredDimensions.every(d=>r.plan?.dimensions?.includes(d)),r.plan?.dimensions);
  const byId=new Map((r.evidence??[]).map(e=>[e.evidence_id,e]));
  check("all conclusion references exist",!!r.analysis?.claims?.length&&r.analysis.claims.every(c=>c.evidence_ids.length&&c.evidence_ids.every(id=>byId.has(id))),r.analysis?.claims?.map(c=>c.evidence_ids));
  check("unknown conclusions cite unknown evidence",!!r.analysis&&r.analysis.claims.every(c=>c.claim_type!=="UNKNOWN"||c.evidence_ids.every(id=>byId.get(id)?.claim_type==="UNKNOWN")));
  check("selected context retained",(payload.context?.selected_ids??[]).every(id=>r.selected_ids?.includes(id))&&(!payload.context||r.history?.length===Math.min(4,payload.context.history.length+1)),r.selected_ids);
  if(requiredDimensions.includes("valuation")||requiredDimensions.includes("market"))check("missing authorized data is explicit",r.analysis?.claims?.some(c=>c.claim_type==="UNKNOWN")&&r.evidence.some(e=>e.claim_type==="UNKNOWN"&&/行情|估值/.test(e.title)),r.analysis?.claims);
  entry.semantic_status="UNVERIFIED";entry.semantic_note="Root independent audit reviews this exact response against original records and deterministic checks; model success alone is not semantic proof.";
  entry.status=entry.checks.every(c=>c.status==="PASS")&&entry.response_secret_scan==="PASS"?"PASS":"FAIL";
 }catch(error){entry.status="FAIL";entry.error=safe(String(error.message));}
 entry.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({label,status:entry.status,http_status:entry.http_status,engine:entry.response?.engine,dimensions:entry.response?.plan?.dimensions}));return entry.response;
}
try{
 const statusResponse=await fetch(new URL("/api/status",base));report.public_status={http_status:statusResponse.status,body:await statusResponse.json()};await save();
 const first=await run("利润与现金流",{question:"利润增长是否得到了现金流支持？"},["quality","trend"]);
 await pause();await run("经营质量",{question:"最近经营质量有没有改善？"},["quality"]);
 await pause();await run("估值缺失",{question:"目前估值与同行相比如何？"},["valuation"]);
 await pause();await run("行情缺失",{question:"近期股价波动和回撤有多大？"},["market"]);
 await pause();await run("所选证据上下文追问",{question:"围绕所选现金覆盖证据，差异的可能原因是什么，还需要验证哪些附注？",context:{question:first?.question??"利润增长是否得到了现金流支持？",dimensions:first?.plan?.dimensions??["quality","trend"],selected_ids:["E-MD-20260630-cash-coverage"],history:first?.history??[]}});
 report.status=report.cases.every(c=>c.status==="PASS")?"PASS":"FAIL";
}catch(error){report.status="FAIL";report.error=safe(String(error.message));}
report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({overall:report.status,cases:report.cases.length,output:`${folder}/public-llm.json`}));
