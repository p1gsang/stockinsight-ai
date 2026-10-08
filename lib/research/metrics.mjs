export const finite = (v) => typeof v === "number" && Number.isFinite(v);
export function growth(current, previous) {
  return finite(current) && finite(previous) && previous > 0 ? (current / previous - 1) * 100 : null;
}
export function ratio(numerator, denominator) {
  return finite(numerator) && finite(denominator) && denominator > 0 ? numerator / denominator : null;
}
export function validCalendarDate(value) {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=Date.parse(value+"T00:00:00Z");
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function marketStats(prices, now=new Date()) {
  if (!Array.isArray(prices) || prices.length < 3) throw new Error("行情至少需要三个有效收盘价");
  if (prices.some((p, i) => !finite(p.close) || p.close <= 0 || !validCalendarDate(p.date) || p.date>now.toISOString().slice(0,10) || (i > 0 && prices[i-1].date >= p.date))) throw new Error("行情价格或日期无效、未来日期、重复或未排序");
  const days=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
  if(prices.some((p,i)=>i>0&&days(prices[i-1].date,p.date)>14)||days(prices[0].date,prices.at(-1).date)>30&&prices.length<days(prices[0].date,prices.at(-1).date)/4)throw new Error("行情日线覆盖过疏，无法按日收益率计算年化波动率；需补齐交易日或核实停牌。");
  const returns = prices.slice(1).map((p,i) => Math.log(p.close / prices[i].close));
  const mean = returns.reduce((a,b)=>a+b,0) / returns.length;
  const variance = returns.reduce((a,b)=>a+(b-mean)**2,0) / (returns.length-1);
  let peak = prices[0].close, maxDrawdown = 0;
  for (const p of prices) { peak = Math.max(peak,p.close); maxDrawdown = Math.min(maxDrawdown,p.close/peak-1); }
  return { return_pct: (prices.at(-1).close/prices[0].close-1)*100,
    volatility_pct: Math.sqrt(variance)*Math.sqrt(252)*100, max_drawdown_pct: maxDrawdown*100,
    start: prices[0].date, end: prices.at(-1).date, observations: prices.length,
    method: "区间涨跌幅=末价/首价−1；波动率=日对数收益率样本标准差×√252；最大回撤=min(收盘价/此前最高收盘价−1)。不含现金分红再投资。日期和稀疏度筛查不等于完整交易日历核验；停牌及短缺口仍需原始日线核验。" };
}
export function freshness(date, now = new Date(), days = 7) {
  const t = Date.parse(date);
  if (!Number.isFinite(t) || t > now.getTime()+86400000) return "INVALID_DATE";
  return now.getTime()-t > days*86400000 ? "STALE" : "CURRENT";
}
export function compareSources(records) {
  const conflicts = [];
  for (let i=0;i<records.length;i++) for (const b of records.slice(i+1)) {
    const a=records[i];
    if (a.company_code !== b.company_code || a.period !== b.period || a.basis !== b.basis) continue;
    for (const field of Object.keys(a.values)) {
      const x=a.values[field], y=b.values[field];
      if (finite(x) && finite(y) && Math.abs(x-y)>Math.max(Math.abs(x)*1e-8,0.01)) conflicts.push({ company_code:a.company_code,period:a.period,field,source_ids:[a.source_id,b.source_id] });
    }
  }
  return conflicts;
}
