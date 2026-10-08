import ResearchApp from "@/components/research-app";
import { research } from "@/lib/research/service.mjs";
import type { ResearchResult } from "@/lib/types";
import { runtimeEnv } from "@/lib/runtime-env";
import { modelReady,modelProvider } from "@/lib/research/llm.mjs";
export default async function Home() {
  const result=await research({question:"美的集团最近的利润增长是否得到了现金流支持？",period:"2026-06-30",mode:"snapshot"});
  const env=runtimeEnv();
  if(modelReady(env)&&result.model_usage&&result.warnings) {
    result.model_state="not_called";
    result.model_usage.provider=modelProvider(env);result.model_usage.model=env.LLM_MODEL;
    result.warnings=result.warnings.filter((w:string)=>!w.startsWith("真实语言模型尚未启用"));
    result.warnings.push("初始摘要由规则生成。真实 AI 已配置，填写站点访问口令并开始研究后，才按实际调用显示成功或失败。");
  }
  return <ResearchApp initial={result as unknown as ResearchResult}/>;
}
