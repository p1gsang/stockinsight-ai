// Explicit real-provider verification. Never run as part of offline unit tests.
import assert from "node:assert/strict";
import {writeFile,mkdir} from "node:fs/promises";
import path from "node:path";
import {research} from "../lib/research/service.mjs";
import {inResearchScope} from "../lib/research/planner.mjs";
import {EVENT_QUESTION,dimensionQuestion} from "../lib/research/question-catalog.mjs";
const args=process.argv.slice(2),value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
const base=value("--base"),output=value("--output")||".sites-runtime/verification/routing-llm.json";
const env=process.env;assert.ok(env.LLM_API_KEY&&env.LLM_API_KEY!=="TEST_ONLY"&&env.RESEARCH_ACCESS_CODE,"Private real model configuration required");
const report={checked_at:new Date().toISOString(),target:base||"local service with real Groq requests",cases:[],passed:false};
async function save(){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+"\n");}
async function run(label,payload){
  let result,code=200;
  if(base){const response=await fetch(new URL("/api/research",base),{method:"POST",headers:{"Content-Type":"application/json","x-research-access":env.RESEARCH_ACCESS_CODE},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000)});code=response.status;result=await response.json();}
  else result=await research(payload,env);
  const entry={label,question:payload.question,http_status:code,status:result.status,engine:result.engine,model_state:result.model_state,dimensions:result.plan?.dimensions,model_usage:result.model_usage,selected_ids:result.selected_ids,history_length:result.history?.length,claims:result.analysis?.claims,followups:result.analysis?.followups,warnings:result.warnings,passed:false};
  assert.ok(!JSON.stringify(entry).includes(env.LLM_API_KEY));assert.ok(!JSON.stringify(entry).includes(env.RESEARCH_ACCESS_CODE));report.cases.push(entry);await save();
  assert.equal(code,200);assert.equal(result.status,"ok");assert.equal(result.engine,"llm",result.warnings?.join(" "));assert.equal(result.model_state,"active");assert.equal(result.plan.engine,"llm");
  assert.equal(result.model_usage.calls.length,2);assert.ok(result.model_usage.calls.every(c=>c.response_id&&c.usage.total_tokens>0));
  assert.ok(result.analysis.followups.every(inResearchScope));
  assert.ok(result.analysis.claims.every(c=>c.evidence_ids.every(id=>result.evidence.some(e=>e.evidence_id===id))));
  entry.passed=true;await save();console.log(JSON.stringify({label,result:"passed",tokens:result.model_usage.calls.reduce((n,c)=>n+c.usage.total_tokens,0)}));return result;
}
async function windowReset(){console.log("Waiting 65 seconds for the free-tier Token window; no automatic provider retry.");await new Promise(resolve=>setTimeout(resolve,65000));}
try {
  const first=await run("financial planning and interpretation",{question:"利润增长是否得到了现金流支持？"});
  if(!args.includes("--single")){
    await windowReset();
    const next=await run("previously rejected UI event followup",{question:EVENT_QUESTION,context:{question:first.question,dimensions:first.plan.dimensions,selected_ids:["E-MD-20260630-cash-coverage"],history:first.history}});
    assert.equal(next.history.length,2);assert.ok(next.selected_ids.includes("E-MD-20260630-cash-coverage"));assert.ok(next.analysis.claims.some(c=>c.claim_type==="UNKNOWN"));
    await windowReset();await run("previously rejected event dimension shortcut",{question:dimensionQuestion("events")});
  }
  report.passed=true;report.finished_at=new Date().toISOString();await save();console.log(JSON.stringify({passed:true,cases:report.cases.length,output}));
} catch(error){report.error=String(error.message).replaceAll(env.LLM_API_KEY,"[REDACTED]").replaceAll(env.RESEARCH_ACCESS_CODE,"[REDACTED]");await save();console.error(JSON.stringify({passed:false,error:report.error,output}));process.exitCode=1;}
