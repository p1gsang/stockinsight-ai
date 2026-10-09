import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildEvidence} from "../lib/research/evidence.mjs";
import {publicSnapshot} from "../lib/research/providers.mjs";
import {validateAnalysis} from "../lib/research/llm.mjs";
import {inResearchScope} from "../lib/research/planner.mjs";
import {researchFollowups} from "../lib/research/question-catalog.mjs";
import {research} from "../lib/research/service.mjs";
const period="2026-06-30",now=new Date("2026-10-08T23:00:00Z");
const plan={dimensions:["quality","trend","events","valuation","market","industry"]};
const es=()=>buildEvidence(publicSnapshot(),period,plan,now).all_evidence;
const id=s=>`E-MD-20260630-${s}`;
const check=(text,suffixes,type="INFERENCE",evidence=es())=>validateAnalysis({claims:[{text,claim_type:type,evidence_ids:suffixes.map(id)}],followups:["需要哪些附注？"]},evidence);
// Saved provider responses, rather than invented examples alone, define regressions.
const original=JSON.parse(readFileSync(new URL("../data/public_reports.json",import.meta.url),"utf8"));
const baseline=buildEvidence(original,period,plan,now).all_evidence;
const publicRun=JSON.parse(readFileSync(new URL("../docs/question-routing-llm-public.json",import.meta.url),"utf8"));
for(const c of [...publicRun.cases[1].claims,publicRun.cases[2].claims[1]])test(`blocks observed unsupported output: ${c.text}`,()=>{
  const raw={text:c.text,claim_type:c.claim_type,evidence_ids:c.evidence_ids};
  assert.throws(()=>validateAnalysis({claims:[raw],followups:["需要哪些附注？"]},baseline),/主题|无关|原因|少数股东|流动性|待验证/);
});
test("UNKNOWN cannot conceal a causal assertion even when the topic matches",()=>{
  assert.throws(()=>check("现金流差异由于应收变化导致。",["cause"],"UNKNOWN"),/确定性原因/);
  check("现有材料无法确认现金流差异的具体原因，需要补充业务层面证据。",["cause"],"UNKNOWN");
});
test("nonrecurring and working-capital evidence cannot substitute for one another",()=>{
  assert.throws(()=>check("非经常性损益持续影响尚不能确认。",["cause"],"UNKNOWN"),/主题/);
  check("非经常性损益持续影响尚不能确认。",["nonrecurring-cause"],"UNKNOWN");
  assert.throws(()=>check("应收项目影响尚不能确认。",["nonrecurring-cause"],"UNKNOWN"),/主题/);
  assert.throws(()=>check("毛利率需要核对。",["inventory"]),/主题/);
});
test("unrelated extra IDs cannot make a valid citation look stronger",()=>{
  assert.throws(()=>check("非经常性损益明细应核对。",["nonrecurring-parent","inventory"]),/无关/);
});
test("known report observations and unverified sustainability stay separate",()=>{
  check("归母与扣非归母差额与非经常性损益净额一致。",["profit-reconciliation"]);
  check("公司披露扣非利润变化主要归因于汇兑和衍生工具会计分类差异。",["event-fx"]);
  assert.throws(()=>check("扣非利润变化归因于汇兑损失。",["event-fx"]),/归属/);
  assert.throws(()=>check("非经常性损益持续影响尚待核验。",["nonrecurring-parent"],"UNKNOWN"),/待验证信息/);
});
test("positive cash ratio below unity does not establish amount coverage",()=>{
  const changed=es();changed.find(e=>e.evidence_id===id("cash-coverage")).raw_value=.3;
  assert.throws(()=>check("现金流能够覆盖利润。",["cash-coverage"],"INFERENCE",changed),/正覆盖值/);
  assert.throws(()=>check("现金覆盖代理为正，说明经营现金流能够覆盖归母利润。",["cash-coverage"]),/仅凭/);
});
test("cash growth evidence does not establish a liquidity condition",()=>{
  assert.throws(()=>check("增长不同步提示流动性潜在压力。",["growth-tension"]),/主题|流动性/);
  check("现有材料无法确认流动性与偿债压力。",["liquidity-cause"],"UNKNOWN");
});
test("supplementary sources preserve point-in-time basis and original PDF pages",()=>{
  const all=es(),receivable=all.find(e=>e.evidence_id===id("accounts_receivable"));
  assert.equal(receivable.claim_type,"FACT");assert.equal(receivable.raw_value,61954826000);
  assert.equal(receivable.period_basis,"POINT_IN_TIME");assert.equal(receivable.inputs[0].source_page,96);
  assert.equal(all.find(e=>e.evidence_id===id("nonrecurring-parent")).raw_value,6850858000);
  const bridge=all.find(e=>e.evidence_id===id("ocf-bridge"));
  assert.equal(bridge.raw_value,37552090000);assert.equal(bridge.inputs[0].normalized_value,26582874000);
  assert.ok(bridge.inputs.every(i=>i.source_page===177&&i.source_url.includes("szse.cn")));
});
test("verified followup banks route and remain relevant to the current topic",()=>{
  for(const [q,dimensions] of [["现金流",["quality"]],["归母与扣非差异",["quality","events"]],["事件风险",["events"]],["估值",["valuation"]],["行情",["market"]],["同行",["industry"]]]){
    const qs=researchFollowups(q,dimensions);assert.equal(qs.length,3);for(const candidate of qs)assert.equal(inResearchScope(candidate),true,candidate);
  }
  assert.ok(researchFollowups("归母与扣非差异").every(q=>/扣非|非经常/.test(q)));
});
test("a generic followup retains the prior nonrecurring topic and verified facts",async()=>{
  const question="还需要哪些材料才能验证原因？";
  let calls=0;
  const r=await research({question,context:{question:"归母与扣非利润表现为什么不同？",dimensions:["quality","events"],selected_ids:[id("profit-reconciliation")],history:[]}},
    {LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"TEST_ONLY",RESEARCH_ACCESS_CODE:"TEST_ONLY"},
    {fetcher:async(url,init)=>{
      const body=JSON.parse(init.body);calls++;
      if(calls===1)return Response.json({choices:[{message:{content:JSON.stringify({intent:"延续扣非研究",dimensions:["quality","events"],rationale:"核对持续影响。",questions:[]})}}]});
      const message=JSON.parse(body.messages[1].content);
      assert.ok(message.followup_candidates.every(q=>/扣非|非经常/.test(q)));
      assert.ok(message.evidence.some(e=>e.evidence_id===id("profit-reconciliation")));
      return Response.json({choices:[{message:{content:JSON.stringify({claims:[{text:"非经常性项目持续影响尚需后续资料验证。",claim_type:"UNKNOWN",evidence_ids:[id("nonrecurring-cause")]}],followups:[message.followup_candidates[0]]})}}]});
    }});
  assert.equal(r.engine,"llm");assert.equal(calls,2);assert.deepEqual(r.selected_ids,[id("profit-reconciliation")]);
});
