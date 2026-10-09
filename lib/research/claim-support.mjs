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
    if(/(?:应收|存货|应付).{0,10}(?:增加|减少|下降|上升)|(?:正向|负向)(?:贡献|调节)/.test(text))
      throw new Error("待验证信息不能断言已知调节方向；报表贡献应单独引用已知证据。");
    // An UNKNOWN badge never licenses an asserted explanation or company condition.
    for(const clause of text.split(/[。；;!?！？]/)) {
      if(/(?:因.{0,45}(?:导致|造成|所致)|由于|归因于|源于|造成了|导致了)/.test(clause)&&!/无法确认|不能确认|尚不能验证|无法验证|尚未验证|不能确定/.test(clause))
        throw new Error("未知信息写成确定性原因，输出已拦截。");
      if(/(?:存在|面临|显示|表明|提示).{0,15}(?:流动性|偿债|债务压力)/.test(clause)&&!/无法|不能|不足以|尚未/.test(clause))
        throw new Error("未知信息写成已存在的风险，输出已拦截。");
    }
  }
  if(/归母/.test(text)&&/扣非/.test(text)&&/少数股东/.test(text)&&/(?:因|由于|包含).{0,35}少数股东/.test(text)&&!/同为归母|已扣除|税后影响额/.test(text))
    throw new Error("归母与扣非归母差异不能解释为包含少数股东权益，输出已拦截。");
  if(claim.claim_type==="INFERENCE") {
    const speed=/(?:现金转化|现金转换|现金回收|回款|收款).{0,8}(?:速度|周期|效率|加快|变慢|放缓|滞后)|(?:回款|收款)(?:变慢|放缓|加速|改善|恶化)/;
    if(speed.test(text)&&!cited.some(e=>tags(e).includes("cash_conversion_timing")))
      throw new Error("金额及增速证据不能证明现金转化或回款速度，输出已拦截。");
    if((/高于基准|低于基准|优于基准|行业平均|正常水平|合理水平|健康水平/.test(text)||/覆盖|现金含量|比例/.test(text)&&/偏高|偏低|较高|较低|高水平|低水平/.test(text))&&!cited.some(e=>tags(e).includes("benchmark")))
      throw new Error("基准或行业比较缺少明确来源和口径，输出已拦截。");
    if(/现金流.{0,20}(?:未完全|不足|不够).{0,8}(?:支持|支撑)|(?:支持|支撑).{0,8}(?:不足|不够)/.test(text)&&cited.some(e=>e.evidence_id.endsWith("growth-tension")))
      throw new Error("金额及增速差异不能证明现金支持不足，输出已拦截。");
    if(/公司披露|管理层说明|报告指出/.test(text)&&/覆盖代理|现金覆盖/.test(text)&&!cited.some(e=>e.evidence_id.endsWith("event-fx")))
      throw new Error("产品计算口径不能归为公司披露，输出已拦截。");
    if(/流动性|偿债|债务压力/.test(text)&&!/不能|无法|不足以|尚不能/.test(text))
      throw new Error("现有指标不足以支持流动性或偿债压力结论，输出已拦截。");
    for(const clause of text.split(/[。；;!?！？]/)) {
      if(/由于|归因于|导致|源于|所致/.test(clause)&&!/不能|无法|尚未|不足以|并非/.test(clause)) {
        const bridge=cited.find(e=>e.evidence_id.endsWith("profit-reconciliation"));
        const identity=bridge?.raw_value!==0&&bridge?.claim_type==="FACT"&&/归母/.test(clause)&&/扣非/.test(clause)&&/非经常/.test(clause)&&/差额|差异/.test(clause)&&!/持续|未来|增长|下降|增加|减少|改善/.test(clause);
        const proxyDefinition=cited.some(e=>e.evidence_id.endsWith("cash-coverage"))&&/合并|少数股东/.test(clause)&&/归母|分母/.test(clause)&&/口径/.test(clause)&&!/公司披露|管理层|回款|采购|汇率|并表|季节|客户/.test(clause);
        if(!identity&&!proxyDefinition&&(!cited.some(e=>e.evidence_id.endsWith("event-fx"))||!/公司|管理层|报告|披露/.test(clause)))
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
