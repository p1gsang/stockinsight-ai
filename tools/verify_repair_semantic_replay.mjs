// Regression of exact previously accepted or rejected real provider text.
// This proves bounded rejection behavior, not arbitrary financial prose correctness.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {publicSnapshot} from '../lib/research/providers.mjs';
import {buildEvidence} from '../lib/research/evidence.mjs';
import {validateAnalysis} from '../lib/research/llm.mjs';
const old=JSON.parse(readFileSync('docs/auto-audit/public-llm.json','utf8'));
const v17=JSON.parse(readFileSync('docs/repair-validation/public-llm-v17.json','utf8'));
const v18=JSON.parse(readFileSync('docs/repair-validation/public-llm-v18.json','utf8'));
const entries=[];
for(const [name,source,pattern] of [['AUD-S01',old,/现金转化速度/],['AUD-S02',old,/高于基准/],['V17_UNDEFINED_HIGH',v17,/比例偏高/],['V17_SUPPORT_AMOUNT',v17,/未完全得到/],['V17_UNKNOWN_DIRECTION',v17,/应收增加带来负向/]]){
 const c=source.cases.flatMap(c=>c.response?.analysis?.claims??[]).find(c=>pattern.test(c.text));
 if(!c)throw Error('Historical source claim missing: '+name);
 entries.push({id:name,original:{text:c.text,claim_type:c.claim_type,evidence_ids:c.evidence_ids}});
}
const failure=v18.cases.flatMap(c=>c.response?.model_usage?.validation_failures??[]).find(c=>/一倍半/.test(c.claim_text??''));
if(!failure)throw Error('Historical numeric draft missing');
entries.push({id:'V18_UNBOUND_NUMBER',original:{text:failure.claim_text,claim_type:'INFERENCE',evidence_ids:['E-MD-20260630-cash-coverage']},note:'Already rejected in production; preserves rejection after enabling one genuine model rewrite.'});
const es=buildEvidence(publicSnapshot(),'2026-06-30',{dimensions:['quality','trend','valuation','market','industry','events']}).all_evidence;
for(const row of entries){try{validateAnalysis({claims:[structuredClone(row.original)],followups:['还需要哪些附注？']},es);row.status='FAIL';row.observed='accepted';}catch(e){row.status='PASS';row.observed='rejected';row.message=e.message;}}
const out={checked_at:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:'Replay exact historical real model text against current deterministic guard; not a new provider call or proof of all semantics',cases:entries,status:entries.every(e=>e.status==='PASS')?'PASS':'FAIL'};
writeFileSync((process.env.AUDIT_OUTPUT_DIR||'docs/repair-validation')+'/semantic-replay.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({status:out.status,cases:entries.length,failed:entries.filter(e=>e.status==='FAIL').map(e=>e.id)}));
