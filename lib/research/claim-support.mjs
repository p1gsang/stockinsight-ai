// Bounded, deterministic semantic guardrails. These do not prove arbitrary prose.
const TOPICS = [
  ["nonrecurring",/扣非|非经常|一次性项目/],
  ["cashflow",/现金流|现金回收|现金生成/],
  ["coverage",/覆盖代理|现金覆盖|现金支撑|覆盖利润|覆盖归母/],
  ["receivables",/应收/], ["inventory",/存货/], ["payables",/应付/],
  ["gross_margin",/毛利/], ["valuation",/估值|市盈|市净|\bPE\b|\bPB\b/i],
  ["market",/股价|价格涨跌|波动率|回撤/], ["liquidity",/流动性|偿债|债务压力/],
];
export function evidenceTopics(suffix) {
  if(/nonrecurring|adjusted_profit|event-fx|profit-reconciliation/.test(suffix))return ["nonrecurring"];
  if(suffix==="cash-coverage")return ["cashflow","coverage"];
  if(/ocf-bridge|cause$/.test(suffix)&&suffix!=="liquidity-cause")return ["cashflow","receivables","inventory","payables"];
  if(/bridge-receivables|accounts_receivable/.test(suffix))return ["cashflow","receivables"];
  if(/bridge-inventory|^inventory$/.test(suffix))return ["cashflow","inventory"];
  if(/bridge-payables|accounts_payable/.test(suffix))return ["cashflow","payables"];
  if(/ocf|growth-tension/.test(suffix))return ["cashflow"];
  if(suffix==="gross-margin")return ["gross_margin"];
  if(suffix==="liquidity-cause")return ["liquidity"];
  if(/valuation/.test(suffix))return ["valuation"];
  if(/market|return_pct|volatility_pct|max_drawdown_pct/.test(suffix))return ["market"];
  return [];
}
export function checkClaimSupport(claim, byId) {
  const text=claim.text.replace(/\{\{[^{}]+\}\}/g,"");
  const cited=claim.evidence_ids.map(id=>byId[id]);
  const topics=TOPICS.filter(([,pattern])=>pattern.test(text)).map(([topic])=>topic);
  const tags=e=>e.topics??evidenceTopics(e.evidence_id.replace(/^E-MD-\d+-/,""));
  for(const topic of topics)if(!cited.some(e=>tags(e).includes(topic)))
    throw new Error(`结论主题与所引证据不对应（${topic}），输出已拦截。`);
  for(const e of cited)if(topics.length&&tags(e).length&&!tags(e).some(t=>topics.includes(t)))
    throw new Error("结论混入无关证据引用，输出已拦截。");
  if(claim.claim_type==="UNKNOWN") {
    if(claim.evidence_ids.some(id=>byId[id].claim_type!=="UNKNOWN"))throw new Error("待验证信息只能引用对应的未知证据；已知事实应单独描述。");
    // An UNKNOWN badge never licenses an asserted explanation or company condition.
    for(const clause of text.split(/[。；;!?！？]/)) {
      if(/(?:因.{0,45}(?:导致|造成|所致)|由于|归因于|源于|造成了|导致了)/.test(clause)&&!/无法确认|不能确认|尚不能验证|无法验证|尚未验证|不能确定/.test(clause))
        throw new Error("未知信息写成确定性原因，输出已拦截。");
      if(/(?:存在|面临|显示|表明|提示).{0,15}(?:流动性|偿债|债务压力)/.test(clause)&&!/无法|不能|不足以|尚未/.test(clause))
        throw new Error("未知信息写成已存在的风险，输出已拦截。");
    }
  }
  if(/归母|扣非/.test(text)&&/少数股东/.test(text)&&/(?:因|由于|包含).{0,35}少数股东/.test(text)&&!/同为归母|已扣除|税后影响额/.test(text))
    throw new Error("归母与扣非归母差异不能解释为包含少数股东权益，输出已拦截。");
  if(claim.claim_type==="INFERENCE") {
    if(/流动性|偿债|债务压力/.test(text)&&!/不能|无法|不足以|尚不能/.test(text))
      throw new Error("现有指标不足以支持流动性或偿债压力结论，输出已拦截。");
    for(const clause of text.split(/[。；;!?！？]/)) {
      if(/由于|归因于|导致|源于|所致/.test(clause)&&!/不能|无法|尚未|不足以|并非/.test(clause)) {
        const bridge=cited.find(e=>e.evidence_id.endsWith("profit-reconciliation"));
        const identity=bridge?.raw_value!==0&&bridge?.claim_type==="FACT"&&/归母/.test(clause)&&/扣非/.test(clause)&&/非经常/.test(clause)&&/差额|差异/.test(clause)&&!/持续|未来|增长|下降|增加|减少|改善/.test(clause);
        if(!identity&&(!cited.some(e=>e.evidence_id.endsWith("event-fx"))||!/公司|管理层|报告|披露/.test(clause)))
          throw new Error("原因解释缺少明确归属的披露证据，输出已拦截。");
      }
    }
    const coverage=cited.find(e=>e.evidence_id.endsWith("cash-coverage"));
    if(coverage&&/(?:为正|正向|正值).{0,45}(?:说明|显示|表明|因此|能够).{0,30}覆盖/.test(text))
      throw new Error("不能仅凭覆盖代理为正推导金额覆盖，输出已拦截。");
    if(coverage&&/(?:能够|可以|足以|足够).{0,8}覆盖.{0,8}利润/.test(text)&&coverage.raw_value<1)
      throw new Error("正覆盖值不等于现金规模覆盖利润，输出已拦截。");
  }
}
