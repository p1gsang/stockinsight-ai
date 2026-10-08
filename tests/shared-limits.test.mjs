import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createSharedGuard} from "../lib/research/shared-limits.mjs";
function database() {
  const sqlite=new DatabaseSync(":memory:");sqlite.exec(readFileSync(new URL("../drizzle/0000_graceful_sentry.sql",import.meta.url),"utf8"));
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            async run() {
              const result = stmt.run(...values);
              return {meta: {changes: Number(result.changes)}};
            },
            async first() { return stmt.get(...values) ?? null; }
          };
        }
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  };
  return {db,sqlite};
}
test("independent request handlers share IP limits; expiry permits later requests",async()=>{
  const {db,sqlite}=database();let now=Date.parse("2026-10-08T12:00:01Z");
  for(let i=0;i<8;i++)await createSharedGuard(db,"TEST_ONLY",{clock:()=>now}).entry("same-ip");
  await assert.rejects(createSharedGuard(db,"TEST_ONLY",{clock:()=>now}).entry("same-ip"),/频繁/);now+=60000;
  await createSharedGuard(db,"TEST_ONLY",{clock:()=>now}).entry("same-ip");
  assert.ok(sqlite.prepare("SELECT bucket FROM research_quotas").all().every(r=>!r.bucket.includes("same-ip")));sqlite.close();
});
test("rotating IPs cannot bypass shared global entry limit",async()=>{
  const {db,sqlite}=database();for(let i=0;i<30;i++)await createSharedGuard(db,"TEST_ONLY").entry(`ip-${i}`);
  await assert.rejects(createSharedGuard(db,"TEST_ONLY").entry("different-ip"),/站点请求/);sqlite.close();
});
test("shared research lease survives handler recreation and releases only its owner",async()=>{
  const {db,sqlite}=database();let now=Date.parse("2026-10-08T12:00:01Z");const a=createSharedGuard(db,"TEST_ONLY",{clock:()=>now}),b=createSharedGuard(db,"TEST_ONLY",{clock:()=>now});
  const release=await a.acquire("a");await assert.rejects(b.acquire("b"),/正在处理/);now+=120001;
  const releaseB=await b.acquire("b");await release();await assert.rejects(a.acquire("c"),/正在处理/);await releaseB();const releaseFinal=await a.acquire("c");await releaseFinal();sqlite.close();
});
test("shared Token reservation settles usage and denies excess before network transmission",async()=>{
  const {db,sqlite}=database();let calls=0;const network=async()=>{calls++;return Response.json({usage:{total_tokens:100}});};
  const request={body:JSON.stringify({messages:[{role:"user",content:"核验"}],max_completion_tokens:2000})};
  await createSharedGuard(db,"TEST_ONLY",{network}).modelFetch("https://example.com",request);
  assert.deepEqual(sqlite.prepare("SELECT used FROM research_quotas ORDER BY bucket").all().map(r=>r.used),[100,100]);
  await assert.rejects(createSharedGuard(db,"TEST_ONLY",{network}).modelFetch("https://example.com",{body:JSON.stringify({messages:[],max_completion_tokens:8000})}),/上下文/);assert.equal(calls,1);sqlite.close();
});
test("provider 429 cooldown is shared by new handlers",async()=>{
  const {db,sqlite}=database();let calls=0;const network=async()=>{calls++;return new Response("{}",{status:429,headers:{"retry-after":"45"}});};const init={body:JSON.stringify({messages:[],max_completion_tokens:100})};
  await createSharedGuard(db,"TEST_ONLY",{network}).modelFetch("https://example.com",init);
  await assert.rejects(createSharedGuard(db,"TEST_ONLY",{network}).modelFetch("https://example.com",init),/冷却/);assert.equal(calls,1);sqlite.close();
});
test("missing or failed shared database fails closed",async()=>{
  assert.throws(()=>createSharedGuard(null,"TEST_ONLY"),/未就绪/);
  const broken={prepare(){throw new Error("DATABASE PRIVATE DETAILS");}};await assert.rejects(createSharedGuard(broken,"TEST_ONLY").entry("a"),e=>e.code==="QUOTA_UNAVAILABLE"&&!e.message.includes("PRIVATE"));
});
