// These guards are local to a Worker isolate. The provider enforces account-wide quotas.
export function limitError(message,seconds=60) {
  return Object.assign(new Error(message),{code:"MODEL_RATE_LIMITED",retryAfter:Math.max(1,Math.ceil(seconds))});
}
export function createResearchGate({clock=Date.now,ipMinute=3,ipDay=40,globalMinute=6,globalDay=100,maxIPs=5000}={}) {
  const ips=new Map();let day="",totalDay=0;let recent=[];let active=0;
  return {acquire(ip) {
    const now=clock(),today=new Date(now).toISOString().slice(0,10);
    if(today!==day){day=today;totalDay=0;ips.clear();}
    recent=recent.filter(at=>now-at<60000);
    let slot=ips.get(ip);
    if(!slot){if(ips.size>=maxIPs)throw limitError("访问量达到保护上限，请稍后重试。",3600);slot={recent:[],day:0};ips.set(ip,slot);}
    slot.recent=slot.recent.filter(at=>now-at<60000);
    if(slot.day>=ipDay||totalDay>=globalDay)throw limitError("今日研究次数达到保护上限，请明天重试。",86400-(now%86400000)/1000);
    if(slot.recent.length>=ipMinute||recent.length>=globalMinute)throw limitError("研究请求过于频繁，请稍后再试。",60);
    if(active)throw limitError("模型正在处理其他研究，请稍后再试。",5);
    slot.recent.push(now);slot.day++;recent.push(now);totalDay++;active++;
    let released=false;return ()=>{if(!released){released=true;active--;}};
  }};
}
export function estimateModelTokens(messages,maxOutput) {
  const text=JSON.stringify(messages),cjk=(text.match(/[\u3400-\u9fff]/g)||[]).length;
  // Conservative admission estimate, not an exact tokenizer or a billing calculation.
  return Math.ceil(cjk*1.5+(text.length-cjk)/3+128+maxOutput);
}
export function createModelBudget({clock=Date.now,minuteTokens=7200,dailyTokens=150000}={}) {
  let recent=[],day="",usedDay=0;
  return {reserve(tokens) {
    const now=clock(),today=new Date(now).toISOString().slice(0,10);
    if(day!==today){day=today;usedDay=0;}
    recent=recent.filter(entry=>now-entry.at<60000);
    if(tokens>minuteTokens)throw limitError("证据上下文超过免费模型的单次保护预算，请缩短问题或开启新的研究。",60);
    if(usedDay+tokens>dailyTokens)throw limitError("今日模型 Token 保护预算已用完，请明天重试。",86400-(now%86400000)/1000);
    if(recent.reduce((sum,e)=>sum+e.tokens,0)+tokens>minuteTokens)throw limitError("模型 Token 保护预算暂时不足，请稍后重试。",Math.max(1,60-(now-recent[0].at)/1000));
    const entry={at:now,tokens};recent.push(entry);usedDay+=tokens;
    let settled=false;return {settle(actual){if(settled)return;settled=true;if(Number.isFinite(actual)&&actual>=0){usedDay+=actual-entry.tokens;entry.tokens=actual;}}};
  }};
}
