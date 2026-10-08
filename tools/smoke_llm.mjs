// Explicit live integration check. Requires real private credentials; never used by npm test.
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {research} from "../lib/research/service.mjs";
const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const base=arg("--base"),output=arg("--output")||".sites-runtime/verification/llm-local.json";
const key=process.env.LLM_API_KEY,access=process.env.RESEARCH_ACCESS_CODE;
assert.ok(key&&key!=="TEST_ONLY"&&access,"Real private model key and separate access code are required.");
const report={checked_at:new Date().toISOString(),target:base||"local service with real Groq network requests",cases:[],checks:[]};
const diagnosticFetch=args.includes("--capture")?async(url,init)=>{
  const r=await fetch(url,init);const text=(await r.clone().text()).replaceAll(key,"[REDACTED]");
  await mkdir(".sites-runtime/verification",{recursive:true});await writeFile(`.sites-runtime/verification/provider-${Date.now()}.json`,text);
  if(!r.ok)console.log(JSON.stringify({provider_http:r.status,error:JSON.parse(text).error}));return r;
}:undefined;
async function request(payload,authorized=true) {
  if(!base)return {code:200,body:await research(payload,process.env,diagnosticFetch?{fetcher:diagnosticFetch}:{})};
  const r=await fetch(new URL("/api/research",base),{method:"POST",headers:{"Content-Type":"application/json",...(authorized?{"x-research-access":access}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000)});
  const text=await r.text();assert.ok(!text.includes(key),"Provider key leaked in response.");return {code:r.status,body:JSON.parse(text),retryAfter:r.headers.get("retry-after")};
}
if(base) {
  const r=await fetch(new URL("/api/status",base));const status=await r.json();assert.equal(status.model_configured,true);assert.equal(status.model_provider,"Groq");assert.equal(status.access_protected,true);assert.equal(status.shared_rate_limit,true);assert.ok(!JSON.stringify(status).includes(key));report.checks.push("public status is configured with shared quota storage and without provider secrets");
  assert.equal((await request({question:"利润现金流"},false)).code,401);report.checks.push("unauthorized model access returns 401");
  assert.equal((await request({question:"利润现金流",period:"2026-12-31"})).code,400);report.checks.push("invalid period returns 400");
  assert.equal((await request({question:"利润现金流",mode:"live"})).code,503);report.checks.push("missing financial credentials returns 503");
  assert.equal((await request({question:"现在买入保证收益？"})).body.status,"restricted");report.checks.push("investment advice blocked before any model call");
  if(args.includes("--boundaries")){
    assert.equal((await request({question:"宁德时代的利润增长是否得到现金流支持？"})).body.status,"out_of_scope");report.checks.push("outside-company question is rejected without Midea facts");
    const invalid=await request({question:"为什么？",context:{selected_ids:["FAKE"]}});assert.equal(invalid.code,400);assert.equal(invalid.body.code,"INVALID_CONTEXT");report.checks.push("forged context receives HTTP 400");
  }
}
async function check(label,payload) {
  const {code,body:r}=await request(payload);assert.equal(code,200,JSON.stringify(r));assert.equal(r.engine,"llm",r.warnings?.join(" "));assert.equal(r.model_state,"active");assert.equal(r.plan.engine,"llm");
  assert.equal(r.model_usage.provider,"Groq");assert.equal(r.model_usage.calls.length,2);assert.equal(r.model_usage.planning,"validated");assert.equal(r.model_usage.interpretation,"validated");
  assert.ok(r.model_usage.calls.every(c=>c.response_id&&c.usage.total_tokens>0&&c.model===process.env.LLM_MODEL));
  for(const c of r.analysis.claims){assert.ok(c.evidence_ids.every(id=>r.evidence.some(e=>e.evidence_id===id)));assert.equal(c.verification_status,"REFERENCE_AND_NUMBER_CHECKED");}
  report.cases.push({label,question:r.question,dimensions:r.plan.dimensions,selected_ids:r.selected_ids,history_length:r.history.length,engine:r.engine,model_state:r.model_state,model_usage:r.model_usage,claims:r.analysis.claims,followups:r.analysis.followups});
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({case:label,result:"passed",provider:r.model_usage.provider,dimensions:r.plan.dimensions,tokens:r.model_usage.calls.reduce((n,c)=>n+c.usage.total_tokens,0)}));return r;
}
const first=await check("financial analysis and dimension planning",{question:"美的最近利润增长是否得到现金流支持？"});
assert.ok(first.plan.dimensions.includes("quality")&&first.plan.dimensions.includes("trend"));
const id=first.evidence.find(e=>e.evidence_id.endsWith("cash-coverage")).evidence_id;
console.log("Waiting for free-tier Token window before evidence followup.");await new Promise(resolve=>setTimeout(resolve,60000));await new Promise(resolve=>setTimeout(resolve,1000));
const follow=await check("followup with selected server evidence",{question:"围绕所选现金覆盖证据，差异的可能原因是什么，还需要验证哪些附注？",context:{question:first.question,dimensions:first.plan.dimensions,selected_ids:[id],history:first.history}});
assert.ok(follow.selected_ids.includes(id));assert.equal(follow.history.length,2);assert.ok(follow.analysis.claims.some(c=>c.claim_type==="UNKNOWN"));
if(args.includes("--valuation")) {
  console.log("Waiting for free-tier Token window before missing-data check.");await new Promise(resolve=>setTimeout(resolve,60000));await new Promise(resolve=>setTimeout(resolve,1000));
  const value=await check("valuation unknown without market data",{question:"美的目前估值与同行相比如何？"});assert.ok(value.plan.dimensions.includes("valuation"));assert.ok(value.analysis.claims.some(c=>c.claim_type==="UNKNOWN"));
}
if(args.includes("--numeric")) {
  console.log("Waiting for free-tier Token window before numeric binding check.");await new Promise(resolve=>setTimeout(resolve,60000));await new Promise(resolve=>setTimeout(resolve,1000));
  const numeric=await check("explicit numerical question binds metric title and server value",{question:"现金流对归母利润的覆盖代理是多少？"});
  assert.ok(numeric.analysis.claims.some(c=>c.rendered_text.includes("1.42倍")&&c.evidence_ids.includes("E-MD-20260630-cash-coverage")));
}
if(base) {
  let limited=false;for(let i=0;i<9;i++){const r=await request({question:"利润现金流"},false);if(r.code===429){assert.ok(Number(r.retryAfter)>0);limited=true;break;}assert.equal(r.code,401);}assert.ok(limited);report.checks.push("public shared request limiter returns 429 with Retry-After without consuming model quota");
  const html=await (await fetch(base)).text();assert.ok(!html.includes(key));report.checks.push("homepage does not contain provider key");
}
report.finished_at=new Date().toISOString();report.passed=true;await writeFile(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({passed:true,cases:report.cases.length,checks:report.checks.length,output}));
