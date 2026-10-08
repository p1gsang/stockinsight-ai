import test from "node:test";
import assert from "node:assert/strict";
import {research} from "../lib/research/service.mjs";
import {inResearchScope,isRestricted} from "../lib/research/planner.mjs";
import {retryAfterSeconds} from "../lib/research/retry-after.mjs";
import {validateAnalysis} from "../lib/research/llm.mjs";
import {validQuestions,outsideQuestions,restrictedQuestions,uiQuestions} from "./fixtures/question-routing.mjs";
for(const question of validQuestions)test(`selected-company question: ${question}`,async()=>{
  assert.equal(inResearchScope(question),true);assert.equal(isRestricted(question),false);
  const r=await research({question},{});assert.equal(r.status,"ok");assert.equal(r.engine,"rules");
  assert.ok(r.financials.every(row=>row.company_code==="000333.SZ"));
});
for(const question of outsideQuestions)test(`unavailable research subject: ${question}`,async()=>{
  let calls=0;const result=await research({question},{LLM_API_KEY:"TEST_ONLY",LLM_MODEL:"TEST_ONLY"},{fetcher:async()=>{calls++;throw new Error("No external request allowed");}});
  assert.equal(result.status,"out_of_scope");assert.equal(calls,0);
});
for(const question of restrictedQuestions)test(`restricted question: ${question}`,async()=>assert.equal((await research({question},{})).status,"restricted"));
test("every shared UI shortcut is covered",()=>assert.equal(uiQuestions.length,12));
test("financial followup keeps selected evidence and history",async()=>{
  const first=await research({question:"利润增长是否得到了现金流支持？"},{});
  const selected=first.evidence.find(e=>e.evidence_id.endsWith("cash-coverage")).evidence_id;
  const next=await research({question:"管理层对利润增速与现金流增速差异有何说明",context:{question:first.question,dimensions:first.plan.dimensions,selected_ids:[selected],history:first.history}},{});
  assert.equal(next.status,"ok");assert.deepEqual(next.selected_ids,[selected]);assert.equal(next.history.length,2);
  assert.ok(next.analysis.claims.some(c=>c.claim_type==="UNKNOWN"));
});
test("Retry-After countdown handles seconds, dates and malformed values",()=>{
  const now=Date.parse("2026-10-08T23:00:00Z");
  assert.equal(retryAfterSeconds("45",now),45);assert.equal(retryAfterSeconds("Thu, 08 Oct 2026 23:01:00 GMT",now),60);
  assert.equal(retryAfterSeconds(null,now),60);assert.equal(retryAfterSeconds("invalid",now),60);
  assert.equal(retryAfterSeconds("9999999",now),86400);assert.equal(retryAfterSeconds("0",now),1);
});
test("unsupported generated followups are replaced transparently while valid claims remain",async()=>{
  const r=await research({question:"利润现金流"},{}),e=r.evidence.find(e=>e.evidence_id.endsWith("cash-coverage"));
  const analysis=validateAnalysis({claims:[{text:"现金覆盖代理需结合股东口径理解。",claim_type:"INFERENCE",evidence_ids:[e.evidence_id]}],followups:["宁德时代利润如何？"]},r.evidence);
  assert.equal(analysis.followup_validation.removed_count,1);assert.equal(analysis.followup_validation.source,"server_scope_guard");
  assert.ok(analysis.followups.every(inResearchScope));assert.equal(analysis.claims.length,1);
});
