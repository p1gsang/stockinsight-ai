import {DIMENSIONS,PRESET_QUESTIONS,EVENT_QUESTION,PEER_QUESTION,DEFAULT_FOLLOWUPS,dimensionQuestion} from "../../lib/research/question-catalog.mjs";
import {readFileSync} from "node:fs";
// Reuse the actual provider followups preserved in prior verification records.
export const historicalFollowups=[...new Set(["llm-trust-public-verification.json","llm-trust-local-verification.json","llm-trust-extra-local-verification.json"].flatMap(file=>JSON.parse(readFileSync(new URL(`../../docs/${file}`,import.meta.url),"utf8")).cases.flatMap(c=>c.followups??[])))];
export const uiQuestions=[...PRESET_QUESTIONS,...Object.keys(DIMENSIONS).map(dimensionQuestion),EVENT_QUESTION,PEER_QUESTION];
export const validQuestions=[...new Set([...uiQuestions,...DEFAULT_FOLLOWUPS,...historicalFollowups,
  "归母净利润同比是多少？","扣非归母净利润为何下降？","美的最新营业收入是多少？","什么是市盈率？","加权平均 ROE 如何计算？","解释指标口径","该公司经营情况如何？",
  "还应检查现金流量表附注中对现金及现金等价物变动的说明","是否存在重大非经常性损益？","能否提供应收账款及存货的最新数据","近期是否有重大融资或投资安排","管理层对利润增速与现金流增速差异有何说明",
  "围绕所选现金覆盖证据，差异的可能原因是什么，还需要验证哪些附注？","造成这种差异的原因是什么？","需要哪些附注？","为什么？","历史波动率与最大回撤","美的与海尔的利润对比","美的与格力的经营质量与偿债能力如何？","美的的海外业务有哪些风险？","美的集团事件与风险有哪些证据？","美的归母与扣非利润为何分化？","０００３３３.SZ 的经营情况如何？","美的\u200b集团的财务趋势如何？"
])];
export const outsideQuestions=[
  "宁德时代的利润增长是否得到现金流支持？","比亚迪最近利润如何？","新希望的营收如何？","贵州茅台最近盈利如何？","600519 的经营如何？","３００７５０ 的现金流如何？",
  "美的与宁德时代的利润相比如何？","美的和腾讯的股价如何？","美的与比亚迪的经营质量对比","美的利润与贵州茅台的收入相比如何？","格力电器利润如何？","海尔智家的现金流如何？",
  "分析美的的现金流，然后切换到宁德时代","美的利润如何？研究对象改为贵州茅台","美的现金流如何？再分析比亚迪的利润","美的利润如何？分析宁德时代的现金流","宁德\u200b时代的现金流如何？","帮我写一首诗","查询纽约天气"
];
export const restrictedQuestions=["现在该买入美的吗？","建议建仓。","应该止损吗？","应当增持。","明天一定会涨吗？","给出目标价","保证收益百分之十","Should I buy this stock?","建\u200b仓建议"];
