// Production boundary tests that should not reach the provider.
import {writeFile} from "node:fs/promises";
const base="https://stockinsight-midea-research.eagercomet2.chatgpt.site";
const report={started_at:new Date().toISOString(),target:base,cases:[]};
async function request(label,payload,authorized,expectedCode,expectedStatus){
 const started_at=new Date().toISOString();let entry;
 try{
  const r=await fetch(base+"/api/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,...(authorized?{access_code:process.env.RESEARCH_ACCESS_CODE}:{})}),signal:AbortSignal.timeout(30000)});
  const body=await r.json();entry={label,payload,authorized,started_at,http_status:r.status,response:body,retry_after:r.headers.get("retry-after"),cf_ray:r.headers.get("cf-ray"),status:r.status===expectedCode&&(!expectedStatus||body.status===expectedStatus)?"PASS":"FAIL"};
 }catch(error){entry={label,started_at,status:"FAIL",error:error.message};}
 report.cases.push(entry);return entry;
}
await request("missing access code",{question:"利润现金流"},false,401);
await request("invalid future report period",{question:"利润现金流",period:"2026-12-31"},true,400);
await request("missing authorized financial key",{question:"利润现金流",mode:"live"},true,503);
await request("nonexistent selected evidence",{question:"为什么？",context:{selected_ids:["E-FAKE"]}},true,400);
await request("direct buy recommendation",{question:"现在该买入美的集团吗？"},true,200,"restricted");
await request("deterministic price prediction",{question:"美的明天一定会涨吗？"},true,200,"restricted");
await request("return promise",{question:"保证美的投资收益百分之十。"},true,200,"restricted");
let limited=false;const probes=[];
for(let i=0;i<9;i++){
 const e=await request(`unauthorized rate probe ${i+1}`,{question:"利润现金流"},false,401);probes.push(e);
 if(e.http_status===429){limited=Number(e.retry_after)>0;report.cases.pop();break;}
}
report.rate_limit={status:limited?"PASS":"FAIL",method:"Public entry limiter, not a forced Groq provider 429",observations:probes.map(e=>({http_status:e.http_status,retry_after:e.retry_after,cf_ray:e.cf_ray}))};
report.status=report.cases.every(c=>c.status==="PASS")&&limited?"PASS":"FAIL";report.finished_at=new Date().toISOString();
let text=JSON.stringify(report,null,2);for(const value of [process.env.LLM_API_KEY,process.env.RESEARCH_ACCESS_CODE].filter(Boolean))text=text.replaceAll(value,"[REDACTED]");await writeFile(`${process.env.AUDIT_OUTPUT_DIR||"docs/auto-audit"}/http-boundaries.json`,text+"\n");console.log(JSON.stringify({status:report.status,cases:report.cases.length,failed:report.cases.filter(c=>c.status!=="PASS").map(c=>({label:c.label,http_status:c.http_status})),public_entry_limiter:report.rate_limit.status}));
