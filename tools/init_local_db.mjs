// Apply the same checked-in migrations to Miniflare's local quota database.
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import path from "node:path";
const hosting=JSON.parse(readFileSync(".openai/hosting.json","utf8"));
if(!hosting.d1)throw new Error("No quota database binding is configured.");
mkdirSync(".sites-runtime",{recursive:true});
const config=path.resolve(".sites-runtime/local-database.json");
writeFileSync(config,JSON.stringify({name:"stockinsight-ai",compatibility_date:"2026-05-15",d1_databases:[{
  binding:hosting.d1,database_name:"site-creator-d1",database_id:"00000000-0000-4000-8000-000000000000",migrations_dir:path.resolve("drizzle")
}]}));
execFileSync(process.execPath,[path.resolve("node_modules/wrangler/bin/wrangler.js"),"d1","migrations","apply",hosting.d1,"--local","--persist-to",path.resolve(".wrangler/state"),"--config",config],
  {stdio:"inherit",env:{...process.env,CI:"true",WRANGLER_SEND_METRICS:"false"}});
