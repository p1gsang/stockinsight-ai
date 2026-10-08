// Offline routing verification; real snapshot evidence, no network or model calls.
import {writeFile,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {research} from "../lib/research/service.mjs";
import {validQuestions,outsideQuestions,restrictedQuestions,uiQuestions} from "../tests/fixtures/question-routing.mjs";
const results=[];
for(const [questions,expected] of [[validQuestions,"ok"],[outsideQuestions,"out_of_scope"],[restrictedQuestions,"restricted"]])for(const question of questions){
  const result=await research({question},{});results.push({question,expected,actual:result.status,passed:result.status===expected,ui_shortcut:uiQuestions.includes(question)});
}
const hashes={};for(const file of ["lib/research/planner.mjs","lib/research/question-catalog.mjs","lib/research/service.mjs","tests/fixtures/question-routing.mjs"]){hashes[file]=createHash("sha256").update(await readFile(new URL(`../${file}`,import.meta.url))).digest("hex");}
const report={verified_at:new Date().toISOString(),mode:"offline_rules_with_real_public_snapshot",model_calls:0,network_calls:0,source_sha256:hashes,total:results.length,passed:results.filter(r=>r.passed).length,ui_shortcuts:uiQuestions.length,results};
await writeFile(new URL("../docs/question-routing-verification.json",import.meta.url),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({total:report.total,passed:report.passed,ui_shortcuts:report.ui_shortcuts,model_calls:0,failures:results.filter(r=>!r.passed)}));
if(report.passed!==report.total)process.exitCode=1;
