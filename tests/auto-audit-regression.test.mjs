import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {researchEnvelope} from '../lib/research/access.mjs';
import {publicSnapshot} from '../lib/research/providers.mjs';
import {buildEvidence} from '../lib/research/evidence.mjs';
import {modelAnalyze,validateAnalysis,callJSON,compactModelContext} from '../lib/research/llm.mjs';
import {estimateModelTokens} from '../lib/research/limits.mjs';
import {isRestricted} from '../lib/research/planner.mjs';
import {research} from '../lib/research/service.mjs';
const plan={dimensions:['quality','trend','events','valuation','market','industry']};
const all=()=>buildEvidence(publicSnapshot(),'2026-06-30',plan).all_evidence;
const id=s=>'E-MD-20260630-'+s;
const claim=(text,ids=['cash-coverage'],type='INFERENCE')=>({claims:[{text,claim_type:type,evidence_ids:ids.map(id)}],followups:['还需要哪些附注？']});
const env={LLM_API_KEY:'TEST_ONLY',RESEARCH_ACCESS_CODE:'TEST_ONLY',LLM_MODEL:'openai/gpt-oss-120b',LLM_BASE_URL:'https://api.groq.com/openai/v1'};
test('access envelope removes the code before research; exact match and invalid types fail closed',()=>{
 const e=researchEnvelope({access_code:'TEST_ONLY',question:'经营质量如何？'},'TEST_ONLY');
 assert.equal(e.authorized,true);assert.deepEqual(e.input,{question:'经营质量如何？'});
 for(const v of [undefined,null,{},'TEST_ONLY_wrong','',Array(300).fill('a').join('')])assert.equal(researchEnvelope({access_code:v},'TEST_ONLY').authorized,false);
 assert.equal(researchEnvelope({access_code:''},'').authorized,false);
 assert.throws(()=>researchEnvelope(null,'TEST_ONLY'),SyntaxError);
 const route=readFileSync('app/api/research/route.ts','utf8'),ui=readFileSync('components/research-app.tsx','utf8');
 assert.ok(!route.includes('headers.get("x-research-access")'));assert.ok(!ui.includes('x-research-access'));assert.ok(ui.includes('access_code:access'));
});
for(const text of ['美的下周肯定上涨。','美的股价必将下跌。','美的下个月会涨。','美的保证获得正收益。','建议做多美的。','立即增持美的。','应该持有美的。','Midea will definitely rise.','Risk-free returns guaranteed.'])test('blocks prediction/advice variant: '+text,()=>{
 assert.equal(isRestricted(text),true);assert.throws(()=>validateAnalysis(claim(text),all()));
});
test('historical facts and research questions remain allowed',()=>{
 for(const s of ['美的历史股价波动如何？','利润增长是否得到现金流支持？','有哪些证据可以验证经营风险？'])assert.equal(isRestricted(s),false);
});
test('actual accepted AUD-S01 output is now rejected',()=>{
 const saved=JSON.parse(readFileSync('docs/auto-audit/public-llm.json','utf8')).cases.find(c=>c.label==='经营质量').response.analysis.claims;
 const c=saved.find(c=>c.text.includes('现金转化速度'));
 assert.ok(c);assert.throws(()=>validateAnalysis({claims:[{text:c.text,claim_type:c.claim_type,evidence_ids:c.evidence_ids}],followups:['还需要哪些附注？']},all()),/速度/);
});
test('undefined baseline is rejected while bounded proxy definition is accepted',()=>{
 assert.throws(()=>validateAnalysis(claim('现金覆盖水平高于基准。'),all()),/基准/);
 validateAnalysis(claim('现金覆盖代理需结合股东口径理解现金流与利润规模。'),all());
 validateAnalysis(claim('合并经营现金流与归母利润的股东口径不同，不能据此确认具体业务原因。'),all());
 validateAnalysis(claim('合并分子与归母分母导致股东口径差异。'),all());
 assert.throws(()=>validateAnalysis(claim('公司披露现金覆盖代理分子包含少数股东现金流。'),all()),/产品计算口径/);
 assert.throws(()=>validateAnalysis(claim('现金覆盖代理由于回款改善导致上升。'),all()),/原因|主题|速度/);
});
test('flat schema still rejects UNKNOWN/known ID mixing at the server',()=>{
 assert.throws(()=>validateAnalysis(claim('尚需核验。',['cash-coverage'],'UNKNOWN'),all()),/待验证/);
 assert.throws(()=>validateAnalysis(claim('现金流支持尚需核验。',['cause']),all()),/未知证据/);
});
test('all twelve selected evidence records survive the model evidence cap',async()=>{
 const evidence=all(),selected=evidence.slice(-12).map(e=>e.evidence_id);let body;
 await assert.rejects(modelAnalyze(env,'经营现金流与利润关系如何？',plan,evidence,{selected_ids:selected},async(url,init)=>{body=JSON.parse(JSON.parse(init.body).messages[1].content);throw Error('CAPTURE_ONLY_NO_NETWORK');}));
 assert.ok(selected.every(x=>body.evidence.some(e=>e.evidence_id===x)));assert.ok(body.evidence.length<=14&&body.evidence.length>=12);
});
test('full-report OCF disagreement blocks both primary and bridge; different basis does not conflict',()=>{
 const d=publicSnapshot();for(const f of d.supplement.facts.filter(f=>f.report_period==='2026-06-30'&&['bridge_ocf','bridge_other'].includes(f.field))){f.raw_value+=1000;f.normalized_value+=1000000;}
 const b=buildEvidence(d,'2026-06-30',plan);
 assert.ok(b.conflicts.some(c=>c.field==='ocf'));for(const suffix of ['ocf','ocf-bridge','cash-coverage','ocf-yoy'])assert.equal(b.all_evidence.find(e=>e.evidence_id===id(suffix)).claim_type,'UNKNOWN');
 const clean=buildEvidence(publicSnapshot(),'2026-06-30',plan);assert.equal(clean.conflicts.length,0);
});
test('SZSE source labels agree with the official source URL',()=>{
 const es=all().filter(e=>e.source_url?.includes('szse.cn/'));assert.ok(es.length);assert.ok(es.every(e=>e.source_name.includes('深圳证券交易所')));
});
test('provider errors expose safe code/type, not failed_generation or raw error text',async()=>{
 const seen=[];await assert.rejects(callJSON(env,[],{},'evidence_analysis',async()=>Response.json({error:{code:'json_validate_failed',type:'invalid_request_error',message:'TEST_ONLY',failed_generation:'TEST_ONLY'}},{status:400}),v=>seen.push(v)),/json_validate_failed/);
 assert.equal(seen[0].http_status,400);assert.equal(seen[0].error_code,'json_validate_failed');assert.ok(!JSON.stringify(seen).includes('TEST_ONLY'));
});
test('a bounded repair is a real extra adapter call, fully revalidated and reported',async()=>{
 let calls=0;
 const result=await modelAnalyze(env,'利润增长是否得到现金流支持？',{dimensions:['quality','trend']},all(),{},async(url,init)=>{
  calls++;const b=JSON.parse(init.body);assert.equal(b.response_format.json_schema.strict,true);
  if(calls===1){const raw=claim('现金覆盖水平高于基准。');raw.followups=[JSON.parse(b.messages[1].content).followup_candidates[0]];return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});}
  assert.equal(b.max_completion_tokens,1000);assert.equal(b.reasoning_effort,'low');
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({claim_0:{text:'现金覆盖代理需结合股东口径理解。',claim_type:'INFERENCE',evidence_ids:[id('cash-coverage')]}})}}]});
 });
 assert.equal(calls,2);assert.equal(result.generation_repair.attempts,1);assert.ok(result.generation_repair.discarded_text.includes('基准'));
});
test('failed repair remains rejected; prohibited advice never triggers a repair',async()=>{
 for(const [text,count] of [['现金覆盖水平高于基准。',2],['美的下周肯定上涨。',1]]){
  let calls=0;await assert.rejects(modelAnalyze(env,'经营质量如何？',{dimensions:['quality','trend']},all(),{},async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify(calls===1?claim(text):{claim_0:claim(text).claims[0]})}}]});}));assert.equal(calls,count);
 }
});
test('an LLM plan cannot omit the market data explicitly requested by the user',async()=>{
 let calls=0;const r=await research({question:'近期股价波动和回撤有多大？'},env,{fetcher:async(url,init)=>{
  calls++;if(calls===1)return Response.json({choices:[{message:{content:JSON.stringify({intent:'查看变化',dimensions:['quality','trend'],rationale:'核对当期资料。',questions:[]})}}]});
  const m=JSON.parse(JSON.parse(init.body).messages[1].content);assert.ok(m.evidence.some(e=>e.evidence_id===id('market-missing')));
  return Response.json({choices:[{message:{content:JSON.stringify({claims:[{text:'现有资料未覆盖行情，无法验证波动。',claim_type:'UNKNOWN',evidence_ids:[id('market-missing')]}],followups:[m.followup_candidates[0]]})}}]});
 }});assert.equal(r.engine,'llm');assert.ok(r.plan.dimensions.includes('market'));assert.deepEqual(r.plan.dimension_adjustments,{source:'explicit_question_guard',added:['market']});
});
test('multiple rejected claims are corrected in one bounded call, not a retry loop',async()=>{
 let calls=0;const r=await modelAnalyze(env,'利润与现金流如何？',{dimensions:['quality','trend']},all(),{},async(url,init)=>{
  calls++;const b=JSON.parse(init.body);
  if(calls===1){const raw=claim('现金覆盖水平高于基准。');raw.claims.push(claim('现金转化速度相对滞后。',['growth-tension']).claims[0]);raw.followups=[JSON.parse(b.messages[1].content).followup_candidates[0]];return Response.json({choices:[{message:{content:JSON.stringify(raw)}}]});}
  assert.deepEqual(b.response_format.json_schema.schema.required,['claim_0','claim_1']);
  return Response.json({choices:[{message:{content:JSON.stringify({claim_0:claim('现金覆盖代理需结合股东口径理解。').claims[0],claim_1:claim('利润与现金流增速不同步。',['growth-tension']).claims[0]})}}]});
});assert.equal(calls,2);assert.equal(r.generation_repair.discarded_texts.length,2);
});
test('v17 unsupported repaired prose remains blocked',()=>{
 for(const s of ['现金流对归母利润的覆盖比例偏高。','现金流未完全支持利润增长。'])assert.throws(()=>validateAnalysis(claim(s,s.includes('偏高')?['cash-coverage']:['growth-tension']),all()),/基准|金额及增速/);
 assert.throws(()=>validateAnalysis(claim('现金流调节中应收增加带来负向贡献。',['cause'],'UNKNOWN'),all()),/待验证信息/);
});
test('a mixed known/unknown claim is split by one bounded genuine repair call',async()=>{
 let calls=0;const r=await modelAnalyze(env,'目前估值与同行相比如何？',{dimensions:['valuation','industry']},all(),{},async(url,init)=>{
  calls++;const b=JSON.parse(init.body);
  if(calls===1){const raw=claim('同行收入已知但估值未知。',['peer-000651-revenue','valuation-missing']);raw.followups=[JSON.parse(b.messages[1].content).followup_candidates[0]];return Response.json({choices:[{message:{content:JSON.stringify(raw)}}]});}
  assert.deepEqual(b.response_format.json_schema.schema.required,['claim_0_known','claim_0_unknown']);
  return Response.json({choices:[{message:{content:JSON.stringify({claim_0_known:claim('可核对格力营业收入。',['peer-000651-revenue']).claims[0],claim_0_unknown:claim('现有资料未覆盖估值，无法比较。',['valuation-missing'],'UNKNOWN').claims[0]})}}]});
 });assert.equal(calls,2);assert.equal(r.claims.length,2);assert.deepEqual(r.claims.map(c=>c.claim_type),['INFERENCE','UNKNOWN']);
});
test('bounded context preserves selected IDs and stored history while trimming model-only summaries',()=>{
 const c={selected_ids:[id('cash-coverage')],history:Array.from({length:4},()=>({question:'问'.repeat(600),summary:'述'.repeat(1200)}))};
 const compact=compactModelContext(c);assert.deepEqual(compact.selected_ids,c.selected_ids);assert.equal(compact.history.length,2);assert.ok(compact.history.every(h=>h.summary.length===160));assert.equal(c.history.length,4);assert.equal(c.history[0].summary.length,1200);
});
test('ordinary contextual analysis plus one correction fits the existing conservative minute budget',async()=>{
 const requests=[];await modelAnalyze(env,'围绕所选现金覆盖证据，差异的可能原因是什么，还需要验证哪些附注？',{dimensions:['quality','trend']},all(),{selected_ids:[id('cash-coverage')],history:[{question:'利润增长是否得到支持？',summary:'说明'.repeat(600)}]},async(url,init)=>{
  const b=JSON.parse(init.body);requests.push(b);const raw=requests.length===1?claim('现金覆盖水平高于基准。'):{claim_0:claim('现金覆盖代理需结合股东口径理解。').claims[0]};
  if(requests.length===1)raw.followups=[JSON.parse(b.messages[1].content).followup_candidates[0]];
  return Response.json({choices:[{message:{content:JSON.stringify(raw)}}]});
 });
 const total=requests.reduce((s,b)=>s+estimateModelTokens(b.messages,b.max_completion_tokens),0);assert.ok(total+1000<7200,`estimated analysis+repair+planner=${total+1000}`);
});
test('unbound numeric draft is discarded and only a fully revalidated model rewrite can pass',async()=>{
 let calls=0;const r=await modelAnalyze(env,'经营质量如何？',{dimensions:['quality','trend']},all(),{},async(url,init)=>{
  calls++;const b=JSON.parse(init.body);
  const raw=calls===1?claim('现金覆盖仍低于一倍半。'):{claim_0:claim('现金覆盖代理需结合股东口径理解。').claims[0]};
  if(calls===1)raw.followups=[JSON.parse(b.messages[1].content).followup_candidates[0]];
  return Response.json({choices:[{message:{content:JSON.stringify(raw)}}]});
 });assert.equal(calls,2);assert.ok(r.generation_repair.discarded_text.includes('一倍半'));assert.ok(r.claims.every(c=>!c.text.includes('一倍半')));
});
