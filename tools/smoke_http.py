"""Run against an already-started app; no external financial/model calls."""
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError
BASE=os.environ.get("TEST_BASE_URL","http://127.0.0.1:5173")

def request(path,payload=None):
    req=Request(BASE+path,data=None if payload is None else json.dumps(payload).encode(),headers={"Content-Type":"application/json"})
    try:
        with urlopen(req,timeout=30) as r:return r.status,r.read()
    except HTTPError as e:return e.code,e.read()

def main():
    checks=[]
    code,body=request("/");assert code==200 and b"StockInsight" in body;checks.append("page renders")
    code,body=request("/api/status");assert code==200 and "financial_configured" in json.loads(body);checks.append("safe connection status")
    code,body=request("/api/research",{"question":"利润增长是否得到现金流支持？"});r=json.loads(body);assert code==200 and r["status"]=="ok";checks.append("research HTTP chain")
    selected=next(e["evidence_id"] for e in r["evidence"] if e["evidence_id"].endswith("cash-coverage"))
    code,body=request("/api/research",{"question":"差异的原因是什么？","context":{"dimensions":r["plan"]["dimensions"],"selected_ids":[selected],"history":r["history"]}})
    assert code==200 and selected in json.loads(body)["selected_ids"];checks.append("context followup")
    code,body=request("/api/research",{"question":"当前估值与同行如何？"});assert code==200 and json.loads(body)["plan"]["dimensions"]==["valuation","industry"];checks.append("dynamic plan")
    code,body=request("/api/research",{"question":"现在买入保证收益？"});assert code==200 and json.loads(body)["status"]=="restricted";checks.append("compliance")
    code,body=request("/api/research",{"question":"利润与现金流？","period":"2026-12-31"});assert code==400;checks.append("invalid period")
    code,body=request("/api/research",{"question":"利润与现金流？","mode":"live"});assert code==503 and json.loads(body)["code"]=="KEY_MISSING";checks.append("missing data key")
    print(json.dumps({"passed":len(checks),"checks":checks,"base_url":BASE},ensure_ascii=False))

if __name__=="__main__":main()
