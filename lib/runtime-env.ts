import { AsyncLocalStorage } from "node:async_hooks";
const storage = new AsyncLocalStorage<Record<string, unknown>>();
export function runWithRuntimeEnv<T>(env: Record<string, unknown>, fn: () => T): T {return storage.run(env, fn);}
export function runtimeDatabase():D1Database|undefined {
  const db=storage.getStore()?.DB as D1Database|undefined;
  return db&&typeof db.prepare==="function"?db:undefined;
}
export function runtimeEnv(): Record<string, string> {
  const bound=storage.getStore()??{};
  const result:Record<string,string>={};
  for (const key of ["FUYAO_API_KEY","LLM_API_KEY","LLM_BASE_URL","LLM_MODEL","RESEARCH_ACCESS_CODE"]) {
    const v=bound[key]??process.env[key];if(typeof v==="string")result[key]=v;
  }
  return result;
}
