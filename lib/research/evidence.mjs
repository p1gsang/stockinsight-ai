import { growth, ratio, finite, compareSources, freshness, marketStats } from "./metrics.mjs";
import { evidenceTopics } from "./claim-support.mjs";
export const LABELS={revenue:"营业收入",parent_profit:"归母净利润",adjusted_profit:"扣非归母净利润",ocf:"经营现金流净额",roe:"加权平均 ROE",accounts_receivable:"应收账款",inventory:"存货"};
export function display(v, unit="亿元") { return !finite(v)?"未获得":unit==="亿元"?(v/1e8).toFixed(2):v.toFixed(2); }
export function canonicalRecords(dataset, asOf=new Date().toISOString().slice(0,10)) {
  const map=new Map();
  for (const r of [...dataset.records].sort((a,b)=>a.published_at.localeCompare(b.published_at))) {
    if (r.published_at<=asOf) map.set(`${r.company_code}:${r.period}:${r.basis}`,r);
  }
  return [...map.values()].sort((a,b)=>a.period.localeCompare(b.period));
}
export function buildEvidence(dataset, period, plan, now=new Date()) {
  const asOf=now.toISOString().slice(0,10),visibleRecords=dataset.records.filter(r=>r.published_at<=asOf);
  const records=canonicalRecords({...dataset,records:visibleRecords},asOf);
  const current=records.find(r=>r.company_code==="000333.SZ"&&r.period===period);
  const previous=records.find(r=>r.company_code==="000333.SZ"&&r.period===`${Number(period.slice(0,4))-1}${period.slice(4)}`&&r.basis===current?.basis);
  const sources=Object.fromEntries(dataset.sources.map(s=>[s.id,s]));
  const extra=(dataset.supplement?.source?.published<=asOf?dataset.supplement?.facts:[])??[];
  const fact=(field,p=period)=>extra.find(f=>f.field===field&&f.report_period===p);
  const extraInput=f=>({...f,published_at:sources[f.source_id]?.published,retrieved_at:sources[f.source_id]?.retrieved_at,source_url:sources[f.source_id]?.url});
  const conflicts=compareSources(visibleRecords);
  const all=[];
  const id=(suffix)=>`E-MD-${period.replaceAll("-","")}-${suffix}`;
  const input=(r,field)=>{const sid=r.field_source_ids?.[field]??r.source_id;return {company_code:r.company_code,report_period:r.period,basis:r.basis,source_id:sid,source_field:r.source_fields?.[field]??field,normalized_field:field,source_column:r.source_column,
    raw_value:r.raw_values[field]??r.values[field],normalized_value:r.values[field],raw_unit:field==="roe"?"%":sources[sid]?.unit??"元",
    source_url:sources[sid]?.url,source_page:sources[sid]?.page,published_at:r.published_at,retrieved_at:sources[sid]?.retrieved_at};};
  function add(suffix,dimension,title,value,unit,method,inputs=[],direction="UNKNOWN",type="FACT",note="") {
    const conflict=inputs.some(x=>conflicts.some(c=>c.company_code===x.company_code&&c.period===x.report_period&&c.field===(x.normalized_field??x.source_field)));
    const missing=value===null||value===undefined;
    const stale=inputs.some(x=>freshness(x.retrieved_at,now)!=="CURRENT");
    all.push({evidence_id:id(suffix),topics:evidenceTopics(suffix),period_basis:inputs.length&&inputs.every(i=>i.basis==="POINT_IN_TIME")?"POINT_IN_TIME":"H1_YTD",company_code:inputs[0]?.company_code??"000333.SZ",dimension,title,claim:title,claim_type:conflict||missing?"UNKNOWN":type,
      evidence_direction:conflict?"CONFLICTING":missing?"UNKNOWN":direction,conflict_kind:conflict?"SOURCE_CONFLICT":null,
      source_name:inputs.length?dataset.mode==="fuyao_live"?"同花顺扶摇 API":"上市公司定期报告 · 巨潮资讯":"数据覆盖检查",
      source_url:inputs[0]?.source_url??null,source_field:inputs.map(x=>x.source_field).join(" / "),
      raw_value:conflict?null:value,display_value:conflict?"来源冲突":missing?"待验证":`${display(value,unit)}${unit}`,
      unit,report_period:period,market_date_range:null,retrieved_at:inputs[0]?.retrieved_at??dataset.created_at,
      calculation_method:method,verification_status:conflict?"SOURCE_CONFLICT":missing?"UNAVAILABLE":stale?"STALE":inputs.length>1||method.includes("÷")||method.includes("−")?"CALCULATED":"SOURCE_EXTRACTED",
      inputs,note:conflict?"同一字段来源冲突，已阻止数值参与结论。":note,limitations:stale?["缓存获取时间超过七天，请重新核验。"]:[]});
  }
  const blocked=(r,field)=>!r||!finite(r.values[field])||conflicts.some(c=>c.company_code===r.company_code&&c.period===r.period&&c.field===field);
  const raw=(field,dimension)=>{
    const r=current; const valid=r&&finite(r.values[field]);
    const supplemental=fact(field);
    if(!valid&&supplemental){add(field,dimension,LABELS[field],supplemental.normalized_value,"亿元","合并资产负债表期末余额；人民币千元 ×1000，展示为亿元。不是半年流量，不与半年收入直接作同比。",[extraInput(supplemental)],"UNKNOWN","FACT","期末存量不等于现金流量表的营运资金调节项。");return;}
    add(field,dimension,LABELS[field],valid?r.values[field]:null,field==="roe"?"%":"亿元","报表原值；人民币元 ÷ 一亿（展示换算），ROE 按披露值。",valid?[input(r,field)]:[],"UNKNOWN","FACT",valid?"金额为半年度累计，ROE 为半年度披露值，不年化。":"现有公开摘要未覆盖该字段，需完整财报或授权接口。");
  };
  ["revenue","parent_profit","adjusted_profit","ocf","roe","accounts_receivable","inventory"].forEach(f=>raw(f,f==="revenue"?"trend":"quality"));
  for (const field of ["revenue","parent_profit","adjusted_profit","ocf"]) {
    const inputs=[current,previous].filter(Boolean).filter(r=>finite(r.values[field])).map(r=>input(r,field));
    const value=blocked(current,field)||blocked(previous,field)?null:growth(current.values[field],previous.values[field]);
    add(field+"-yoy",field==="revenue"?"trend":"quality",LABELS[field]+"同比",value,"%","（本期 ÷ 上年同期 − 1）×100；仅比较相同半年累计口径，非正基数不计算。",inputs,value===null?"UNKNOWN":value>=0?"POSITIVE":"NEGATIVE","FACT",value===null?"缺少同口径同期数据、基数非正或来源冲突。":"正负方向只表示指标变化，不代表投资建议。");
  }
  const coverage=blocked(current,"ocf")||blocked(current,"parent_profit")?null:ratio(current.values.ocf,current.values.parent_profit);
  add("cash-coverage","quality","现金流对归母利润的覆盖代理",coverage,"倍","合并经营现金流净额 ÷ 归母净利润。分子含少数股东相关现金流，分母仅归母，属辅助代理；不能等同合并净利润现金含量。",current?[input(current,"ocf"),input(current,"parent_profit")]:[],coverage!==null&&coverage>=1?"POSITIVE":"NEGATIVE");
  const margin=blocked(current,"parent_profit")||blocked(current,"revenue")?null:ratio(current.values.parent_profit,current.values.revenue);
  add("profit-margin","quality","归母净利润 / 营业收入",margin===null?null:margin*100,"%","归母净利润 ÷ 营业收入 ×100；属归母盈利比率，不等同合并净利率。",current?[input(current,"parent_profit"),input(current,"revenue")]:[]);
  const pg=all.find(e=>e.evidence_id===id("parent_profit-yoy")), cg=all.find(e=>e.evidence_id===id("ocf-yoy"));
  if (finite(pg?.raw_value)&&finite(cg?.raw_value)&&pg.raw_value>cg.raw_value) {
    add("growth-tension","quality","利润增速快于现金流增速",pg.raw_value-cg.raw_value,"个百分点","归母净利润同比 − 经营现金流同比；经营信号的分析张力，不是来源数字冲突。",[...pg.inputs,...cg.inputs],"CONFLICTING","INFERENCE","现金流覆盖水平与增长速度分别回答不同问题。无法凭增速差直接判断利润失真。");
    all.at(-1).conflict_kind="SIGNAL_TENSION";
  }
  add("cause",plan.dimensions.includes("quality")?"quality":"events","现金流变化的业务归因尚待核验",null,"",fact("bridge_ocf")?"已有报表现金流桥接；仍需业务层面回款、采购结算等明细才能验证具体经营原因。":"需营运资金变动、应收、存货、应付与现金流补充资料形成桥接。",[],"UNKNOWN","UNKNOWN","已有数据无法隔离汇率、季节性、结算及并表变化的贡献，不能生成确定性因果结论。");
  add("nonrecurring-cause","quality","非经常性项目的持续影响尚待核验",null,"","需具体项目明细、对冲期限与后续期间披露，不能把当期调节数推为持续业绩。",[],"UNKNOWN","UNKNOWN","归母与扣非归母同属归母口径；不能用少数股东权益解释二者口径差异。");
  add("liquidity-cause","quality","流动性与偿债压力尚不能确认",null,"","需债务到期结构、受限资金、可用授信与预测现金流；利润和经营现金流增速差不足以判断。",[],"UNKNOWN","UNKNOWN","没有完整偿债证据，不判断公司已经存在流动性压力。");
  const nonrecurring=fact("nonrecurring_parent");
  if(nonrecurring&&current&&!blocked(current,"parent_profit")&&!blocked(current,"adjusted_profit")) {
    const financial=fact("nonrecurring_financial");
    add("nonrecurring-parent","quality","归母非经常性损益净额",nonrecurring.normalized_value,"亿元","非经常性损益明细表原值；已扣除所得税与少数股东税后影响额。",[extraInput(nonrecurring)]);
    if(financial)add("nonrecurring-financial","quality","金融资产等非经常性公允价值变动及处置收益",financial.normalized_value,"亿元","明细表综合项目；包含多类金融资产，不能等同单一衍生工具收益。",[extraInput(financial)]);
    const gap=current.values.parent_profit-current.values.adjusted_profit;
    const matches=Math.abs(gap-nonrecurring.normalized_value)<1;
    add("profit-reconciliation","quality","归母与扣非归母差额核对",matches?gap:null,"亿元","归母净利润 − 扣非归母净利润；与披露的归母非经常性损益净额核对。税后归母口径。",[input(current,"parent_profit"),input(current,"adjusted_profit"),extraInput(nonrecurring)],"UNKNOWN","FACT",matches?"差额与非经常性损益净额一致；不代表这些损益会持续。":"差额未能与原文对齐，停止正常结论。");
  }
  const bridge=fact("bridge_ocf");
  if(bridge) {
    const items=extra.filter(f=>f.report_period===period&&f.field.startsWith("bridge_")&&f.field!=="bridge_ocf");
    const sum=items.reduce((n,f)=>n+f.normalized_value,0);
    add("ocf-bridge","quality","合并净利润至经营现金流的调节核对",sum===bridge.normalized_value?bridge.normalized_value:null,"亿元","将合并净利润加各项报表调节数，核对经营现金流。此处使用合并净利润，不能代入归母净利润。",[...items,bridge].map(extraInput),"UNKNOWN","FACT","各项为报表调节贡献；不能单独证明客户回款、采购策略或汇率等具体经营原因。");
    for(const [field,label,direction] of [["bridge_inventory","存货减少的现金流调节项","POSITIVE"],["bridge_receivables","经营性应收增加的现金流调节项","NEGATIVE"],["bridge_payables","经营性应付增加的现金流调节项","POSITIVE"]]){
      const f=fact(field);if(f)add(field.replaceAll("_","-"),"quality",label,f.normalized_value,"亿元","现金流补充资料有符号原值；为当期流量，不等于对应资产负债期末余额变化。",[extraInput(f)],direction,"FACT","方向表示对净利润调节到经营现金流的正负贡献，不代表投资判断。");
    }
  }
  const payable=fact("accounts_payable");
  if(payable)add("accounts_payable","quality","应付账款期末余额",payable.normalized_value,"亿元","合并资产负债表期末存量，不等同经营性应付项目现金流调节项。",[extraInput(payable)]);
  add("gross-margin","quality","毛利率数据未覆盖",null,"%","需要同口径营业收入与营业成本。",[],"UNKNOWN","UNKNOWN","不以归母盈利比率代替毛利率。");
  if (dataset.event && current && dataset.event.date<=asOf && period==="2026-06-30") {
    const s=sources[dataset.event.source_id];
    add("event-fx","events","公司披露汇兑与衍生工具的会计分类差异",1,"条","定期报告管理层说明；属于已披露解释，并非独立因果验证。",[{...input(current,"adjusted_profit"),source_field:"主要会计数据表后备注",raw_value:null,normalized_value:null,source_page:dataset.event.page,source_url:s?.url}],"UNKNOWN","FACT",dataset.event.description);
  }
  for (const peer of records.filter(r=>r.company_code!=="000333.SZ"&&r.period===period&&r.basis===current?.basis)) {
    for (const field of ["revenue","parent_profit","roe"]) add(`peer-${peer.company_code.slice(0,6)}-${field}`,"industry",`${peer.company_name} · ${LABELS[field]}`,peer.values[field],field==="roe"?"%":"亿元","同口径半年报披露值。业务结构与合并范围存在差异；样本不等于行业排名。",[input(peer,field)]);
  }
  if (!records.some(r=>r.company_code==="600690.SH"&&r.period===period)) add("peer-haier","industry","海尔智家财务样本尚未接入",null,"","需要公开报告或授权接口的同口径数据。");
  if (dataset.valuations?.length) {
    for (const v of dataset.valuations) for (const field of ["pe_ttm","pb_mrq"]) {
      const s=sources[v.source_id];
      const val=finite(v[field])&&v[field]>0?v[field]:null;
      add(`valuation-${v.thscode.slice(0,6)}-${field}`,"valuation",`${v.name??v.thscode} · ${field==="pe_ttm"?"PE TTM":"PB MRQ"}`,val,"倍","上游估值原值；负值不按低估排序；timestamp 是上游最大元数据时间，不保证所有字段同步。",[{company_code:v.thscode,source_field:field,raw_value:v[field],normalized_value:v[field],raw_unit:"倍",report_period:"当前快照",source_id:v.source_id,source_url:s?.url,retrieved_at:s?.retrieved_at,published_at:v.date,source_column:"item"}]);
      Object.assign(all.at(-1),{report_period:"不适用（当前估值）",market_date_range:[v.date,v.date]});
    }
  } else add("valuation-missing","valuation","当前估值和同行估值无法验证",null,"","需要同一统计时点 PE TTM、PB MRQ。",[],"UNKNOWN","UNKNOWN",(dataset.issues??[]).join("；")||"未配置金融接口；不推算当前估值，不生成历史估值百分位。");
  let stats,marketIssue;
  if(dataset.prices?.length)try {stats=marketStats(dataset.prices,now);}catch(error){marketIssue=error.message;}
  if (stats) {
    const s=sources[dataset.market_source_id];
    for (const [field,label] of [["return_pct","区间价格涨跌幅"],["volatility_pct","年化历史波动率"],["max_drawdown_pct","区间最大回撤"]]) {
      add(field,"market",label,stats[field],"%",stats.method,[{source_field:"close",raw_value:dataset.prices,source_url:s?.url,source_id:s?.id,retrieved_at:s?.retrieved_at,raw_unit:"元/股",report_period:"行情区间",source_column:"item"}]);
      Object.assign(all.at(-1),{market_date_range:[stats.start,stats.end],note:`复权方式：${dataset.adjustment}；价格区间统计，非未来预测。`});
    }
  } else add("market-missing","market","行情区间统计暂不可用",null,"","取得有明确复权口径的日线后，程序计算收益率、波动率与最大回撤。",[],"UNKNOWN","UNKNOWN",[marketIssue,...dataset.issues??[]].filter(Boolean).join("；")||"当前无授权行情，不展示占位价格或虚构曲线。");
  return {evidence:all.filter(e=>plan.dimensions.includes(e.dimension)),all_evidence:all,current,previous,records,conflicts};
}
