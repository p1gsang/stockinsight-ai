import { research,requestSchema } from "@/lib/research/service.mjs";
import { runtimeEnv,runtimeDatabase } from "@/lib/runtime-env";
import { createSharedGuard } from "@/lib/research/shared-limits.mjs";
import { isRestricted,inResearchScope } from "@/lib/research/planner.mjs";
import { researchEnvelope } from "@/lib/research/access.mjs";
const windowByIP=new Map<string,{at:number;count:number}>();
export async function POST(request:Request) {
  const env=runtimeEnv();
  const size=Number(request.headers.get("content-length"));
  if(size>16000)return Response.json({error:"问题和上下文过长。"},{status:413});
  const ip=request.headers.get("cf-connecting-ip")??"local";
  const now=Date.now();let slot=windowByIP.get(ip);
  if(windowByIP.size>=5000){for(const [key,value]of windowByIP)if(now-value.at>=60000)windowByIP.delete(key);}
  if(!slot&&windowByIP.size>=10000)return Response.json({error:"访问量达到保护上限，请稍后再试。"},{status:429,headers:{"Retry-After":"60","Cache-Control":"no-store"}});
  if(!slot||now-slot.at>60000){slot={at:now,count:0};windowByIP.set(ip,slot);}
  if(++slot.count>8)return Response.json({error:"请求过于频繁，请稍后再试。"},{status:429,headers:{"Retry-After":"60","Cache-Control":"no-store"}});
  let release:(()=>Promise<unknown>)|undefined;
  try {
    const text=await request.text();if(text.length>16000)return Response.json({error:"上下文过长。"},{status:413});
    const envelope=researchEnvelope(JSON.parse(text),env.RESEARCH_ACCESS_CODE);
    const body=requestSchema.parse(envelope.input);
    const guard=env.LLM_API_KEY?createSharedGuard(runtimeDatabase(),env.RESEARCH_ACCESS_CODE??""):null;
    if(guard)await guard.entry(ip);
    if(body.mode==="live"&&!env.FUYAO_API_KEY)return Response.json({error:"尚未配置扶摇金融数据凭证。请选择公开财报快照，或由维护者配置服务端密钥。",code:"KEY_MISSING"},{status:503});
    if((env.LLM_API_KEY||body.mode==="live")&&!envelope.authorized)
      return Response.json({error:"此功能需要站点访问口令。请在连接设置中填写；口令用于保护已授权的数据和模型调用。"},{status:401});
    if(guard&&!isRestricted(body.question)&&inResearchScope(body.question))release=await guard.acquire(ip);
    return Response.json(await research(body,env,{...(guard?{modelFetcher:guard.modelFetch}:{}),
      onModelCall:(call:{stage:string;provider:string;model:string;response_id:string|null;called_at:string;usage:unknown;http_status?:number;error_code?:string;error_type?:string})=>console.info(JSON.stringify({event:"llm_provider_call",...call}))}),{headers:{"Cache-Control":"no-store"}});
  }catch(error:unknown){
    const e=error as {name?:string;message?:string;code?:string;retryAfter?:number};
    return Response.json({error:e.name==="ZodError"?"请求格式或期次无效，请检查输入。":e.message??"研究失败，未生成结论。",code:e.code??"RESEARCH_ERROR"},{status:e.code==="QUOTA_UNAVAILABLE"?503:e.code==="MODEL_RATE_LIMITED"?429:e.code==="INVALID_CONTEXT"||e.name==="ZodError"||e.name==="SyntaxError"?400:502,headers:{"Cache-Control":"no-store",...(e.retryAfter?{"Retry-After":String(e.retryAfter)}:{})}});
  }finally{if(release)try{await release();}catch{console.error("Quota lease release failed; expiry remains enforced.");}}
}
