// Shared by the UI and regression checks so every clickable question is exercised.
export const DIMENSIONS = {quality:"经营质量",trend:"财务趋势",valuation:"估值",market:"行情特征",industry:"行业位置",events:"事件与风险"};
export const PRESET_QUESTIONS = ["利润增长是否得到了现金流支持？","最近经营质量有没有改善？","目前估值与同行相比如何？","近期股价波动和回撤有多大？"];
export const EVENT_QUESTION = "归母与扣非利润表现为什么不同？";
export const PEER_QUESTION = "美的与格力的经营质量和估值有什么差异？";
export const DEFAULT_FOLLOWUPS = ["利润增长与现金流增长为何不同步？","与格力同期相比有什么差异？","还需要哪些材料才能验证原因？"];
export const dimensionQuestion = key => `美的集团的${DIMENSIONS[key]}有哪些可验证的证据？`;
