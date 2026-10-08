// Deterministic checks cover explicit metric labels and a bounded set of financial
// relationships. They do not certify arbitrary financial prose or causality.
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
export function checkMetricBindings(claim,byId) {
  for(const match of claim.text.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const evidence=byId[match[1]];
    const labels=[evidence.title,...(match[1].endsWith("cash-coverage")?["现金流覆盖代理","现金覆盖代理","覆盖代理"]:[])];
    const prefix=claim.text.slice(0,match.index);
    if(!labels.some(label=>new RegExp(escapeRegex(label)+"(?:约为|为|达到|是|约|高达)?\\s*$").test(prefix)))throw new Error("模型数值与指标名称未绑定或错配，输出已拦截。");
  }
}
export function checkFinancialRelationships(claim,byId) {
  if(claim.claim_type!=="INFERENCE")return;
  const cited=claim.evidence_ids.map(id=>byId[id]);
  const metric=suffix=>cited.find(e=>e.evidence_id.endsWith(suffix)&&typeof e.raw_value==="number");
  const profit=metric("parent_profit-yoy"),cash=metric("ocf-yoy"),tension=metric("growth-tension");
  const gap=tension?.raw_value??(profit&&cash?profit.raw_value-cash.raw_value:null);
  const c="(?:经营)?现金流(?:净额)?(?:同比)?(?:增速|增长速度|增长率)";
  const p="(?:归母)?(?:净)?利润(?:同比)?(?:增速|增长速度|增长率)";
  for(const clause of claim.text.split(/[，。；;!?！？]/)) {
    if(/不能|无法|尚未|尚不能|不代表|不等于|未证明|并非|不足以|是否/.test(clause))continue;
    if(tension&&/现金流?(?:支撑|支持|覆盖)(?:水平)?(?:相对|略有|略显|明显|显得)?(?:不足|不够|较弱|偏弱)/.test(clause))throw new Error("增速差不能证明现金支撑或覆盖不足，输出已拦截。");
    for(const [left,right,sign] of [[c,p,-1],[p,c,1]]) {
      const greater=new RegExp(left+"(?:显著|明显|略)?(?:高于|快于|超过|大于)"+right).test(clause);
      const smaller=new RegExp(left+"(?:显著|明显|略)?(?:低于|慢于|落后于|小于)"+right).test(clause);
      if((greater||smaller)&&(gap===null||(greater?sign*gap<=0:sign*gap>=0)))throw new Error("模型增速比较与所引证据不一致或缺少支持，输出已拦截。");
    }
    for(const [name,suffix] of [["(?:归母)?(?:净)?利润","parent_profit-yoy"],["(?:经营)?现金流(?:净额)?","ocf-yoy"],["(?:营业)?收入|营收","revenue-yoy"]]) {
      const up=new RegExp("(?:"+name+")同比(?:为正|正增长|增长|上升|增加)").test(clause);
      const down=new RegExp("(?:"+name+")同比(?:为负|负增长|下降|下滑|减少)").test(clause);
      if(up||down) {
        const value=metric(suffix)?.raw_value;
        if(value===undefined||(up?value<=0:value>=0))throw new Error("模型同比方向与所引证据不一致或缺少支持，输出已拦截。");
      }
    }
  }
}
