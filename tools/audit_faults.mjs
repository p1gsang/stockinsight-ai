// Fault injection exercises the frozen implementation; not evidence of real provider calls.
import {writeFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {publicSnapshot,fuyaoRequest} from "../lib/research/providers.mjs";
import {buildEvidence} from "../lib/research/evidence.mjs";
import {enrichPlan,rulePlan} from "../lib/research/planner.mjs";
import {callJSON,validateAnalysis} from "../lib/research/llm.mjs";
import {research} from "../lib/research/service.mjs";
const cases=[];const period="2026-06-30",plan=enrichPlan(rulePlan("利润现金流行情估值与同行"));
const evidence=()=>buildEvidence(publicSnapshot(),period,plan).all_evidence;
const env={LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"TEST_ONLY",RESEARCH_ACCESS_CODE:"TEST_ONLY",LLM_BASE_URL:"https://api.groq.com/openai/v1"};
async function check(name,fn){try{const observed=await fn();cases.push({name,status:observed.ok?"PASS":"FAIL",method:"Offline fault injection / real implementation, TEST_ONLY credentials; no production modification",observed});}catch(e){cases.push({name,status:"FAIL",error:e.message});}}
async function rejected(fn){try{await fn();return {ok:false,observed:"accepted"};}catch(e){return {ok:true,observed:"rejected",code:e.code,message:e.message};}}
const claim=text=>({claims:[{text,claim_type:"INFERENCE",evidence_ids:["E-MD-20260630-cash-coverage"]}],followups:["还需要哪些附注？"]});
await check("missing revenue does not become zero or normal growth",()=>{const d=publicSnapshot();for(const r of d.records.filter(x=>x.period===period&&x.company_code==="000333.SZ")){r.values.revenue=null;r.raw_values.revenue=null;}const es=buildEvidence(d,period,plan).all_evidence;const rows=es.filter(e=>["E-MD-20260630-revenue","E-MD-20260630-revenue-yoy","E-MD-20260630-profit-margin"].includes(e.evidence_id));return {ok:rows.length===3&&rows.every(e=>e.raw_value===null&&e.claim_type==="UNKNOWN"),rows};});
await check("financial API HTTP 503 fails explicitly",()=>rejected(()=>fuyaoRequest("a-share/financials/income-statements",{},"TEST_ONLY",async()=>new Response("{}",{status:503}))));
await check("financial API malformed JSON fails explicitly",()=>rejected(()=>fuyaoRequest("a-share/financials/income-statements",{},"TEST_ONLY",async()=>new Response("not JSON"))));
await check("financial API empty data fails explicitly",()=>rejected(()=>fuyaoRequest("a-share/financials/income-statements",{},"TEST_ONLY",async()=>Response.json({code:0,data:{item:[]}}))));
await check("model malformed completion JSON rejected",()=>rejected(()=>callJSON(env,[],{},"evidence_analysis",async()=>Response.json({choices:[{finish_reason:"stop",message:{content:"NOT JSON"}}]}))));
await check("model truncated output rejected",()=>rejected(()=>callJSON(env,[],{},"evidence_analysis",async()=>Response.json({choices:[{finish_reason:"length",message:{content:"{}"}}]}))));
await check("nonexistent model Evidence ID rejected",()=>rejected(()=>validateAnalysis({claims:[{text:"现有资料需要进一步核验。",claim_type:"INFERENCE",evidence_ids:["E-FAKE"]}],followups:["还需要哪些附注？"]},evidence())));
await check("nonexistent selected Evidence ID rejected before any provider request",async()=>{let calls=0;const r=await rejected(()=>research({question:"为什么？",context:{selected_ids:["E-FAKE"]}},env,{modelFetcher:async()=>{calls++;throw Error("Unexpected network");}}));return {...r,ok:r.ok&&calls===0,provider_calls:calls};});
for(const text of ["建议增持美的集团。","美的明天一定会涨。","保证收益百分之十。","美的下周肯定上涨。","美的必然获得正收益。"])
 await check(`prohibited model conclusion rejected: ${text}`,()=>rejected(()=>validateAnalysis(claim(text),evidence())));
await check("Groq 429 handled with cooldown",async()=>{let calls=0;const fake=async()=>{calls++;return new Response("{}",{status:429,headers:{"retry-after":"45"}});};const first=await rejected(()=>callJSON(env,[],{},"evidence_analysis",fake));const second=await rejected(()=>callJSON(env,[],{},"evidence_analysis",fake));return {ok:first.ok&&second.ok&&calls===1,first,second,provider_calls:calls};});
const report={checked_at:new Date().toISOString(),source_commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),working_tree_under_test:true,method:"Fault injection only; real Groq acceptance separately in public-llm.json",summary:Object.fromEntries(["PASS","FAIL","UNVERIFIED"].map(s=>[s,cases.filter(c=>c.status===s).length])),cases};
const folder=process.env.AUDIT_OUTPUT_DIR||"docs/auto-audit";
await mkdir(folder,{recursive:true});await writeFile(`${folder}/fault-injection.json`,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({summary:report.summary,failures:cases.filter(c=>c.status!=="PASS").map(c=>({name:c.name,observed:c.observed,error:c.error}))}));
