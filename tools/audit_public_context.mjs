// One differently scoped diagnostic; preserves the original failed causal followup.
import {readFile,writeFile} from "node:fs/promises";
const base="https://stockinsight-midea-research.eagercomet2.chatgpt.site";
const first=JSON.parse(await readFile("docs/auto-audit/public-llm.json","utf8")).cases[0].response;
const selected="E-MD-20260630-cash-coverage";
const payload={question:"围绕所选现金覆盖证据，解释计算口径，并列出仍待验证的问题。",context:{question:first.question,dimensions:first.plan.dimensions,selected_ids:[selected],history:first.history}};
const report={started_at:new Date().toISOString(),method:"One additional actual production request; a different question, not a replacement or retry of failed causal case",payload};
try{
 const response=await fetch(base+"/api/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,access_code:process.env.RESEARCH_ACCESS_CODE}),signal:AbortSignal.timeout(100000)});
 report.http_status=response.status;report.response_headers={"cf-ray":response.headers.get("cf-ray"),date:response.headers.get("date")};report.response=await response.json();
 const r=report.response;report.checks={http_200:response.status===200,real_llm:r.engine==="llm"&&r.model_state==="active",two_groq_responses:r.model_usage?.provider==="Groq"&&r.model_usage?.calls?.length===2&&r.model_usage.calls.every(c=>c.response_id&&c.usage.total_tokens>0),context_retained:r.selected_ids?.includes(selected)&&r.history?.length===2,selected_cited:r.analysis?.claims?.some(c=>c.evidence_ids.includes(selected))};
 report.status=Object.values(report.checks).every(Boolean)?"PASS":"FAIL";
}catch(error){report.status="FAIL";report.error=error.message;}
report.finished_at=new Date().toISOString();let text=JSON.stringify(report,null,2);for(const value of [process.env.LLM_API_KEY,process.env.RESEARCH_ACCESS_CODE].filter(Boolean))text=text.replaceAll(value,"[REDACTED]");await writeFile("docs/auto-audit/public-context-diagnostic.json",text+"\n");console.log(JSON.stringify({status:report.status,checks:report.checks,warnings:report.response?.warnings}));
