import test from "node:test";
import assert from "node:assert/strict";
import {research} from "../lib/research/service.mjs";
import {publicSnapshot,normalizeValuations,loadLive} from "../lib/research/providers.mjs";
import {buildEvidence} from "../lib/research/evidence.mjs";
import {marketStats,validCalendarDate} from "../lib/research/metrics.mjs";
import {isRestricted,inResearchScope,rulePlan,enrichPlan} from "../lib/research/planner.mjs";
import {validateAnalysis} from "../lib/research/llm.mjs";
const now=new Date("2026-10-08T12:00:00Z"),period="2026-06-30";
const evidence=()=>buildEvidence(publicSnapshot(),period,enrichPlan(rulePlan("利润现金流与同行行情估值")),now).all_evidence;
const id=suffix=>`E-MD-20260630-${suffix}`;
const claim=(text,ids=[id("cash-coverage")],type="INFERENCE")=>({claims:[{text,claim_type:type,evidence_ids:ids}],followups:["还需要哪些附注？"]});
test("trade-action synonyms and obfuscated text blocked at both request and model boundaries",async()=>{
  for(const text of ["建议建仓。","建议止损。","应当增持。","可以减持吗？","建 仓建议","建\u200b仓建议","Should I buy this stock?","I recommend holding this stock."]){
    assert.equal(isRestricted(text),true,text);
    assert.equal((await research({question:text})).status,"restricted",text);
    assert.throws(()=>validateAnalysis(claim(text),evidence()),/建议|承诺|确定性/,text);
  }
});
test("neutral event research does not become a trade instruction",()=>{
  for(const q of ["控股股东增持公告有哪些事实？","请分析股东减持公告的风险。","止损订单是什么机制？"])assert.equal(isRestricted(q),false,q);
});
test("unavailable company subjects and codes never inherit Midea facts",async()=>{
  for(const question of ["宁德时代的利润增长是否得到现金流支持？","比亚迪最近利润如何？","新希望的营收如何？","600519 的经营如何？","美的与宁德时代的利润相比如何？","格力电器利润如何？"]){
    let calls=0;const r=await research({question},{LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"TEST_ONLY",RESEARCH_ACCESS_CODE:"TEST_ONLY"},{fetcher:async()=>{calls++;throw new Error("TEST_ONLY must not run");}});
    assert.equal(r.status,"out_of_scope",question);assert.equal(calls,0);
  }
});
test("UI presets, supported peers and evidence followups keep selected company context",()=>{
  for(const q of ["归母净利润同比是多少？","扣非归母净利润为何下降？","美的最新营业收入是多少？","什么是市盈率？","加权平均 ROE 如何计算？","解释指标口径","该公司经营情况如何？"])assert.equal(inResearchScope(q),true,q);
  for(const q of ["利润增长是否得到了现金流支持？","最近经营质量有没有改善？","目前估值与同行相比如何？","近期股价波动和回撤有多大？","美的最近利润增长是否得到现金流支持？","围绕所选现金覆盖证据，差异的可能原因是什么，还需要验证哪些附注？","造成这种差异的原因是什么？","与格力同期相比有什么差异？","还需要哪些材料才能验证原因？","需要哪些附注？","为什么？","历史波动率与最大回撤","美的与海尔的利润对比"] )assert.equal(inResearchScope(q),true,q);
});
test("metric names bind to values: a cash ratio cannot masquerade as profit growth",()=>{
  assert.throws(()=>validateAnalysis(claim(`归母净利润同比高达{{${id("cash-coverage")}}}，增速显著提升。`),evidence()),/指标名称/);
  const r=validateAnalysis(claim(`现金流对归母利润的覆盖代理为{{${id("cash-coverage")}}}，股东口径不完全一致。`),evidence());
  assert.match(r.claims[0].rendered_text,/1.42倍/);
});
test("explicit growth comparisons and YoY signs cannot reverse cited relationships",()=>{
  const es=evidence(),tension=id("growth-tension"),profit=id("parent_profit-yoy"),cash=id("ocf-yoy");
  assert.throws(()=>validateAnalysis(claim("经营现金流增速高于利润增速，现金支撑更强。",[tension]),es),/增速比较/);
  assert.throws(()=>validateAnalysis(claim("利润同比下降。",[profit]),es),/同比方向/);
  assert.throws(()=>validateAnalysis(claim("现金流增速低于利润增速。",[id("cash-coverage")]),es),/缺少支持/);
  validateAnalysis(claim("利润增速快于现金流增速，原因尚待核验。",[profit,cash]),es);
  validateAnalysis(claim("不能仅据此判断现金流增速高于利润增速。",[tension]),es);
  assert.throws(()=>validateAnalysis(claim("利润增长的现金流支撑相对不足。",[tension]),es),/增速差不能证明/);
});
test("peer evidence ownership agrees with original company input",()=>{
  const peer=evidence().find(e=>e.evidence_id===id("peer-000651-parent_profit"));
  assert.equal(peer.company_code,"000651.SZ");assert.equal(peer.inputs[0].company_code,peer.company_code);assert.match(peer.title,/格力/);
});
test("missing local coverage cannot imply the company failed to disclose",()=>{
  const ids=[id("gross-margin")];
  assert.throws(()=>validateAnalysis(claim("公司未披露毛利率。",ids,"UNKNOWN"),evidence()),/当前资料未覆盖/);
  validateAnalysis(claim("现有资料未覆盖毛利率，需补充完整报告。",ids,"UNKNOWN"),evidence());
});
test("valuation scope rejects substituted and duplicate companies; labels come from code",()=>{
  const row={thscode:"000333.SZ",name:"错误名称",pe_ttm:15,pb_mrq:2};
  const rows=normalizeValuations([row],[row.thscode],"v","2026-10-08");assert.equal(rows[0].name,"美的集团");
  assert.throws(()=>normalizeValuations([{...row,thscode:"600519.SH"}],[row.thscode],"v","2026-10-08"),/未请求/);
  assert.throws(()=>normalizeValuations([row,row],[row.thscode],"v","2026-10-08"),/重复/);
});
test("wrong upstream valuation becomes an explicit unknown rather than a normal fact",async()=>{
  const ms=Date.parse("2026-06-29T16:00:00Z"),pub=Date.parse("2026-08-28T16:00:00Z");
  const fetcher=async url=>{
    const u=new URL(url),row={thscode:u.searchParams.get("thscode"),currency:"CNY",period_end_ms:ms,report_date_ms:pub,operating_income:100,parent_holder_net_profit:10,act_cash_flow_net:20};
    return Response.json({code:0,data:{timestamp:Date.now(),item:u.pathname.includes("valuations")?[{thscode:"600519.SH",pe_ttm:20,pb_mrq:4}]:[row]}});
  };
  const plan=enrichPlan(rulePlan("目前估值与同行如何")),data=await loadLive(plan,{FUYAO_API_KEY:"TEST_ONLY"},period,fetcher);
  assert.equal(data.valuations.length,0);assert.match(data.issues.join(),/未请求/);
  const missing=buildEvidence(data,period,plan).evidence.find(e=>e.evidence_id.endsWith("valuation-missing"));assert.equal(missing.claim_type,"UNKNOWN");assert.match(missing.note,/未请求/);
});
test("invalid calendar dates and future prices cannot produce statistics",()=>{
  for(const date of ["2026-13-01","2026-02-30","2026-04-31"])assert.equal(validCalendarDate(date),false);
  assert.equal(validCalendarDate("2024-02-29"),true);
  for(const dates of [["2026-13-01","2026-13-02","2026-13-03"],["2026-02-28","2026-02-30","2026-03-02"],["2027-01-01","2027-01-02","2027-01-03"]])assert.throws(()=>marketStats(dates.map(date=>({date,close:100})),now),/日期/);
});
test("quarterly-spaced prices cannot be annualized as daily returns",()=>{
  const data=publicSnapshot();data.prices=["2026-01-05","2026-04-07","2026-07-06"].map((date,i)=>({date,close:100+i}));
  assert.throws(()=>marketStats(data.prices,now),/过疏/);
  const e=buildEvidence(data,period,enrichPlan(rulePlan("行情")),now).evidence.find(e=>e.evidence_id.endsWith("market-missing"));assert.equal(e.claim_type,"UNKNOWN");assert.match(e.note,/过疏/);
});
test("future publications do not manufacture a present source conflict",()=>{
  const data=publicSnapshot(),future=structuredClone(data.records.find(r=>r.company_code==="000333.SZ"&&r.period===period));
  future.published_at="2027-01-01";future.source_id="TEST_ONLY_FUTURE";future.values.parent_profit*=2;data.records.push(future);
  const built=buildEvidence(data,period,enrichPlan(rulePlan("利润现金流")),now);
  assert.equal(built.conflicts.length,0);assert.equal(built.evidence.find(e=>e.evidence_id===id("parent_profit")).claim_type,"FACT");
});
test("forged or cross-period context rejects before a single model request",async()=>{
  for(const selected of ["FAKE","E-MD-20250630-cash-coverage"]){
    let calls=0;
    await assert.rejects(research({question:"为什么？",context:{selected_ids:[selected]}},{LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"TEST_ONLY",RESEARCH_ACCESS_CODE:"TEST_ONLY"},{fetcher:async()=>{calls++;throw new Error("TEST_ONLY");}}),e=>e.code==="INVALID_CONTEXT");
    assert.equal(calls,0);
  }
});
