import { z } from "zod";
import { DEFAULT_FOLLOWUPS } from "./question-catalog.mjs";
import { rulePlan,enrichPlan,isRestricted,inResearchScope } from "./planner.mjs";
import { publicSnapshot,loadLive } from "./providers.mjs";
import { buildEvidence,canonicalRecords } from "./evidence.mjs";
import { modelPlan,modelAnalyze,modelReady,modelProvider } from "./llm.mjs";
export const requestSchema=z.object({question:z.string().trim().min(2).max(600),period:z.enum(["2026-06-30","2025-06-30","2024-06-30"]).default("2026-06-30"),mode:z.enum(["snapshot","live"]).default("snapshot"),
  context:z.object({question:z.string().max(600).optional(),dimensions:z.array(z.enum(["quality","trend","valuation","market","industry","events"])).max(6).default([]),selected_ids:z.array(z.string().max(90)).max(12).default([]),history:z.array(z.object({question:z.string().max(600),summary:z.string().max(1200)}).strict()).max(4).default([])}).strict().optional()}).strict();
export function deterministicSummary(evidence,context) {
  const find=(suffix)=>evidence.find(e=>e.evidence_id.endsWith(suffix));const claims=[];
  const add=(text,ids,kind="INFERENCE")=>claims.push({text,rendered_text:text,claim_type:kind,evidence_ids:ids,verification_status:"RULE_DERIVED",validation_note:"由明确规则连接已计算证据；并非语言模型生成。"});
  const cash=find("cash-coverage"),tension=find("growth-tension"),adjusted=find("adjusted_profit-yoy");
  if(cash?.raw_value!==null&&cash) add(`经营现金流对归母利润的覆盖代理为 ${cash.display_value}。这反映当期现金规模；分子、分母的少数股东口径并不完全一致。`,[cash.evidence_id]);
  if(tension) add(`利润同比增速高于经营现金流同比，差 ${tension.display_value}。覆盖水平与增速方向需同时观察，不能仅据此认定盈利失真。`,[tension.evidence_id]);
  if(adjusted?.raw_value<0) add(`扣非归母净利润同比为 ${adjusted.display_value}，与归母利润表现存在分化。应进一步核对非经常性损益和会计分类。`,[adjusted.evidence_id]);
  if(!claims.length) {
    const facts=evidence.filter(e=>e.claim_type==="FACT"&&e.raw_value!==null).slice(0,2);
    for(const e of facts)add(`${e.title}：${e.display_value}。当前证据仅支持相应时点与口径的描述，无法推出高低估或行业排名。`,[e.evidence_id]);
  }
  const unknown=find("cause")??evidence.find(e=>e.claim_type==="UNKNOWN");
  if(unknown)add(context?.selected_ids?.length?"追问已保留所选证据。现有资料不足以确认差异的具体原因，需要相关财务附注或同口径补充数据。":"尚缺少验证变化原因的完整证据；对未来的影响暂无法确认。",[unknown.evidence_id],"UNKNOWN");
  return {claims,followups:[...DEFAULT_FOLLOWUPS]};
}
export async function research(input,env={},options={}) {
  const req=requestSchema.parse(input);const started=Date.now();const warnings=[];
  if(isRestricted(req.question))return {status:"restricted",message:"本产品不提供直接买卖建议、确定性价格预测或收益保证。可以研究盈利质量、估值口径与风险证据。",question:req.question};
  if(!inResearchScope(req.question))return {status:"out_of_scope",message:"问题中的研究对象不在当前范围。请明确研究美的集团；格力、海尔仅作为同行比较对象。",question:req.question};
  const requested=req.context?.selected_ids??[];
  // IDs are a closed server namespace for the selected period. Reject before any paid/free model work.
  const allowedIDs=new Set(buildEvidence(publicSnapshot(),req.period,enrichPlan(rulePlan(req.question)),options.now??new Date()).all_evidence.map(e=>e.evidence_id));
  for(const code of ["000333","000651","600690"])for(const field of ["pe_ttm","pb_mrq"])allowedIDs.add(`E-MD-${req.period.replaceAll("-","")}-valuation-${code}-${field}`);
  for(const metric of ["return_pct","volatility_pct","max_drawdown_pct"])allowedIDs.add(`E-MD-${req.period.replaceAll("-","")}-${metric}`);
  if(requested.some(id=>!allowedIDs.has(id)))throw Object.assign(new Error("追问包含无效或不属于所选期次的证据 ID。"),{code:"INVALID_CONTEXT"});
  const calls=[];const onCall=call=>{calls.push(call);options.onModelCall?.(call);};
  let plan=rulePlan(req.question,req.context?.dimensions);let modelState="not_configured";
  if(modelReady(env))try {plan=await modelPlan(env,req.question,{...req.context,report_period:req.period},options.modelFetcher??options.fetcher,onCall);modelState="active";}
  catch(e){modelState="failed";warnings.push(`AI 规划失败：${e.message} 已明确切换规则研究。`);}
  plan=enrichPlan(plan);
  // Context IDs are looked up against server evidence; never accept client numbers.
  const dataset=req.mode==="live"?await loadLive(plan,env,req.period,options.fetcher):publicSnapshot();
  const built=buildEvidence(dataset,req.period,plan,options.now??new Date());
  if(requested.some(id=>!built.all_evidence.find(e=>e.evidence_id===id)))throw Object.assign(new Error("所选证据在当前数据中不可用，请重新选择证据。"),{code:"INVALID_CONTEXT"});
  const selected=built.all_evidence.filter(e=>requested.includes(e.evidence_id));
  const evidence=[...new Map([...built.evidence,...selected].map(e=>[e.evidence_id,e])).values()];
  let analysis=deterministicSummary(evidence,req.context),engine="rules";
  if(modelState==="active")try {analysis=await modelAnalyze(env,req.question,plan,evidence,{...req.context,report_period:req.period,selected_ids:selected.map(e=>e.evidence_id)},options.modelFetcher??options.fetcher,onCall);engine="llm";}
  catch(e){modelState="failed";warnings.push(`AI 解读被拦截：${e.message} 以下为规则生成的研究说明。`);}
  if(analysis.followup_validation?.removed_count)warnings.push(`模型生成的 ${analysis.followup_validation.removed_count} 条追问未通过研究范围检查，已移除；无可用追问时显示明确规则提供的核验问题。`);
  if(!modelReady(env))warnings.push("真实语言模型尚未启用：本次使用规则规划与确定性证据说明，不属于已验证的 LLM 诊断。");
  if(req.mode==="snapshot")warnings.push("使用公开财报快照，行情和估值不在覆盖范围。期末日期与采集时间分别显示；快照不会自动更新。");
  warnings.push(...(dataset.issues??[]));
  if(built.all_evidence.some(e=>e.verification_status==="STALE"))warnings.push("财报缓存采集时间已超过七天，请重新采集核验；不将缓存标记为最新数据。");
  if(Date.now()-Date.parse(req.period)>200*86400000)warnings.push("所选财报期末距今超过两百天，属于历史报告研究，不能代表公司当前状态。");
  const safeRecords=built.records.map(r=>({...r,values:Object.fromEntries(Object.entries(r.values).map(([field,value])=>[field,built.conflicts.some(c=>c.company_code===r.company_code&&c.period===r.period&&c.field===field)?null:value]))}));
  const record=built.current;
  return {status:"ok",question:req.question,period:req.period,plan,evidence,analysis,engine,model_state:modelState,data_mode:dataset.mode,
    model_usage:{provider:modelReady(env)?modelProvider(env):null,model:modelReady(env)?env.LLM_MODEL:null,planning:plan.engine==="llm"?"validated":"not_validated",interpretation:engine==="llm"?"validated":"not_validated",validated_at:engine==="llm"?new Date().toISOString():null,calls},
    warnings,selected_ids:selected.map(e=>e.evidence_id),history:[...(req.context?.history??[]),{question:req.question,summary:analysis.claims.map(c=>c.rendered_text).join(" ").slice(0,1200)}].slice(-4),
    financials:safeRecords.filter(r=>r.company_code==="000333.SZ"),peers:safeRecords.filter(r=>r.period===req.period),prices:dataset.prices??[],valuations:dataset.valuations??[],
    coverage:{report_period:req.period,published_at:record?.published_at??null,retrieved_at:dataset.created_at,sources:dataset.sources,conflicts:built.conflicts},
    trace:[{step:"问题理解与规划",engine:plan.engine,dimensions:plan.dimensions},{step:"取数与标准化",engine:dataset.mode,metrics:plan.metrics},{step:"指标计算与证据",engine:"deterministic",count:evidence.length},{step:"解释与引用检查",engine,status:modelState}],elapsed_ms:Date.now()-started,
    disclaimer:"仅供研究辅助，不构成投资建议。正负方向指指标变化，推断与未知信息应进一步核验。"};
}
export function overview() {const dataset=publicSnapshot();return {company:{name:"美的集团",code:"000333.SZ",industry:"家电制造 / 多元业务"},financials:canonicalRecords(dataset).filter(r=>r.company_code==="000333.SZ"),sources:dataset.sources,created_at:dataset.created_at,event:dataset.event};}
