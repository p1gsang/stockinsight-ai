// Check source selected by Git and built assets without printing matching content.
import {readFileSync,readdirSync,existsSync,statSync} from "node:fs";
import {execFileSync} from "node:child_process";
import path from "node:path";
const privateValues=existsSync(".env.local")?readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>/^(LLM_API_KEY|FUYAO_API_KEY|RESEARCH_ACCESS_CODE)=/.test(line)).map(line=>line.slice(line.indexOf("=")+1)).filter(value=>value.length>15):[];
const files=new Set(execFileSync("git",["ls-files","-c","-o","--exclude-standard"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean));
function walk(dir){if(!existsSync(dir))return;for(const item of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(item.isFile())files.add(file);}}
walk("dist");
const matches=[];for(const file of files){if(!existsSync(file)||!statSync(file).isFile())continue;const data=readFileSync(file);if(privateValues.some(value=>data.includes(Buffer.from(value)))||/gsk_[A-Za-z0-9_-]{30,}/.test(data.toString("utf8")))matches.push(file);}
if(matches.length){console.error(JSON.stringify({secret_check:"FAILED",files:matches}));process.exitCode=1;}else console.log(JSON.stringify({secret_check:"passed",files_checked:files.size,private_values_compared:privateValues.length}));
