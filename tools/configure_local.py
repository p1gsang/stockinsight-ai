"""Copy private .env.local to the Worker dev secrets file without logging values."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
src=ROOT/".env.local"
if not src.exists():raise SystemExit("Copy .env.example to .env.local and fill credentials locally first.")
allowed={"FUYAO_API_KEY","LLM_API_KEY","LLM_BASE_URL","LLM_MODEL","RESEARCH_ACCESS_CODE"}
lines=[]
for line in src.read_text(encoding="utf-8-sig").splitlines():
    if not line.strip() or line.lstrip().startswith("#"):continue
    key,sep,value=line.partition("=")
    if not sep or key.strip() not in allowed:raise SystemExit("Unexpected key or malformed local configuration; values were not logged.")
    lines.append(key.strip()+"="+value)
dest=ROOT/".dev.vars"
if dest.exists():raise SystemExit(".dev.vars already exists. Edit that private file directly; this helper will not overwrite it.")
dest.write_text("\n".join(lines)+"\n",encoding="utf-8")
print("Private Worker configuration created. Restart the development server. No values were logged.")
