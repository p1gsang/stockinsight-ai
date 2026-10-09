// Real provider diagnostic. Never writes credentials or failed_generation.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {modelAnalyze} from '../lib/research/llm.mjs';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const sample=JSON.parse(readFileSync('docs/auto-audit/public-context-diagnostic.json','utf8'));
const events=[];
const safe=s=>[env.LLM_API_KEY,env.RESEARCH_ACCESS_CODE].filter(Boolean).reduce((v,k)=>v.replaceAll(k,'[REDACTED]'),s);
const fetcher=async(url,init)=>{const res=await fetch(url,init);if(!res.ok){let body;try{body=await res.clone().json();}catch{/* no raw body */}events.push({http_status:res.status,request_id:res.headers.get('x-request-id'),code:body?.error?.code,type:body?.error?.type,message:safe(String(body?.error?.message??'')).slice(0,600)});}return res;};
let result;
try{const r=await modelAnalyze(env,sample.payload.question,sample.response.plan,sample.response.evidence,sample.payload.context,fetcher,c=>events.push(c));result={status:'PASS',claims:r.claims};}catch(e){result={status:'FAIL',error:e.message,claim_text:e.claim_text};}
const report={date:new Date().toISOString(),method:'Real Groq direct adapter diagnostic of the saved failing context, not public E2E and not Mock',events,...result};
mkdirSync('docs/repair-validation',{recursive:true});writeFileSync(`docs/repair-validation/provider-probe-${process.argv.includes('--after')?'after'+(process.argv[3]?'-'+process.argv[3].replace(/[^a-z-]/g,''):''):'before'}.json`,safe(JSON.stringify(report,null,2))+'\n');console.log(safe(JSON.stringify(report)));
