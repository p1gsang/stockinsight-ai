// Independent, read-only audit. Product builders are the system under test;
// all numerical expectations and mappings below are implemented separately.
// Test-only fault injection is explicitly distinguished from live observations.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildEvidence} from '../lib/research/evidence.mjs';
import {deterministicSummary} from '../lib/research/service.mjs';
import {modelAnalyze} from '../lib/research/llm.mjs';
const now=new Date(), date=now.toISOString();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128*1024*1024}).trim();
const base=JSON.parse(readFileSync('data/public_reports.json','utf8'));
const supplement=JSON.parse(readFileSync('data/report_supplement.json','utf8'));
const dataset={...base,sources:[...base.sources,supplement.source],supplement};
const dimensions=['quality','trend','valuation','market','industry','events'];
const out={audit_date:date,timezone:'America/New_York',commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),scope:'Read-only product audit; only new audit artifacts written. No production mutation or deployment.',methodology:{numerics:'Independent arithmetic and source-row lookup; never imports metrics.mjs. Original-PDF validity is separately audited by the financial audit.',semantic:'Deterministic structural and bounded semantic checks. Free prose, causal truth, complete source universe, rights and business adequacy remain UNVERIFIED.',fault_injection:'Copies of data or a request-capture transport only; never claimed to be actual provider results.'},checks:[],evidence:[],summaries:[],issues:[],unverified:[]};
function record(id,status,method,evidence,extra={}){out.checks.push({id,status,method,evidence,...extra});}
function check(id,condition,method,evidence,extra={}){record(id,condition?'PASS':'FAIL',method,evidence,extra);}
const near=(a,b)=>a===b||(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-12));
const sourceById=Object.fromEntries(dataset.sources.map(s=>[s.id,s]));
// Explicit independent canonical selection, by latest published version.
const canonical=[];
for(const code of ['000333.SZ','000651.SZ'])for(const period of ['2024-06-30','2025-06-30','2026-06-30']){
 const candidates=dataset.records.filter(r=>r.company_code===code&&r.period===period&&r.published_at<=date.slice(0,10));
 if(candidates.length)canonical.push(candidates.sort((a,b)=>b.published_at.localeCompare(a.published_at))[0]);
}
function expected(e,period){
 const suffix=e.evidence_id.replace(/^E-MD-\d+-/,'');
 const current=canonical.find(r=>r.company_code==='000333.SZ'&&r.period===period);
 const previous=canonical.find(r=>r.company_code==='000333.SZ'&&r.period===`${Number(period.slice(0,4))-1}-06-30`);
 const num=(f,p=current)=>p?.values[f];
 const supp=f=>supplement.facts.find(x=>x.field===f&&x.report_period===period)?.normalized_value;
 const yoy=f=>previous?.values[f]>0&&Number.isFinite(num(f))?(num(f)-previous.values[f])/previous.values[f]*100:null;
 if(/^(revenue|parent_profit|adjusted_profit|ocf|roe)$/.test(suffix))return num(suffix)??null;
 if(/^(accounts_receivable|inventory|accounts_payable)$/.test(suffix))return supp(suffix)??null;
 if(/^(revenue|parent_profit|adjusted_profit|ocf)-yoy$/.test(suffix))return yoy(suffix.slice(0,-4));
 if(suffix==='cash-coverage')return num('parent_profit')>0?num('ocf')/num('parent_profit'):null;
 if(suffix==='profit-margin')return num('revenue')>0?100*num('parent_profit')/num('revenue'):null;
 if(suffix==='growth-tension')return yoy('parent_profit')-yoy('ocf');
 if(suffix==='nonrecurring-parent')return supp('nonrecurring_parent');
 if(suffix==='nonrecurring-financial')return supp('nonrecurring_financial');
 if(suffix==='profit-reconciliation')return num('parent_profit')-num('adjusted_profit');
 if(suffix==='ocf-bridge')return supplement.facts.filter(f=>f.report_period===period&&f.field.startsWith('bridge_')&&f.field!=='bridge_ocf').reduce((a,b)=>a+b.raw_value*1000,0);
 if(suffix.startsWith('bridge-'))return supp(suffix.replaceAll('-','_'));
 const peer=suffix.match(/^peer-(\d{6})-(revenue|parent_profit|roe)$/);
 if(peer)return canonical.find(r=>r.company_code===peer[1]+'.SZ'&&r.period===period)?.values[peer[2]]??null;
 if(suffix==='event-fx')return 1; // Product's documentary event marker, not a financial amount.
 if(e.claim_type==='UNKNOWN')return null;
 return undefined;
}
for(const period of ['2024-06-30','2025-06-30','2026-06-30']){
 const built=buildEvidence(structuredClone(dataset),period,{dimensions},now);
 const ids=new Set();
 for(const e of built.all_evidence){
  const issues=[],status=[];
  const test=(label,pass,detail)=>{status.push({check:label,status:pass?'PASS':'FAIL',...(detail?{detail}:{})});if(!pass)issues.push(label);};
  test('unique_period_scoped_id',!ids.has(e.evidence_id)&&e.evidence_id.startsWith('E-MD-'+period.replaceAll('-','')+'-'));
  ids.add(e.evidence_id);
  test('six_dimension_namespace',dimensions.includes(e.dimension));
  test('claim_type_enum',['FACT','INFERENCE','UNKNOWN'].includes(e.claim_type));
  test('direction_enum',['POSITIVE','NEGATIVE','CONFLICTING','UNKNOWN'].includes(e.evidence_direction));
  test('unknown_not_numeric',e.claim_type!=='UNKNOWN'||e.raw_value===null);
  test('known_has_source',e.claim_type==='UNKNOWN'||e.inputs.length>0);
  test('finite_financial_value',e.raw_value===null||Number.isFinite(e.raw_value));
  const exp=expected(e,period);
  test('independent_formula',exp!==undefined&&near(e.raw_value,exp),{expected:exp??null,product:e.raw_value});
  for(let n=0;n<e.inputs.length;n++){
   const i=e.inputs[n],s=sourceById[i.source_id];
   test('input_'+n+'_source',!!s&&i.source_url===s.url);
   test('input_'+n+'_page',Number.isInteger(i.source_page)&&i.source_page>0&&(s.pages?s.pages.includes(i.source_page):i.source_page===s.page));
   test('input_'+n+'_metadata',!!i.source_field&&!!i.source_column&&!!i.published_at&&!!i.retrieved_at&&['H1_YTD','POINT_IN_TIME'].includes(i.basis));
   test('input_'+n+'_published_before_audit',i.published_at<=date.slice(0,10));
   if(e.evidence_id.endsWith('event-fx'))continue;
   const full=supplement.facts.find(f=>f.source_id===i.source_id&&f.report_period===i.report_period&&f.source_field===i.source_field&&f.source_page===i.source_page);
   if(full)test('input_'+n+'_raw_mapping',i.raw_value===full.raw_value&&i.normalized_value===full.raw_value*1000&&i.raw_unit==='千元'&&i.basis===full.basis);
   else {
    const r=dataset.records.find(r=>r.source_id===i.source_id&&r.company_code===i.company_code&&r.period===i.report_period&&r.source_column===i.source_column);
    const field=i.normalized_field;
    test('input_'+n+'_raw_mapping',!!r&&r.raw_values[field]===i.raw_value&&near(i.normalized_value,i.raw_value*(field==='roe'?1:s.multiplier)));
   }
  }
  const suffix=e.evidence_id.replace(/^E-MD-\d+-/,'');
  if(suffix.endsWith('-yoy')&&e.raw_value!==null)test('growth_direction',e.evidence_direction===(e.raw_value>=0?'POSITIVE':'NEGATIVE'));
  if(suffix.startsWith('bridge-'))test('cash_bridge_direction',e.evidence_direction===(e.raw_value>=0?'POSITIVE':'NEGATIVE'));
  if(suffix==='growth-tension')test('signal_tension_not_source_conflict',e.claim_type==='INFERENCE'&&e.conflict_kind==='SIGNAL_TENSION'&&e.evidence_direction==='CONFLICTING'&&built.conflicts.length===0);
  if(['accounts_receivable','inventory','accounts_payable'].includes(suffix)&&e.raw_value!==null)test('stock_basis',e.period_basis==='POINT_IN_TIME');
  out.evidence.push({period,evidence_id:e.evidence_id,title:e.title,claim_type:e.claim_type,direction:e.evidence_direction,conflict_kind:e.conflict_kind,raw_value:e.raw_value,independent_value:exp??null,input_count:e.inputs.length,status:issues.length?'FAIL':'PASS',checks:status,semantic_status:'UNVERIFIED',semantic_reason:'Arithmetic, source mapping and bounded type invariants are checkable; all financial interpretations need bounded review.'});
 }
 check('evidence_inventory_'+period,built.evidence.length===built.all_evidence.length,'Six-dimension plan includes every available evidence object',{count:built.all_evidence.length,by_dimension:Object.fromEntries(dimensions.map(d=>[d,built.all_evidence.filter(e=>e.dimension===d).length]))});
 const summary=deterministicSummary(built.all_evidence,{},'美的利润增长是否得到现金流支持？',dimensions);
 check('summary_citations_'+period,summary.claims.every(c=>c.evidence_ids.length&&c.evidence_ids.every(id=>ids.has(id))),'Check every deterministic summary ID resolves in current-period evidence',summary.claims);
 check('summary_type_'+period,summary.claims.every(c=>['INFERENCE','UNKNOWN'].includes(c.claim_type)),'Rules prose is not relabeled objective financial fact',summary.claims.map(c=>c.claim_type));
 out.summaries.push({period,...summary,semantic_status:'UNVERIFIED',reason:'Structured and citation checks do not fully prove financial semantics.'});
}
const originalBuilt=buildEvidence(structuredClone(dataset),'2026-06-30',{dimensions},now);
const inconsistent=structuredClone(dataset),target=inconsistent.records.find(r=>r.period==='2026-06-30'&&r.company_code==='000333.SZ');
inconsistent.records.push({...structuredClone(target),source_id:'test-conflicting-copy',published_at:'2026-09-01',values:{...target.values,ocf:target.values.ocf+1000000},raw_values:{...target.raw_values,ocf:target.raw_values.ocf+1000}});
inconsistent.sources.push({...inconsistent.sources[0],id:'test-conflicting-copy'});
const conflictBuilt=buildEvidence(inconsistent,'2026-06-30',{dimensions},now);
check('source_conflict_core_records',conflictBuilt.conflicts.some(c=>c.field==='ocf')&&conflictBuilt.all_evidence.find(e=>e.evidence_id.endsWith('-ocf')).claim_type==='UNKNOWN'&&conflictBuilt.all_evidence.find(e=>e.evidence_id.endsWith('-ocf')).conflict_kind==='SOURCE_CONFLICT','Fault injection: duplicate same-company same-period same-basis OCF differs; require fail-closed',{fault_injection:true,conflicts:conflictBuilt.conflicts});
const fullMismatch=structuredClone(dataset);
for(const f of fullMismatch.supplement.facts.filter(f=>f.report_period==='2026-06-30'&&['bridge_ocf','bridge_other'].includes(f.field))){f.raw_value+=1000;f.normalized_value+=1000000;}
const mismatchBuilt=buildEvidence(fullMismatch,'2026-06-30',{dimensions},now);
const primary=mismatchBuilt.all_evidence.find(e=>e.evidence_id.endsWith('-ocf')),bridge=mismatchBuilt.all_evidence.find(e=>e.evidence_id.endsWith('-ocf-bridge'));
check('cross_source_primary_ocf_vs_full_bridge',mismatchBuilt.conflicts.length>0||primary.claim_type==='UNKNOWN'||bridge.claim_type==='UNKNOWN','Fault injection: full-report bridge remains arithmetically balanced but differs from summary OCF; require cross-source conflict block',{fault_injection:true,primary:{value:primary.raw_value,type:primary.claim_type},bridge:{value:bridge.raw_value,type:bridge.claim_type},conflicts:mismatchBuilt.conflicts});
if(primary.raw_value!==bridge.raw_value&&primary.claim_type==='FACT'&&bridge.claim_type==='FACT')out.issues.push({id:'AUD-E01',status:'FAIL',severity:'medium',location:'lib/research/evidence.mjs:21; 74-78',finding:'Cross-source duplicate OCF in supplementary full report and primary snapshot is not included in conflict comparison. Fault injection produced two contradictory FACT values.',observed_data_affected:false,remedy:'Proposed only: normalize supplementary comparable fields into the conflict registry and reject differing same-period/same-basis values; add regression.'});
const selected=originalBuilt.all_evidence.filter(e=>!['cash-coverage','growth-tension','parent_profit-yoy','ocf-yoy','ocf-bridge','cause','liquidity-cause'].some(s=>e.evidence_id.endsWith('-'+s))).slice(-12).map(e=>e.evidence_id);
let captured;
try{await modelAnalyze({LLM_API_KEY:'TEST_ONLY_CAPTURE',LLM_MODEL:'TEST_ONLY_CAPTURE',RESEARCH_ACCESS_CODE:'TEST_ONLY_CAPTURE',LLM_BASE_URL:'https://api.groq.com/openai/v1'},'经营现金流与利润关系如何？',{dimensions:['quality','trend']},originalBuilt.all_evidence,{selected_ids:selected,question:'经营现金流与利润关系如何？'},async(url,init)=>{captured=JSON.parse(JSON.parse(init.body).messages[1].content);throw new Error('AUDIT_CAPTURE_ONLY_NO_NETWORK');});}catch{}
const omitted=selected.filter(id=>!captured?.evidence.some(e=>e.evidence_id===id));
check('selected_evidence_survives_model_budget',!!captured&&omitted.length===0,'Offline request capture only: 12 valid selected IDs, no provider response or Mock AI result is used',{fault_injection:true,selected_count:selected.length,model_evidence_count:captured?.evidence.length??0,omitted_ids:omitted,context_ids_retained:captured?.context?.selected_ids?.length??0});
if(omitted.length)out.issues.push({id:'AUD-E02',status:'FAIL',severity:'medium',location:'lib/research/llm.mjs:98-99',finding:'The fourteen-evidence cap can omit explicitly selected evidence while the request context still lists those IDs.',omitted_ids:omitted,remedy:'Proposed only: reserve selected evidence first, then fill remaining budget with topic evidence; verify all selected IDs have corresponding model evidence.'});
const misnamed=originalBuilt.all_evidence.filter(e=>e.source_url?.includes('szse.cn')&&e.source_name.includes('巨潮'));
check('source_display_identity',misnamed.length===0,'Compare claimed source publisher label with original host; the URL/page mappings themselves are checked above',{mislabeled_count:misnamed.length,evidence_ids:misnamed.map(e=>e.evidence_id)});
if(misnamed.length)out.issues.push({id:'AUD-E03',status:'FAIL',severity:'low',location:'lib/research/evidence.mjs:33',finding:'Supplementary SZSE evidence retains a hardcoded 巨潮资讯 source_name; raw links correctly point to SZSE.',remedy:'Proposed only: label public reports generically or derive publisher from source metadata.'});
// Existing delivery files and explicit limitation declarations.
const docRules={
 'README.md':{startup:/npm ci/,environment:/LLM_API_KEY/,choice:/选择美的/,ai_role:/LLM.*程序/s,sources:/来源、授权/,boundaries:/未完成/},
 'AI_USAGE_AND_VALIDATION.md':{tools:/工具及职责/,participation:/AI 自动生成/,corrections:/实际发现和修正/,personal_review_pending:/候选人实际人工复核.*尚未/},
 'TEST_REPORT.md':{main_flow:/主链路/,missing_or_failure:/缺失|失败/,edge_or_compliance:/合规|边界/,real_vs_unit:/TEST_ONLY/}
};
for(const [file,rules]of Object.entries(docRules)){
 const text=existsSync(file)?readFileSync(file,'utf8'):'';
 for(const [name,re]of Object.entries(rules))check('doc_'+file+'_'+name,re.test(text),'Deterministic content presence; not a quality certification',{file,criterion:name});
}
const readme=readFileSync('README.md','utf8');
check('delivery_truthful_known_gaps',/行情、估值仍未接入/.test(readme)&&/iFinD 未授权/.test(readme)&&/候选人本人复核/.test(readme)&&/Gemini.*尚未实测/.test(readme),'Compare public completion claims to explicit boundaries',{readme:'README.md',scope:'No claim of completed live market/valuation, Gemini or personal review was found in current summary.'});
// Unaunthenticated network access and exact Git tree comparison.
async function get(url){try{const r=await fetch(url,{headers:{'User-Agent':'StockInsight-ReadOnly-Audit','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.text(),url};}catch(e){return {status:null,error:e.message,url};}}
const repoUrl='https://github.com/p1gsang/stockinsight-ai';
const responses=await Promise.all([
 get('https://api.github.com/repos/p1gsang/stockinsight-ai'),
 get('https://api.github.com/repos/p1gsang/stockinsight-ai/branches/main'),
 get(repoUrl),get('https://stockinsight-midea-research.eagercomet2.chatgpt.site/'),
 get('https://stockinsight-midea-research.eagercomet2.chatgpt.site/api/status')
]);
let remoteRepo,remoteBranch;try{remoteRepo=JSON.parse(responses[0].body);}catch{}try{remoteBranch=JSON.parse(responses[1].body);}catch{}
check('github_public_unauthenticated',responses[0].status===200&&remoteRepo?.private===false,'No credentials sent; public repository API GET (fresh mirror clone independently checked below)',{api_status:responses[0].status,html_status:responses[2].status,private:remoteRepo?.private});
record('github_html_access',responses[2].status===200?'PASS':responses[2].status===401||responses[2].status===403||responses[2].status===404?'FAIL':'UNVERIFIED','Independent unauthenticated HTML GET; transport/5xx failure does not prove private or missing repository',{http_status:responses[2].status,error:responses[2].error??null,url:repoUrl});
const remoteTree=remoteBranch?.commit?.commit?.tree?.sha;
if(remoteTree)check('github_current_tree_matches_audited_commit',remoteTree===out.tree,'Unauthenticated branch metadata vs local git HEAD tree',{remote_commit:remoteBranch.commit.sha,remote_tree:remoteTree,local_commit:out.commit,local_tree:out.tree});
else record('github_current_tree_matches_audited_commit','UNVERIFIED','GitHub branch metadata unavailable',{status:responses[1].status});
check('web_public_unauthenticated',responses[3].status===200&&responses[3].body.includes('StockInsight'),'Unauthenticated public GET',{url:responses[3].url,http_status:responses[3].status});
let safeStatus;try{safeStatus=JSON.parse(responses[4].body);}catch{}
check('safe_status_api',responses[4].status===200&&!!safeStatus&&!('LLM_API_KEY'in safeStatus)&&!('RESEARCH_ACCESS_CODE'in safeStatus),'Public configuration response contains status flags rather than credential values',{http_status:responses[4].status,returned_keys:safeStatus?Object.keys(safeStatus):[],model_configured:safeStatus?.model_configured});
// Full reachable Git blob history, built output and known current secrets.
const values=[];for(const envFile of ['.env.local','.dev.vars'])if(existsSync(envFile))for(const line of readFileSync(envFile,'utf8').split(/\r?\n/))if(/^(LLM_API_KEY|FUYAO_API_KEY|RESEARCH_ACCESS_CODE)=/.test(line)){const v=line.slice(line.indexOf('=')+1).trim().replace(/^['"]|['"]$/g,'');if(v.length>=12&&!values.includes(v))values.push(v);}
const objects=git('rev-list','--objects','--all').split(/\r?\n/).map(line=>{const space=line.indexOf(' ');return {sha:space<0?line:line.slice(0,space),path:space<0?null:line.slice(space+1)};});
const details=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:objects.map(o=>o.sha).join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024}).trim().split('\n');
const blobs=details.filter(l=>l.split(' ')[1]==='blob').map(l=>l.split(' ')[0]);
const batch=execFileSync('git',['cat-file','--batch'],{input:blobs.join('\n')+'\n',maxBuffer:128*1024*1024});
let offset=0;const secretMatches=[];
const patterns=[['groq',/gsk_[A-Za-z0-9_-]{30,}/],['openai_project',/sk-proj-[A-Za-z0-9_-]{30,}/],['google',/AIza[A-Za-z0-9_-]{30,}/],['github',/(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/]];
for(const sha of blobs){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString('utf8').split(' '),size=Number(header[2]),bytes=batch.subarray(end+1,end+1+size);offset=end+1+size+1;
 const kinds=patterns.filter(([,p])=>p.test(bytes.toString('utf8'))).map(([kind])=>kind);if(values.some(v=>bytes.includes(Buffer.from(v))))kinds.push('current_private_value');
 if(kinds.length)secretMatches.push({blob_sha:sha,path:objects.find(o=>o.sha===sha)?.path??null,match_kinds:kinds});
}
check('reachable_git_history_secret_scan',secretMatches.length===0,'All reachable blob history; compare private values in memory and provider-key patterns without printing matches',{commits:Number(git('rev-list','--all','--count')),unique_blobs:blobs.length,current_private_values_compared:values.length,matches:secretMatches});
const publicGit='.sites-runtime/audit-20261009/public-history.git';
if(existsSync(publicGit)){
 const publicExec=(args,options={})=>execFileSync('git',['--git-dir='+publicGit,...args],{maxBuffer:128*1024*1024,...options});
 const publicObjects=publicExec(['rev-list','--objects','--all'],{encoding:'utf8'}).trim().split(/\r?\n/).map(line=>{const split=line.indexOf(' ');return {sha:split<0?line:line.slice(0,split),path:split<0?null:line.slice(split+1)};});
 const publicTypes=publicExec(['cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],{input:publicObjects.map(o=>o.sha).join('\n')+'\n',encoding:'utf8'}).trim().split('\n');
 const publicBlobs=publicTypes.filter(l=>l.split(' ')[1]==='blob').map(l=>l.split(' ')[0]);
 const publicBatch=publicExec(['cat-file','--batch'],{input:publicBlobs.join('\n')+'\n'}),publicMatches=[];
 let position=0;
 for(const sha of publicBlobs){const end=publicBatch.indexOf(10,position),size=Number(publicBatch.subarray(position,end).toString('utf8').split(' ')[2]),bytes=publicBatch.subarray(end+1,end+1+size);position=end+1+size+1;
  const kinds=patterns.filter(([,p])=>p.test(bytes.toString('utf8'))).map(([kind])=>kind);if(values.some(v=>bytes.includes(Buffer.from(v))))kinds.push('current_private_value');
  if(kinds.length)publicMatches.push({blob_sha:sha,path:publicObjects.find(o=>o.sha===sha)?.path??null,match_kinds:kinds});
 }
 check('github_reachable_history_secret_scan',publicMatches.length===0,'Fresh unauthenticated mirror clone of public repository; scan every reachable blob against exact current secrets and provider patterns',{commits:Number(publicExec(['rev-list','--all','--count'],{encoding:'utf8'}).trim()),unique_blobs:publicBlobs.length,main_commit:publicExec(['rev-parse','refs/heads/main'],{encoding:'utf8'}).trim(),current_private_values_compared:values.length,matches:publicMatches});
}else record('github_reachable_history_secret_scan','UNVERIFIED','Public mirror clone absent',{instruction:'git clone --mirror https://github.com/p1gsang/stockinsight-ai.git .sites-runtime/audit-20261009/public-history.git'});
const forbidden=git('ls-files').split(/\r?\n/).filter(p=>/(?:^|\/)(?:\.env\.local|\.dev\.vars|[^/]*\.pdf|[^/]*私密[^/]*)$/i.test(p));
check('tracked_private_artifacts_absent',forbidden.length===0,'Tracked path inventory excludes private env, full PDFs and private handoff files',{matches:forbidden});
const scan=execFileSync(process.execPath,['tools/check_secrets.mjs'],{encoding:'utf8',maxBuffer:4*1024*1024});
let sourceScan;try{sourceScan=JSON.parse(scan.trim());}catch{sourceScan={unparsed:true};}
check('source_build_known_secret_scan',sourceScan.secret_check==='passed','Run existing source and compiled asset scanner, inspect actual result',sourceScan);
out.unverified.push(
 {id:'SEMANTIC_ALL_PROSE',status:'UNVERIFIED',reason:'Deterministic IDs, formulas and finite guards do not certify all financial prose or business causal truth.'},
 {id:'SOURCE_UNIVERSE_COMPLETENESS',status:'UNVERIFIED',reason:'Four source reports and a selected field set do not establish that all relevant filings, notes, events or risks are covered.'},
 {id:'DATA_DISPLAY_RIGHTS',status:'UNVERIFIED',reason:'Account holder must confirm data display and redistribution permissions; no granted Fuyao/iFinD credentials are present.'},
 {id:'FORMAL_SECURITY_AUDIT',status:'UNVERIFIED',reason:'Pattern and exact-current-secret scans cannot prove absence of every secret, compromised historical secret or external credential abuse.'}
);
if(existsSync('docs/auto-audit/public-llm.json')){
 const run=JSON.parse(readFileSync('docs/auto-audit/public-llm.json','utf8'));
 out.actual_public_semantic_review={reviewer:'Independent Codex audit agent; separate from product Groq model. AI review, never candidate personal review.',method:'Read exact saved actual responses. Compare claims with independently recalculated observed evidence; distinguish amount growth from temporal conversion speed. AI judgment remains fallible and is not a global correctness proof.',source:'docs/auto-audit/public-llm.json',cases:[],reviewed_at:new Date().toISOString()};
 for(const item of run.cases){
  const r=item.response??{},review={label:item.label,question:item.payload.question,actual_engine:r.engine,claims:[]};
  const expectedEvidence=Object.fromEntries(buildEvidence(structuredClone(dataset),r.period??'2026-06-30',{dimensions},now).all_evidence.map(e=>[e.evidence_id,e]));
  const mismatches=(r.evidence??[]).filter(e=>!expectedEvidence[e.evidence_id]||!near(e.raw_value,expectedEvidence[e.evidence_id].raw_value)||e.claim_type!==expectedEvidence[e.evidence_id].claim_type||e.period_basis!==expectedEvidence[e.evidence_id].period_basis).map(e=>e.evidence_id);
  check('public_evidence_mapping_'+item.label,mismatches.length===0&&!!r.evidence?.length,'Exact actual public evidence values/types/basis compared with separately audited snapshot',{count:r.evidence?.length??0,mismatches});
  for(const [index,c]of (r.analysis?.claims??[]).entries()){
   let status='UNVERIFIED',reason='No claim-specific independent semantic judgment has been recorded for this wording.';
   if(/现金转化速度相对滞后/.test(c.text)){status='FAIL';reason='Growth rates compare amounts across periods, not the timing/speed of receivables collection or cash conversion. The cited OCF growth and growth-gap inputs do not establish conversion speed. Hypothesis wording does not supply missing temporal evidence.';}
   else if(/现金覆盖水平高于基准/.test(c.text)){status='UNVERIFIED';reason='The ratio is above unity but the claimed benchmark is undefined and no benchmark evidence is cited. It may mean the unit threshold; that interpretation must be explicit before the comparative claim can be accepted.';}
   else if(/本期利润增长速度超过现金流增长速度/.test(c.text)){status='PASS';reason='Bounded comparison matches independent parent-profit and OCF YoY arithmetic; statement only describes differing growth, without business causation.';}
   else if(/归母净利润呈正向同比/.test(c.text)){status='PASS';reason='Independent same-H1 arithmetic gives positive parent-profit growth. This supports profit amount improvement, not a global operating-quality judgment.';}
   else if(/现金流调节显示存货减少提供正向贡献，应收增加带来负向影响，应付增加则提供正向缓冲/.test(c.text)){status='PASS';reason='The three original cash-flow bridge adjustments have respectively positive, negative and positive signs. This is a statement about accounting bridge contributions, not a proven procurement/collection business cause.';}
   else if(r.engine==='rules'&&/经营现金流对归母利润的覆盖代理为 1\.42倍/.test(c.text)&&near(expectedEvidence[c.evidence_ids[0]]?.raw_value,37552090000/26446037000)){status='PASS';reason='Clearly labeled rules fallback; independent OCF/parent-profit arithmetic rounds to 1.42. The shareholder-basis qualification is accurate. This is not a real LLM interpretation success.';}
   else if(r.engine==='rules'&&/利润同比增速高于经营现金流同比，差 0\.93个百分点/.test(c.text)){status='PASS';reason='Clearly labeled rules fallback; independently recomputed growth-gap rounds to 0.93 percentage points. The caution against inferring profit distortion is appropriately limited.';}
   else if(r.engine==='rules'&&/扣非归母净利润同比为 -25\.31%/.test(c.text)){status='PASS';reason='Clearly labeled rules fallback; independent adjusted-profit growth rounds to -25.31%, contrasting with positive parent-profit growth. Further checking of nonrecurring items is a research task, not a causal claim.';}
   else if(r.engine==='rules'&&/追问已保留所选证据/.test(c.text)&&r.selected_ids?.length===1&&r.selected_ids[0]==='E-MD-20260630-cash-coverage'){status='PASS';reason='The single requested evidence ID is retained in the actual response and evidence list. Cause remains UNKNOWN. This does not prove model interpretation success; the end-to-end context LLM test failed and transparently fell back.';}
   else if(c.claim_type==='UNKNOWN'&&/现有资料未覆盖|原因仍缺乏确认|原因仍待核实|具体业务原因仍缺乏确认/.test(c.text)){status='PASS';reason='The current input coverage is missing the cited market/valuation values or verified business attribution. Wording limits the assertion to current data availability rather than declaring non-disclosure or a causal fact.';}
   review.claims.push({index,text:c.text,evidence_ids:c.evidence_ids,status,reason,assessment_type:'independent_AI_judgment_with_source_constraints',not_a_deterministic_proof:true});
  }
  review.scope_note='PASS concerns only the narrow wording in this saved sample. Original-report validity belongs to the independent PDF audit; unobserved claims and future outputs remain UNVERIFIED.';
  out.actual_public_semantic_review.cases.push(review);
 }
 out.actual_public_semantic_review.result_counts=Object.fromEntries(['PASS','FAIL','UNVERIFIED'].map(s=>[s,out.actual_public_semantic_review.cases.flatMap(c=>c.claims).filter(c=>c.status===s).length]));
 if(existsSync('docs/auto-audit/public-context-diagnostic.json')){
  const diagnostic=JSON.parse(readFileSync('docs/auto-audit/public-context-diagnostic.json','utf8'));
  const fallback=out.actual_public_semantic_review.cases.find(c=>c.label==='所选证据上下文追问')?.claims.map(c=>c.text)??[];
  out.actual_public_semantic_review.additional_diagnostic={source:'docs/auto-audit/public-context-diagnostic.json',status:diagnostic.status,http_status:diagnostic.http_status,engine:diagnostic.response?.engine,provider_calls_recorded:diagnostic.response?.model_usage?.calls?.length??0,validation_failures:diagnostic.response?.model_usage?.validation_failures,selected_ids:diagnostic.response?.selected_ids,fallback_duplicates_reviewed_texts:(diagnostic.response?.analysis?.claims??[]).every(c=>fallback.includes(c.text)),semantic_counting:'Excluded from unique semantic samples; repeated rules fallback prose is not a new real-model interpretation success.'};
 }
 if(out.actual_public_semantic_review.cases.some(c=>c.claims.some(x=>x.status==='FAIL')))out.issues.push({id:'AUD-S01',status:'FAIL',severity:'medium',location:'docs/auto-audit/public-llm.json; case 经营质量, claim 2',finding:'One actual accepted model output describes cash-conversion speed from aggregate amount-growth evidence. This is unsupported by the cited fields.',assessment_type:'independent_AI_judgment',remedy:'Proposed only: describe slower OCF amount growth; prohibit timing/collection-speed conclusions without turnover or dated collection evidence. Add this actual output as a semantic regression.'});
}
const statuses=[...out.checks,...out.evidence,...out.unverified];
out.result_counts=Object.fromEntries(['PASS','FAIL','UNVERIFIED'].map(s=>[s,statuses.filter(x=>x.status===s).length]));
out.evidence_counts=Object.fromEntries(['PASS','FAIL'].map(s=>[s,out.evidence.filter(x=>x.status===s).length]));
mkdirSync('docs/auto-audit',{recursive:true});
writeFileSync('docs/auto-audit/evidence-delivery.json',JSON.stringify(out,null,2)+'\n');
const markdown=`# Evidence and delivery read-only audit\n\nExecuted ${date}; America/New_York; commit ${out.commit}.\n\nProgram: tools/audit_evidence_delivery.mjs. Independent arithmetic does not import metrics.mjs. Product builders and summaries are the system under test. Financial original-PDF audit is separate. No production edits or deployment.\n\nResults: ${JSON.stringify(out.result_counts)}. Evidence inventory: ${out.evidence.length}, ${JSON.stringify(out.evidence_counts)}.\n\n## Findings\n\n${out.issues.map(x=>`- **${x.id} / ${x.status} / ${x.severity}** — ${x.finding} (${x.location}) ${x.remedy}`).join('\n')}\n\n## Independent AI review of real public samples\n\n${out.actual_public_semantic_review?`${out.actual_public_semantic_review.cases.length} actual cases reviewed; narrow claim results ${JSON.stringify(out.actual_public_semantic_review.result_counts)}. This is separate AI judgment with source constraints, not deterministic proof or candidate review. All claim-specific reasons are recorded in JSON.`:'Not yet available; UNVERIFIED.'}\n\n## Unverified\n\n${out.unverified.map(x=>`- ${x.id}: ${x.reason}`).join('\n')}\n\nFault injections are offline regression probes, not real Groq observations or changes to actual data. Full results, IDs, independent/product values, raw mapping checks and network statuses: evidence-delivery.json. No matching secret content is included.\n`;
writeFileSync('docs/auto-audit/evidence-delivery.md',markdown);
console.log(JSON.stringify({commit:out.commit,evidence:out.evidence.length,result_counts:out.result_counts,issues:out.issues.map(i=>({id:i.id,status:i.status,severity:i.severity})),failed_checks:out.checks.filter(c=>c.status==='FAIL').map(c=>c.id)}));
