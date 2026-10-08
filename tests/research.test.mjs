import test from "node:test";
import assert from "node:assert/strict";
import {growth,ratio,marketStats,freshness,compareSources} from "../lib/research/metrics.mjs";
import {rulePlan,enrichPlan} from "../lib/research/planner.mjs";
import {buildEvidence,canonicalRecords} from "../lib/research/evidence.mjs";
import {publicSnapshot,fuyaoRequest,normalizeFinancials,loadLive} from "../lib/research/providers.mjs";
import {validateAnalysis,callJSON} from "../lib/research/llm.mjs";
import {research} from "../lib/research/service.mjs";
import {createResearchGate,createModelBudget,estimateModelTokens} from "../lib/research/limits.mjs";
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
const sample=()=>publicSnapshot();
const plan=()=>enrichPlan(rulePlan("利润增长是否得到现金流支持"));
const evidence=()=>buildEvidence(sample(),"2026-06-30",plan()).evidence;
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const env={LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"test",LLM_BASE_URL:"https://example.com/v1",RESEARCH_ACCESS_CODE:"TEST_ONLY"};

test("growth and ratios retain missing data and nonpositive denominator",()=>{near(growth(120,100),20);near(growth(80,100),-20);assert.equal(growth(1,0),null);assert.equal(growth(1,-2),null);assert.equal(growth(null,10),null);assert.equal(growth("10",5),null);assert.equal(ratio(null,1),null);assert.equal(ratio(1,0),null);near(ratio(2,4),.5);});
test("cash coverage and parent profitability use explicit proxy definitions",()=>{const es=evidence();near(es.find(e=>e.evidence_id.endsWith("cash-coverage")).raw_value,37552090/26446037);near(es.find(e=>e.evidence_id.endsWith("profit-margin")).raw_value,26446037/260042490*100);assert.match(es.find(e=>e.evidence_id.endsWith("cash-coverage")).calculation_method,/少数股东/);});
test("market return volatility and drawdown independently checked",()=>{const p=[100,120,90,108].map((close,i)=>({close,date:`2026-01-0${i+1}`}));const r=marketStats(p);near(r.return_pct,8);near(r.max_drawdown_pct,-25);const logs=[Math.log(1.2),Math.log(.75),Math.log(1.2)],m=logs.reduce((a,b)=>a+b)/3;near(r.volatility_pct,Math.sqrt(logs.reduce((a,b)=>a+(b-m)**2,0)/2)*Math.sqrt(252)*100);});
test("malformed price series cannot create normal statistics",()=>{for(const values of [[],[{date:"2026-01-01",close:0},{date:"2026-01-02",close:1},{date:"2026-01-03",close:2}],[1,2,3].map(close=>({date:"2026-01-01",close}))])assert.throws(()=>marketStats(values));});
test("freshness detects stale and future dates",()=>{const now=new Date("2026-10-08T12:00:00Z");assert.equal(freshness("2026-10-08",now),"CURRENT");assert.equal(freshness("2026-09-01",now),"STALE");assert.equal(freshness("bad",now),"INVALID_DATE");assert.equal(freshness("2027-01-01",now),"INVALID_DATE");});
test("different questions produce different manufacturing-aware plans",()=>{assert.deepEqual(plan().dimensions,["quality","trend"]);assert.deepEqual(rulePlan("目前估值与同行如何").dimensions,["valuation","industry"]);assert.deepEqual(rulePlan("历史波动率与最大回撤").dimensions,["market"]);assert.match(plan().company_type,/家电/);assert.ok(plan().metrics.includes("inventory"));});
test("primary snapshot observations have traceable financial fields",()=>{const data=sample(),es=evidence();assert.equal(data.sources.length,3);assert.equal(data.records.length,6);assert.equal(new Set(es.map(e=>e.evidence_id)).size,es.length);for(const e of es.filter(e=>e.claim_type==="FACT")){assert.ok(e.inputs.length);for(const i of e.inputs){assert.match(i.source_url,/^https:\/\//);assert.ok(i.source_field);assert.ok(i.report_period);assert.ok(i.retrieved_at);}}assert.equal(compareSources(data.records).length,0);});
test("same-half YoY is used; no invented missing prior-year result",()=>{const es=evidence();near(es.find(e=>e.evidence_id.endsWith("parent_profit-yoy")).raw_value,(26446037/26013690-1)*100);const old=buildEvidence(sample(),"2024-06-30",plan()).evidence;assert.equal(old.find(e=>e.evidence_id.endsWith("parent_profit-yoy")).claim_type,"UNKNOWN");});
test("raw facts, directional signals and unknowns are independent",()=>{const es=evidence();assert.equal(es.find(e=>e.evidence_id.endsWith("parent_profit")).claim_type,"FACT");assert.equal(es.find(e=>e.evidence_id.endsWith("parent_profit")).evidence_direction,"UNKNOWN");assert.ok(es.some(e=>e.evidence_direction==="POSITIVE"));assert.ok(es.some(e=>e.evidence_direction==="NEGATIVE"));assert.ok(es.some(e=>e.claim_type==="UNKNOWN"&&e.raw_value===null));});
test("economic signal tension is not a source conflict",()=>{const e=evidence().find(e=>e.conflict_kind==="SIGNAL_TENSION");assert.ok(e);assert.equal(e.claim_type,"INFERENCE");assert.equal(e.evidence_direction,"CONFLICTING");assert.notEqual(e.verification_status,"SOURCE_CONFLICT");});
test("source disagreement suppresses raw and derived conclusions",()=>{const data=sample(),r=structuredClone(data.records[0]);r.source_id="conflicting-test-source";r.values.parent_profit*=2;data.records.push(r);const es=buildEvidence(data,"2026-06-30",plan()).evidence;const e=es.find(e=>e.evidence_id.endsWith("parent_profit"));assert.equal(e.raw_value,null);assert.equal(e.verification_status,"SOURCE_CONFLICT");assert.equal(e.claim_type,"UNKNOWN");assert.equal(es.find(e=>e.evidence_id.endsWith("cash-coverage")).raw_value,null);assert.ok(!es.some(e=>e.conflict_kind==="SIGNAL_TENSION"));});
test("as-of visibility excludes disclosures from the future",()=>{assert.ok(canonicalRecords(sample(),"2026-01-01").every(r=>r.period!=="2026-06-30"));});
test("expired snapshot is visibly downgraded",()=>{const data=sample();data.sources.forEach(s=>s.retrieved_at="2020-01-01T00:00:00Z");assert.ok(buildEvidence(data,"2026-06-30",plan()).evidence.some(e=>e.verification_status==="STALE"));});
test("valid LLM placeholders bind numbers to cited evidence",()=>{const es=evidence(),e=es.find(e=>e.evidence_id.endsWith("cash-coverage"));const r=validateAnalysis({claims:[{text:`现金流覆盖代理为{{${e.evidence_id}}}，具体原因尚需附注核验。`,claim_type:"INFERENCE",evidence_ids:[e.evidence_id]}],followups:["需要哪些附注验证原因？"]},es);assert.match(r.claims[0].rendered_text,/1.42倍/);assert.equal(r.claims[0].verification_status,"REFERENCE_AND_NUMBER_CHECKED");});
test("invented IDs, raw digits, chinese percentages and FACT model output are blocked",()=>{const es=evidence(),id=es[0].evidence_id;for(const c of [{text:"数据改善。",claim_type:"INFERENCE",evidence_ids:["FAKE"]},{text:"利润增长99%。",claim_type:"INFERENCE",evidence_ids:[id]},{text:"利润增长百分之三。",claim_type:"INFERENCE",evidence_ids:[id]},{text:"建议买入。",claim_type:"INFERENCE",evidence_ids:[id]},{text:"经营改善。",claim_type:"FACT",evidence_ids:[id]}])assert.throws(()=>validateAnalysis({claims:[c],followups:["还有什么证据？"]},es));});
test("missing model key, API HTTP errors and invalid JSON are not successful analysis",async()=>{await assert.rejects(callJSON({},[],{},"t"));await assert.rejects(callJSON(env,[],{},"t",async()=>response({},401)),/HTTP 401/);await assert.rejects(callJSON(env,[],{},"t",async()=>response({choices:[{message:{content:"NOT JSON"}}]})),/不是有效 JSON/);});
test("financial provider rejects missing key, errors, empty and malformed data",async()=>{await assert.rejects(fuyaoRequest("x",{},""),/凭证/);await assert.rejects(fuyaoRequest("x",{},"test",async()=>response({code:2003,data:null})),/2003/);await assert.rejects(fuyaoRequest("x",{},"test",async()=>response({code:0,data:{item:[]}})),/记录/);await assert.rejects(fuyaoRequest("x",{},"test",async()=>{throw new Error("timeout");}),/超时/);await assert.rejects(fuyaoRequest("x",{},"test",async()=>response({},503)),/HTTP 503/);});
test("financial normalization rejects period, currency and type mismatch",()=>{const row={thscode:"000333.SZ",currency:"CNY",period_end_ms:Date.parse("2026-06-29T16:00:00Z"),report_date_ms:Date.parse("2026-08-28T16:00:00Z"),operating_income:100,parent_holder_net_profit:10};const cf={...row,act_cash_flow_net:20};const ids={income:"i",cash:"c"};assert.equal(normalizeFinancials([row],[cf],[],"000333.SZ",ids)[0].values.revenue,100);assert.throws(()=>normalizeFinancials([row],[{...cf,period_end_ms:0}],[],"000333.SZ",ids),/不一致/);assert.throws(()=>normalizeFinancials([{...row,operating_income:"100"}],[cf],[],"000333.SZ",ids),/类型错误/);assert.throws(()=>normalizeFinancials([{...row,currency:"USD"}],[cf],[],"000333.SZ",ids),/币种/);});
test("live mode cannot silently fall back to snapshot",async()=>{await assert.rejects(loadLive(plan(),{},"2026-06-30"),/凭证/);await assert.rejects(research({question:"利润现金流",mode:"live"},{}),/凭证/);});
test("core chain runs on real public facts with deterministic results",async()=>{const r=await research({question:"美的最近利润增长是否得到现金流支持？"});assert.equal(r.status,"ok");assert.equal(r.engine,"rules");assert.equal(r.model_state,"not_configured");assert.equal(r.trace.length,4);assert.equal(r.financials.length,3);for(const c of r.analysis.claims)assert.ok(c.evidence_ids.every(id=>r.evidence.some(e=>e.evidence_id===id)));});
test("two-stage mocked LLM main chain passes schema and evidence checks",async()=>{let calls=0;const id="E-MD-20260630-cash-coverage";const mock=async()=>response({choices:[{message:{content:JSON.stringify(++calls===1?{intent:"现金支持",dimensions:["quality","trend"],rationale:"家电企业重视现金回收。",questions:["原因是否有附注支持？"]}:{claims:[{text:`现金覆盖代理为{{${id}}}，持续性尚需核验。`,claim_type:"INFERENCE",evidence_ids:[id]}],followups:["现金回收是否稳定？"]})}}]});const r=await research({question:"利润现金流"},env,{fetcher:mock});assert.equal(calls,2);assert.equal(r.engine,"llm");assert.equal(r.plan.engine,"llm");assert.match(r.analysis.claims[0].rendered_text,/1.42倍/);});
test("invalid model plan is surfaced as explicit rule downgrade",async()=>{const r=await research({question:"利润现金流"},env,{fetcher:async()=>response({choices:[{message:{content:"broken"}}]})});assert.equal(r.engine,"rules");assert.equal(r.model_state,"failed");assert.match(r.warnings.join(),/规划失败/);});
test("followup preserves server evidence and bounded history; forged IDs rejected",async()=>{const r=await research({question:"利润现金流"}),id=r.evidence.find(e=>e.evidence_id.endsWith("cash-coverage")).evidence_id;const next=await research({question:"造成这种差异的原因是什么？",context:{question:r.question,dimensions:r.plan.dimensions,selected_ids:[id],history:r.history}});assert.ok(next.evidence.some(e=>e.evidence_id===id));assert.deepEqual(next.selected_ids,[id]);assert.equal(next.history.length,2);await assert.rejects(research({question:"为什么？",context:{selected_ids:["FAKE"]}}),/无效/);});
for(const q of ["现在该买入吗？","明天一定会涨吗？","保证收益百分之十","给出目标价","Should I buy this stock?"])test(`compliance: ${q}`,async()=>assert.equal((await research({question:q})).status,"restricted"));
test("outside-company questions cannot masquerade as Midea diagnosis",async()=>assert.equal((await research({question:"贵州茅台最近盈利如何？"})).status,"out_of_scope"));

test("Groq requests preserve strict schemas, bounded questions, and compatible token parameters",async()=>{
  const seen=[];await research({question:"现金覆盖代理的数值是多少？"},{...env,LLM_BASE_URL:"https://api.groq.com/openai/v1",LLM_MODEL:"openai/gpt-oss-20b"},{fetcher:async(url,init)=>{
    const body=JSON.parse(init.body);seen.push(body);assert.equal(url,"https://api.groq.com/openai/v1/chat/completions");
    return response({id:"TEST_ONLY",model:body.model,choices:[{finish_reason:"stop",message:{content:JSON.stringify(seen.length===1?{intent:"现金支持",dimensions:["quality","trend"],rationale:"制造企业需核验现金回收。",questions:[]}:{claims:[{text:"原因尚待核验。",claim_type:"UNKNOWN",evidence_ids:["E-MD-20260630-cause"]}],followups:["需要哪些附注？"]})}}]});
  }});assert.equal(seen.length,2);assert.equal(seen[0].response_format.json_schema.strict,true);assert.equal(seen[0].response_format.json_schema.schema.properties.questions.maxItems,4);assert.equal(seen[1].reasoning_effort,"medium");assert.equal(seen[1].max_completion_tokens,2000);assert.equal(seen[1].max_tokens,undefined);
  const variants=seen[1].response_format.json_schema.schema.properties.claims.items.anyOf;
  const claimSchema=variants.find(v=>v.properties.claim_type.enum[0]==="INFERENCE").properties;
  const unknownSchema=variants.find(v=>v.properties.claim_type.enum[0]==="UNKNOWN").properties;
  assert.equal(new RegExp(claimSchema.text.pattern).test("现金流对归母利润的覆盖代理为{{E-MD-20260630-cash-coverage}}。"),true);
  assert.equal(new RegExp(claimSchema.text.pattern).test("归母净利润同比为{{E-MD-20260630-cash-coverage}}。"),false);
  assert.equal(new RegExp(claimSchema.text.pattern).test("利润增长99%。"),false);
  assert.ok(!claimSchema.evidence_ids.items.enum.includes("E-MD-20260630-cause"));
  assert.ok(unknownSchema.evidence_ids.items.enum.includes("E-MD-20260630-cause"));
  assert.ok(!unknownSchema.evidence_ids.items.enum.includes("E-MD-20260630-cash-coverage"));
  assert.equal(new RegExp(unknownSchema.text.pattern).test("原因为{{E-MD-20260630-cause}}。"),false);
});
test("model truncation cannot count as successful JSON output",async()=>{
  await assert.rejects(callJSON(env,[],{},"t",async()=>response({choices:[{finish_reason:"length",message:{content:"{}"}}]})),/截断/);
});
test("provider 429 opens a cooldown and does not immediately retry",async()=>{
  let calls=0;const limited={...env,LLM_BASE_URL:"https://rate-limit-test.example/v1"};const fetcher=async()=>{calls++;return new Response("{}",{status:429,headers:{"retry-after":"45"}});};
  await assert.rejects(callJSON(limited,[],{},"t",fetcher),/45 秒/);await assert.rejects(callJSON(limited,[],{},"t",fetcher),/冷却/);assert.equal(calls,1);
});
test("server renderer handles repeated units and rejects mismatched ones",()=>{
  const es=evidence(),id="E-MD-20260630-cash-coverage",input=unit=>({claims:[{text:`覆盖代理为{{${id}}}${unit}，股东口径需核验。`,claim_type:"INFERENCE",evidence_ids:[id]}],followups:["原因是什么？"]});
  const r=validateAnalysis(input("倍"),es);assert.match(r.claims[0].rendered_text,/1.42倍，/);assert.match(r.claims[0].validation_note,/股东口径/);assert.throws(()=>validateAnalysis(input("元"),es),/单位/);
});
test("research gate enforces IP quotas, concurrency, and release after errors",()=>{
  let now=Date.parse("2026-10-08T10:00:00Z");const gate=createResearchGate({clock:()=>now,ipMinute:2,ipDay:3});
  const release=gate.acquire("a");assert.throws(()=>gate.acquire("b"),/正在处理/);release();release();gate.acquire("a")();assert.throws(()=>gate.acquire("a"),/频繁/);
  now+=61000;gate.acquire("a")();assert.throws(()=>gate.acquire("a"),/今日/);now+=86400000;gate.acquire("a")();
});
test("rotating IPs cannot reset global quotas or clear capacity protection",()=>{
  const gate=createResearchGate({globalMinute:2});gate.acquire("a")();gate.acquire("b")();assert.throws(()=>gate.acquire("c"),/频繁/);
  const small=createResearchGate({maxIPs:1});small.acquire("a")();assert.throws(()=>small.acquire("b"),/保护上限/);
});
test("model Token guard reserves before requests, settles actual usage, and expires windows",()=>{
  let now=Date.parse("2026-10-08T10:00:00Z");const budget=createModelBudget({clock:()=>now,minuteTokens:100,dailyTokens:150});
  const ticket=budget.reserve(80);assert.throws(()=>budget.reserve(30),/暂时不足/);ticket.settle(20);ticket.settle(0);budget.reserve(80).settle(70);assert.throws(()=>budget.reserve(70),/今日/);
  now+=61000;budget.reserve(50).settle(50);assert.throws(()=>budget.reserve(20),/今日/);
});
test("long CJK context is budgeted and oversized single requests are rejected",()=>{
  assert.ok(estimateModelTokens([{role:"user",content:"中文".repeat(100)}],900)>1200);
  assert.throws(()=>createModelBudget({minuteTokens:100}).reserve(101),/上下文/);
});
test("known ratios cannot promote unknown causes into a mixed inference",()=>{
  const es=evidence();assert.throws(()=>validateAnalysis({claims:[{text:"覆盖代理可能受未经验证的具体原因影响。",claim_type:"INFERENCE",evidence_ids:["E-MD-20260630-cash-coverage","E-MD-20260630-cause"]}],followups:["需核验哪些附注？"]},es),/混入未知/);
});
