import {limitError,estimateModelTokens} from "./limits.mjs";
const CONSUME=`INSERT INTO research_quotas(bucket,used,expires_at) VALUES(?,?,?)
 ON CONFLICT(bucket) DO UPDATE SET used=research_quotas.used+excluded.used
 WHERE research_quotas.used+excluded.used<=?`;
const LEASE=`INSERT INTO research_leases(name,owner,expires_at) VALUES(?,?,?)
 ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at
 WHERE research_leases.expires_at<=?`;
export function createSharedGuard(database,secret,{clock=Date.now,network=fetch}={}) {
  if(!database)throw Object.assign(new Error("共享额度保护未就绪，模型调用已停止。"),{code:"QUOTA_UNAVAILABLE"});
  const db=database.withSession?.("first-primary")??database;
  async function checked(action){try{return await action();}catch(e){if(e.code==="MODEL_RATE_LIMITED")throw e;throw Object.assign(new Error("额度保护服务暂时不可用，模型调用已停止。"),{code:"QUOTA_UNAVAILABLE"});}}
  function windowKey(scope,ms,now=clock()){const start=Math.floor(now/ms)*ms;return {key:`${scope}:${start}`,expires:start+ms,seconds:(start+ms-now)/1000};}
  async function consume(scope,cost,limit,ms,message) {
    if(cost>limit)throw limitError("证据上下文超过免费模型保护预算，请缩短问题或开启新的研究。",60);
    const w=windowKey(scope,ms);const r=await checked(()=>db.prepare(CONSUME).bind(w.key,cost,w.expires,limit).run());
    if(r.meta.changes!==1)throw limitError(message,w.seconds);return {...w,cost};
  }
  async function ipKey(ip){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret+"\0"+ip));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");}
  async function entry(ip) {
    await checked(()=>db.prepare("DELETE FROM research_quotas WHERE bucket IN (SELECT bucket FROM research_quotas WHERE expires_at<? ORDER BY expires_at LIMIT 100)").bind(clock()).run());
    await consume("entry:global",1,30,60000,"站点请求过于频繁，请稍后重试。");
    await consume(`entry:ip:${await ipKey(ip)}`,1,8,60000,"请求过于频繁，请稍后重试。");
  }
  async function acquire(ip) {
    const hash=await ipKey(ip),now=clock(),owner=crypto.randomUUID();
    const r=await checked(()=>db.prepare(LEASE).bind("model-research",owner,now+120000,now).run());
    if(r.meta.changes!==1)throw limitError("模型正在处理其他研究，请稍后再试。",5);
    const release=()=>checked(()=>db.prepare("DELETE FROM research_leases WHERE name=? AND owner=?").bind("model-research",owner).run());
    try {
      await consume(`research:ip:${hash}`,1,3,60000,"研究请求过于频繁，请稍后重试。");
      await consume(`research-day:ip:${hash}`,1,40,86400000,"今日研究次数达到保护上限。");
      await consume("research:global",1,6,60000,"站点研究请求过于频繁，请稍后重试。");
      await consume("research-day:global",1,100,86400000,"今日站点研究次数达到保护上限。");
      return release;
    }catch(e){await release();throw e;}
  }
  async function modelFetch(url,init) {
    // This wrapper is passed only to the LLM adapter, not financial data requests.
    const cooldown=await checked(()=>db.prepare("SELECT expires_at FROM research_leases WHERE name=?").bind("model-cooldown").first());
    if(cooldown?.expires_at>clock())throw limitError("模型免费额度正在冷却，请稍后重试。",(cooldown.expires_at-clock())/1000);
    const payload=JSON.parse(init.body),estimate=estimateModelTokens(payload.messages,payload.max_completion_tokens??payload.max_tokens??2000);
    const minute=await consume("tokens:minute",estimate,7200,60000,"模型分钟 Token 预算暂时不足，请稍后重试。");
    const day=await consume("tokens:day",estimate,150000,86400000,"今日模型 Token 保护预算已用完。");
    const response=await network(url,init);
    if(response.status===429){const seconds=Math.min(86400,Math.max(30,Number(response.headers.get("retry-after"))||60));
      await checked(()=>db.prepare("INSERT INTO research_leases(name,owner,expires_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET expires_at=MAX(research_leases.expires_at,excluded.expires_at)").bind("model-cooldown","quota",clock()+seconds*1000).run());
    }
    if(response.ok){let body;try{body=await response.clone().json();}catch{return response;}
      const actual=body.usage?.total_tokens;
      if(Number.isFinite(actual)&&actual>=0){const delta=actual-estimate;
        await checked(()=>db.batch([minute,day].map(w=>db.prepare("UPDATE research_quotas SET used=MAX(0,used+?) WHERE bucket=?").bind(delta,w.key))));
      }
    }
    return response;
  }
  return {entry,acquire,modelFetch};
}
