import snapshot from "../../data/public_reports.json" with { type: "json" };
import { finite, freshness, marketStats } from "./metrics.mjs";
export const publicSnapshot=()=>structuredClone(snapshot);
export class ProviderError extends Error {
  constructor(code, message) {super(message);this.name="ProviderError";this.code=code;}
}
export async function fuyaoRequest(path, params, key, fetcher=fetch) {
  if (!key) throw new ProviderError("KEY_MISSING","尚未配置扶摇金融数据凭证，请使用公开财报快照模式。");
  const url=new URL(`https://fuyao.aicubes.cn/api/${path}`);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  let response;
  try {response=await fetcher(url,{headers:{"X-api-key":key},signal:AbortSignal.timeout(12000)});}
  catch {throw new ProviderError("TIMEOUT","金融数据请求超时或网络不可用。");}
  if (!response.ok) throw new ProviderError("HTTP_ERROR",`金融接口返回 HTTP ${response.status}。`);
  let body;
  try {body=await response.json();} catch {throw new ProviderError("INVALID_JSON","金融接口未返回合法 JSON。");}
  if (body.code!==0) throw new ProviderError(`API_${body.code}`,`金融接口拒绝请求（业务码 ${Number(body.code)||"未知"}）；请检查权限或稍后重试。`);
  if (!Array.isArray(body.data?.item)||!body.data.item.length) throw new ProviderError("EMPTY","金融接口未返回记录。");
  return {body,url:url.toString()};
}
const date=(ms)=>{if(!finite(ms))throw new ProviderError("DATE_MISSING","数据时间字段缺失。");return new Date(ms+8*3600000).toISOString().slice(0,10);};
const validateNumber=(v)=>{if(v===null||v===undefined)return null;if(!finite(v))throw new ProviderError("INVALID_FIELD","金融字段类型错误，禁止自动转换或补零。");return v;};
export function normalizeValuations(rows,codes,sourceId,asOf) {
  const seen=new Set();
  return rows.map(v=>{
    if(!codes.includes(v.thscode)||seen.has(v.thscode))throw new ProviderError("SCOPE_MISMATCH","估值返回了未请求的公司或重复公司，已停止估值比较。");
    seen.add(v.thscode);
    // Display identity comes from the requested code; do not trust an upstream label.
    const name={"000333.SZ":"美的集团","000651.SZ":"格力电器","600690.SH":"海尔智家"}[v.thscode];
    return {...v,name,pe_ttm:validateNumber(v.pe_ttm),pb_mrq:validateNumber(v.pb_mrq),source_id:sourceId,date:asOf};
  });
}
export function normalizeFinancials(incomes, cashflows, balances, code, sourceIds, asOf=new Date().toISOString().slice(0,10)) {
  if (!incomes.length||!cashflows.length) throw new ProviderError("EMPTY","利润表或现金流量表为空。");
  const records=[];
  for (const row of incomes) {
    if (row.thscode!==code||row.currency!=="CNY") throw new ProviderError("SCOPE_MISMATCH","公司代码或币种不一致。");
    const period=date(row.period_end_ms), published=date(row.report_date_ms);
    if (published>asOf) continue;
    if (!period.endsWith("-06-30")) continue;
    const cash=cashflows.find(c=>c.period_end_ms===row.period_end_ms&&c.thscode===code&&c.currency==="CNY");
    if (!cash) throw new ProviderError("PERIOD_MISMATCH","利润表与现金流表的公司、报告期或币种不一致。");
    if (date(cash.report_date_ms)>asOf) continue;
    const balance=balances.find(c=>c.period_end_ms===row.period_end_ms&&c.thscode===code&&c.currency==="CNY"&&date(c.report_date_ms)<=asOf);
    const values={ revenue:validateNumber(row.operating_income),parent_profit:validateNumber(row.parent_holder_net_profit),
      adjusted_profit:null,ocf:validateNumber(cash.act_cash_flow_net),roe:null,accounts_receivable:validateNumber(balance?.accounts_receivable),inventory:null };
    const source_fields={revenue:"operating_income",parent_profit:"parent_holder_net_profit",ocf:"act_cash_flow_net",accounts_receivable:"accounts_receivable"};
    records.push({company_code:code,company_name:code==="000333.SZ"?"美的集团":code==="000651.SZ"?"格力电器":"海尔智家",period,basis:"H1_YTD",currency:"CNY",published_at:published,
      source_id:sourceIds.income,field_source_ids:{ocf:sourceIds.cash,accounts_receivable:sourceIds.balance},source_fields,source_column:"data.item",values,raw_values:{...values}});
  }
  if (!records.length) throw new ProviderError("NO_COMPARABLE_PERIOD","接口没有可用的半年累计期数据。");
  return records;
}
export async function loadLive(plan, env, period, fetcher=fetch) {
  const dataset={mode:"fuyao_live",created_at:new Date().toISOString(),records:[],sources:[],issues:[],conflicts:[],valuations:[],prices:[]};
  if (!env.FUYAO_API_KEY) throw new ProviderError("KEY_MISSING","尚未配置扶摇金融数据凭证。公开财报模式可继续使用。");
  const source=(id,path,result)=>{dataset.sources.push({id,title:`扶摇 · ${path}`,url:result.url,page:null,unit:"元",retrieved_at:dataset.created_at});return id;};
  const codes=plan.dimensions.includes("industry")?["000333.SZ","000651.SZ","600690.SH"]:["000333.SZ"];
  for (const code of codes) {
    try {
      const params={thscode:code,period:"quarterly",limit:12};
      const inc=await fuyaoRequest("a-share/financials/income-statements",params,env.FUYAO_API_KEY,fetcher);
      const cf=await fuyaoRequest("a-share/financials/cash-flow-statements",params,env.FUYAO_API_KEY,fetcher);
      let balances=[];let balanceId;
      if(plan.dimensions.includes("quality"))try {
        const bal=await fuyaoRequest("a-share/financials/balance-sheets",params,env.FUYAO_API_KEY,fetcher);
        balanceId=source(`${code}-balance`,"资产负债表",bal);balances=bal.body.data.item;
      }catch(e){dataset.issues.push(e.message);}
      const ids={income:source(`${code}-income`,"利润表",inc),cash:source(`${code}-cash`,"现金流量表",cf),balance:balanceId};
      dataset.records.push(...normalizeFinancials(inc.body.data.item,cf.body.data.item,balances,code,ids));
    } catch(e) {if(code==="000333.SZ")throw e;dataset.issues.push(`${code}：${e.message}`);}
  }
  if (!dataset.records.some(r=>r.company_code==="000333.SZ"&&r.period===period)) throw new ProviderError("PERIOD_MISSING","授权接口没有所选报告期。未自动混用其他期次。");
  if (plan.dimensions.includes("valuation")) try {
    const r=await fuyaoRequest("a-share/valuations/snapshot",{thscodes:codes.join(",")},env.FUYAO_API_KEY,fetcher);
    const sid=source("valuations","估值",r);const d=date(r.body.data.timestamp);
    if(freshness(d,new Date(),7)!=="CURRENT")throw new ProviderError("STALE","估值时间缺失或距今超过七天，已停止估值比较。");
    dataset.valuations=normalizeValuations(r.body.data.item,codes,sid,d);
    for(const code of codes.filter(code=>!dataset.valuations.some(v=>v.thscode===code)))dataset.issues.push(`${code}：估值快照未返回该公司，无法比较。`);
  }catch(e){dataset.issues.push(e.message);}
  if (plan.dimensions.includes("market")) try {
    const end=Date.now(),start=end-180*86400000;
    const r=await fuyaoRequest("a-share/prices/historical",{thscode:"000333.SZ",interval:"1d",start,end,adjust:"forward"},env.FUYAO_API_KEY,fetcher);
    dataset.market_source_id=source("prices","前复权日线",r);dataset.adjustment="前复权（扶摇 forward）";
    dataset.prices=r.body.data.item.map(p=>({date:date(p.date_ms),close:validateNumber(p.close_price)})).sort((a,b)=>a.date.localeCompare(b.date));
    marketStats(dataset.prices);
    if (freshness(dataset.prices.at(-1).date,new Date(),14)!=="CURRENT")throw new ProviderError("STALE","行情末日距今超过十四天，已停止区间统计。");
  }catch(e){dataset.prices=[];dataset.issues.push(e.message);}
  return dataset;
}
