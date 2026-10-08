import { runtimeEnv,runtimeDatabase } from "@/lib/runtime-env";
import { modelReady,modelProvider } from "@/lib/research/llm.mjs";
export async function GET() {const e=runtimeEnv();return Response.json({financial_configured:!!e.FUYAO_API_KEY,model_configured:modelReady(e),model_provider:e.LLM_API_KEY?modelProvider(e):null,model:e.LLM_API_KEY?e.LLM_MODEL??null:null,verification:"per_request",shared_rate_limit:!!runtimeDatabase(),access_protected:!!e.RESEARCH_ACCESS_CODE},{headers:{"Cache-Control":"no-store"}});}
