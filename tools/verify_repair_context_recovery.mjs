// One explicit recovery observation after the documented provider cooldown.
// Never overwrites the six failed formal scenarios or retries semantic failures.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='https://stockinsight-midea-research.eagercomet2.chatgpt.site';
const previous=JSON.parse(fs.readFileSync('docs/repair-validation/public-llm.json','utf8'));
const first=previous.cases[0].response,selected='E-MD-20260630-cash-coverage';
const payload={question:'围绕所选现金覆盖证据，解释计算口径，并列出仍待验证的问题。',context:{question:first.question,dimensions:first.plan.dimensions,selected_ids:[selected],history:first.history}};
const out={started_at:new Date().toISOString(),source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),target:base,method:'One actual production Groq recovery request after cooldown; no Mock, no retry; previous six formal FAIL results retained',payload,status:'UNVERIFIED'};
try{
 const r=await fetch(base+'/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,access_code:process.env.RESEARCH_ACCESS_CODE}),signal:AbortSignal.timeout(100000)});
 const raw=await r.text(),b=JSON.parse(raw);out.http_status=r.status;out.cf_ray=r.headers.get('cf-ray');out.response=b;
 out.checks={actual_complete_groq:r.status===200&&b.engine==='llm'&&b.model_state==='active'&&b.model_usage?.calls?.length>=2&&b.model_usage.calls.every(c=>c.provider==='Groq'&&c.response_id&&c.usage?.total_tokens>0),selected_retained:b.selected_ids?.includes(selected),selected_cited:b.analysis?.claims?.some(c=>c.evidence_ids.includes(selected)),history_retained:b.history?.length===Math.min(4,payload.context.history.length+1),secret_absent:[process.env.RESEARCH_ACCESS_CODE,process.env.LLM_API_KEY].filter(Boolean).every(v=>!raw.includes(v))};
 out.status=Object.values(out.checks).every(Boolean)?'PASS':'FAIL';out.semantic_status='UNVERIFIED';
}catch(e){out.status='FAIL';out.error=e.message;}
out.finished_at=new Date().toISOString();let saved=JSON.stringify(out,null,2);for(const v of [process.env.RESEARCH_ACCESS_CODE,process.env.LLM_API_KEY].filter(Boolean))saved=saved.replaceAll(v,'[REDACTED]');
fs.writeFileSync('docs/repair-validation/public-context-recovery.json',saved+'\n');console.log(JSON.stringify({status:out.status,http_status:out.http_status,checks:out.checks,warnings:out.response?.warnings,model:out.response?.model_usage}));
