// Shared by the UI and regression checks so every clickable question is exercised.
export const DIMENSIONS = {quality:"经营质量",trend:"财务趋势",valuation:"估值",market:"行情特征",industry:"行业位置",events:"事件与风险"};
export const PRESET_QUESTIONS = ["利润增长是否得到了现金流支持？","最近经营质量有没有改善？","目前估值与同行相比如何？","近期股价波动和回撤有多大？"];
export const EVENT_QUESTION = "归母与扣非利润表现为什么不同？";
export const PEER_QUESTION = "美的与格力的经营质量和估值有什么差异？";
export const DEFAULT_FOLLOWUPS = ["利润增长与现金流增长为何不同步？","与格力同期相比有什么差异？","还需要哪些材料才能验证原因？"];
export const dimensionQuestion = key => `美的集团的${DIMENSIONS[key]}有哪些可验证的证据？`;
// The model selects useful next steps from a scope-checked, contextual question bank.
export function researchFollowups(question,dimensions=[]) {
  if(/归母.*扣非|扣非|非经常|衍生|汇兑/.test(question))return [
    "归母与扣非利润差额能否与非经常性损益明细核对？",
    "金融资产收益与扣非利润口径有什么关系？",
    "非经常性损益的持续影响还需要哪些证据？"];
  if(dimensions.includes("events")||/事件|风险|公告/.test(question))return ["扣非利润变化有哪些公司披露的解释？","非经常性损益的持续影响还需要哪些证据？","偿债与流动性风险还需要哪些证据？"];
  if(dimensions.includes("valuation"))return ["估值比较需要哪些同一时点数据？","与格力同期相比有什么差异？","估值缺失时哪些结论尚不能确认？"];
  if(dimensions.includes("market"))return ["行情统计需要哪些复权和区间口径？","历史波动率与最大回撤有什么差异？","行情缺失时哪些风险尚不能验证？"];
  if(dimensions.includes("industry"))return ["与格力同期相比有什么差异？","业务结构如何影响同行可比性？","同行比较还需要哪些同口径数据？"];
  return ["经营性应收项目如何影响现金流调节？","存货与经营性应付项目的现金流调节方向是否一致？","现金覆盖使用合并净利润和归母净利润有什么差异？"];
}
