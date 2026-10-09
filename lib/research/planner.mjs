import { z } from "zod";
import { DIMENSIONS } from "./question-catalog.mjs";
export { DIMENSIONS } from "./question-catalog.mjs";
export const METRICS = {
  quality:["parent_profit","ocf","cash_coverage","profit_margin","adjusted_profit","roe","accounts_receivable","inventory"],
  trend:["revenue","parent_profit","adjusted_profit","ocf"],
  valuation:["pe_ttm","pb_mrq","peer_valuation"],market:["close","return_pct","volatility_pct","max_drawdown_pct"],
  industry:["peer_revenue","peer_profit","peer_roe"],events:["disclosures","adjusted_profit"]
};
export const planSchema = z.object({
  intent:z.string().min(1).max(120), dimensions:z.array(z.enum(Object.keys(DIMENSIONS))).min(1).max(6),
  rationale:z.string().min(1).max(400), questions:z.array(z.string().max(100)).max(4),
}).strict();
export function isRestricted(question) {
  const normalized=question.normalize("NFKC").replace(/[\u200b-\u200f\ufeff]/g,"");
  if(/\b(?:buy|sell|guaranteed)\b|price\s*target|(?:should|recommend|advise).{0,20}(?:purchase|hold|accumulate|exit|reduce|short)/i.test(normalized))return true;
  const text=normalized.replace(/\s/g,"");
  if(/(?:肯定|必定|必然|必将|一定|绝对|保证|确保|稳稳|百分之百|毫无疑问).{0,24}(?:上涨|下跌|会涨|会跌|走高|走低|翻倍|赚钱|获利|盈利|正收益|收益)|(?:股价|价格|收益).{0,24}(?:肯定|必定|必然|必将|绝对)/.test(text))return true;
  if(/(?:下周|下个月|下月|未来|明年|年底|后天|明日|明天).{0,18}(?:股价|价格)?.{0,8}(?:将|会|必|肯定).{0,5}(?:涨|跌|翻倍)|(?:建议|应该|应当|务必|立即|现在|适合|值得).{0,12}(?:做多|做空|买|卖|增持|减持|购入|出售|持仓|买进|卖掉)|(?:立即|务必|赶紧|直接)(?:增持|减持|购入|出售|持有|做多|做空)/.test(text))return true;
  if(/\b(?:will|must|certainly|definitely|surely).{0,35}(?:rise|fall|rally|crash|profit|return|go up|go down)|\b(?:guarantee[ds]?|risk.free).{0,25}(?:profit|return)|\b(?:go long|go short|take profit|stop loss)\b/i.test(normalized))return true;
  if (/(买入|卖出|该买|该卖|能买吗|能买|能卖|买不买|买还是|卖不卖|加仓|减仓|清仓|建仓|开仓|平仓|抄底|稳赚|保本|保证.*收益|收益.*保证|保证.*赚|一定.*涨|一定.*跌|必涨|必跌|涨到|跌到|目标价|预测.*(股价|价格|涨跌)|明天.*(涨|跌)|\b(?:buy|sell|guaranteed)\b|pricetarget)/i.test(text))return true;
  return /(?:建议|应该|应当|可以|适合|值得|需要|务必|是否|要不要|能否|该不该|给我|现在).{0,12}(?:增持|减持|止损|止盈|入手|持有|购入|出售)|(?:增持|减持|止损|止盈|入手|持有|购入|出售).{0,10}(?:建议|吗|好不好|是否|时机)/i.test(text);
}
const SCOPE_COMPANIES=["美的集团","美的","格力电器","格力","海尔智家","海尔","Midea","Gree","Haier"];
// Financial subjects are topics, not company names. Use the same distinction in
// the leading subject and in comparisons such as “归母与扣非利润”.
const FINANCIAL_TOPIC=/(归母|扣非|现金流量表|现金及现金等价物|非经常性损益|一次性项目|金融资产|衍生|汇兑|营业收入|经营现金流|加权平均\s*ROE|每股收益|市盈率|市净率|资产负债|自由现金流|净资产|利润|盈利|营收|收入|现金|估值|股价|行情|波动|回撤|经营|财务|风险|事件|公告|行业|同行|营运|竞争|原因|质量|毛利|应收|存货|股东|附注|指标|口径|比率|覆盖|代理|融资|投资|管理层|债务|偿债|周转|担保|并购|分红|海外业务|业务结构|营业成本|总资产|ROE|PE|PB|profit|revenue|cash|valuation)/i;
function unresolvedSubject(text) {
  const field=FINANCIAL_TOPIC.exec(text);
  let subject=field?text.slice(0,field.index):text;
  for(const name of SCOPE_COMPANIES)subject=subject.replaceAll(new RegExp(name,"gi"),"");
  return subject.replace(/000333(?:\.SZ)?|000651(?:\.SZ)?|600690(?:\.SH)?/gi,"")
    .replace(/才能|还需要|本公司|该公司|这家公司|最新|什么是|更完整|关注|了解|希望|我们|其他|渠道|获取|具体|哪类|不同期间|关于|存在|该|在/gu,"")
    .replace(/请问|请|帮我|帮忙|能否|可以|是否|为什么|为何|怎么样|怎么|怎样|如何|分析|研究|诊断|解释|核验|验证|比较|对比|相比|相较|同期|本期|当期|最近|近期|目前|今年|上半年|下半年|季度|未来|过去|历史|当前|所选|选中|围绕|根据|结合|造成|这种|这些|这个|差异|可能|哪些|什么|问题|材料|证据|公司|企业|家电|制造业|集团|需要|还需|进一步|继续|想|支持|得到|附注|变化|稳定|持续性|还有|控股|提供|检查|核对|说明|存在|重大|应当|应该|还应|能|的|与|和|及|对|比|有|了|吗|呢/gu,"")
    .replace(/才能|还/gu,"").replace(/[\p{P}\s\d年月日一二三四五六七八九十百]/gu,"");
}
export function inResearchScope(question) {
  const q=question.normalize("NFKC").replace(/[\u200b-\u200f\ufeff]/g,"");
  const codes=q.match(/(?<!\d)\d{6}(?!\d)/g)??[];
  if(codes.some(code=>!["000333","000651","600690"].includes(code)))return false;
  for(const match of q.matchAll(/(?:改为|改看|换成|换到|切换到|分析|研究|诊断|研究对象(?:改为|是|为)?)([\p{Script=Han}A-Za-z]{2,24})/gu)) {
    if(unresolvedSubject(match[1]))return false;
  }
  // Validate the named subject rather than silently binding any company's question to Midea.
  // Generic financial questions keep the explicitly selected Midea context.
  if(unresolvedSubject(q))return false;
  const peer=/格力|海尔|000651|600690|Gree|Haier/i.test(q);
  if(peer&&!/美的|000333|Midea|比较|对比|相比|相较|同行|差异|区别|与|\bvs\b/i.test(q))return false;
  // Also inspect company names appearing after a comparison connector.
  for(const match of q.matchAll(/(?:相比|对比|与|和)([\p{Script=Han}A-Za-z]{2,16}?)(?:的|相比|比较|怎么样|如何|利润|收入|估值|经营)/gu)) {
    if(unresolvedSubject(match[1]))return false;
  }
  return true;
}
export function rulePlan(question, contextDimensions = []) {
  const dimensions = new Set();
  const add=(...ds)=>ds.forEach(d=>dimensions.add(d));
  if (/现金|利润|盈利|营运|应收|存货|质量/.test(question)) add("quality","trend");
  if (/收入|增长|趋势|改善|经营/.test(question)) add("trend","quality");
  if (/估值|市盈|市净|PE|PB|贵|便宜/i.test(question)) add("valuation","industry");
  if (/行情|股价|波动|回撤|走势|收益率/.test(question)) add("market");
  if (/同行|竞争|行业|格力|海尔/.test(question)) add("industry");
  if (/风险|事件|公告|汇率|原因|为什么|差异/.test(question)) add("events","quality");
  if (!dimensions.size) { if (contextDimensions.length) add(...contextDimensions); else add("quality","trend","events"); }
  return { intent:question.slice(0,120),dimensions:[...dimensions],
    rationale:"家电制造企业优先关注盈利兑现、现金回收与营运资金。依据问题关键词组织数据；此处是规则路由，尚未调用语言模型。",
    questions:["利润与经营现金流的统计口径是否一致？","是否需要营运资金附注验证变化原因？"],engine:"rules" };
}
export function enrichPlan(plan) {
  return {...plan, dimensions:[...new Set(plan.dimensions)], metrics:[...new Set(plan.dimensions.flatMap(d=>METRICS[d]))], company_type:"家电制造业（兼有工业技术、楼宇及自动化业务）"};
}
