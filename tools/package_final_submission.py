"""Package committed source and real evidence; never copies env/cache/dependencies.

Run --preflight before publishing, then --output-dir DIR --public-commit SHA.
Refuses to overwrite an existing submission directory, ZIP or receipt.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OFFICIAL = ['README.md', 'SUBMISSION.md', 'PRODUCT_DESIGN.md', 'DATA_SOURCES.md',
            'LIMITATIONS.md', 'CANDIDATE_REVIEW_CHECKLIST.md', 'TEST_REPORT.md',
            'AI_USAGE_AND_VALIDATION.md', 'AUTO_AUDIT_REPORT.md', 'DEPLOYMENT.md']
PATTERNS = {
    'groq_key': rb'gsk_[A-Za-z0-9_-]{25,}',
    'openai_key': rb'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}',
    'google_key': rb'AIza[A-Za-z0-9_-]{30,}',
    'github_token': rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'private_key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'jwt': rb'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}',
    'raw_auth_header': rb'(?i)["\x27](?:authorization|cookie|x-research-access)["\x27]\s*:\s*["\x27](?:Bearer )?[A-Za-z0-9_.=;/-]{24,}["\x27]',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def private_values():
    values = set()
    for name in ['.env.local', '.dev.vars']:
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text(encoding='utf-8-sig').splitlines():
            match = re.match(r'^([A-Z_]+)=(.*)$', line)
            if match and re.search(r'KEY|CODE|TOKEN|SECRET|PASSWORD|COOKIE', match[1]):
                value = match[2].strip().strip('"\x27')
                if len(value) > 8:
                    values.add(value.encode())
    return values


def forbidden(name):
    parts = pathlib.PurePosixPath(name.replace('\\', '/')).parts
    return (any(p in {'node_modules', '.git', '.sites-runtime', '.wrangler', '.next', '.vinext', '__pycache__', '.pytest_cache'} for p in parts)
            or any(p.startswith('.env') and p != '.env.example' for p in parts)
            or any(p.startswith('.dev.vars') for p in parts)
            or name.lower().endswith(('.pdf', '.pem', '.pfx', '.key', '.sqlite', '.db', '.tar.gz')))


def scan(entries):
    secrets = private_values()
    findings = []
    for name, data in entries:
        kinds = [kind for kind, pattern in PATTERNS.items() if re.search(pattern, data)]
        if any(value in data for value in secrets):
            kinds.append('exact_current_private_value')
        if forbidden(name):
            kinds.append('forbidden_private_or_generated_path')
        if kinds:
            findings.append({'file': name, 'kinds': kinds})
    return {'checked_at': datetime.now(timezone.utc).isoformat(), 'status': 'FAIL' if findings else 'PASS',
            'files_checked': len(entries), 'exact_private_values_compared': len(secrets), 'findings': findings,
            'method': 'Exact locally configured secret values plus provider/auth patterns and forbidden paths; matched content never recorded',
            'scope_limit': 'Not a penetration test, all-secret proof, rights clearance or deletion of historical external logs. Retired site code was rotated in prior repair.'}


def local_links(directory, names):
    missing = []
    count = 0
    for name in names:
        p = directory / name
        for target in re.findall(r'\]\(([^)]+)\)', p.read_text(encoding='utf-8-sig')):
            target = target.strip('<>').split('#')[0]
            if not target or re.match(r'^[a-zA-Z][\w+.-]*:|^/', target):
                continue
            count += 1
            if not (p.parent / target).exists():
                missing.append({'file': name, 'target': target})
    return {'status': 'FAIL' if missing else 'PASS', 'local_links_checked': count, 'missing': missing,
            'external_links': 'Product/GitHub separately checked over HTTPS; four PDF sources checked by independent audit. Not every historical external documentation URL was re-fetched.'}


def remap_links(text, prefix, original_parent=''):
    def replace(m):
        value = m[1]
        if re.match(r'^[a-zA-Z][\w+.-]*:|^[/#]', value):
            return m[0]
        return '](' + prefix + original_parent + value + ')'
    return re.sub(r'\]\(([^)]+)\)', replace, text)


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preflight', action='store_true')
    parser.add_argument('--output-dir', type=pathlib.Path)
    parser.add_argument('--public-commit')
    args = parser.parse_args()
    if args.preflight:
        names = git('ls-files', '-c', '-o', '--exclude-standard', '-z').decode().split('\0')
        files = [(name, (ROOT / name).read_bytes()) for name in dict.fromkeys(names) if name and (ROOT / name).is_file()]
        result = scan(files)
        result['links'] = local_links(ROOT, OFFICIAL + ['docs/final-submission/DEMO_SCRIPT.md'])
        print(json.dumps(result, ensure_ascii=False))
        return 1 if result['status'] != 'PASS' or result['links']['status'] != 'PASS' else 0
    if not args.output_dir or not args.public_commit:
        parser.error('Package requires --output-dir and --public-commit')
    target = args.output_dir.resolve()
    archive = target.with_suffix('.zip')
    receipt_path = target.parent / (target.name + '_validation.json')
    if any(p.exists() for p in [target, archive, receipt_path]):
        raise SystemExit('Output already exists; refusing to overwrite previous work')
    if git('status', '--porcelain').strip():
        raise SystemExit('Commit source before packaging; working tree must be clean')
    commit = git('rev-parse', 'HEAD').decode().strip()
    tree = git('rev-parse', 'HEAD^{tree}').decode().strip()
    names = [name for name in git('ls-tree', '-r', '--name-only', '-z', 'HEAD').decode().split('\0') if name]
    source = [(name, git('show', 'HEAD:' + name)) for name in names]
    source_scan = scan(source)
    if source_scan['status'] != 'PASS':
        print(json.dumps(source_scan)); return 1
    for child in ['source_code', 'docs', 'evidence/current', 'demo']:
        (target / child).mkdir(parents=True, exist_ok=False)
    for name, data in source:
        p = target / 'source_code' / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    for name in OFFICIAL:
        if name != 'README.md':
            text = (target / 'source_code' / name).read_text(encoding='utf-8-sig')
            (target / 'docs' / name).write_text(remap_links(text, '../source_code/'), encoding='utf-8')
    text = (target / 'source_code/SUBMISSION.md').read_text(encoding='utf-8-sig')
    (target / 'SUBMISSION.md').write_text(remap_links(text, 'source_code/'), encoding='utf-8')
    for p in (target / 'source_code/docs/final-validation').iterdir():
        if p.is_file():
            destination = target / 'evidence/current' / p.name
            if p.suffix == '.md':
                destination.write_text(remap_links(p.read_text(encoding='utf-8-sig'), '../../source_code/docs/final-validation/'), encoding='utf-8')
            else:
                destination.write_bytes(p.read_bytes())
    (target / 'demo/DEMO_SCRIPT.md').write_bytes((target / 'source_code/docs/final-submission/DEMO_SCRIPT.md').read_bytes())
    (target / 'demo/README.md').write_text('视频未录制，仅提供 120 秒实际操作脚本。当前真实 Groq 完整解释遇日额度 429，不得用脚本或截图冒充视频/模型成功。\n', encoding='utf-8')
    (target / 'docs/README.md').write_text('本目录是主要文档的便捷副本；链接回到 source_code 中的完整原版，避免截断历史证据。最终入口见 ../SUBMISSION.md。\n', encoding='utf-8')
    (target / 'evidence/README.md').write_text('current/ 为本轮真实重跑日志、HTTP 响应、独立复算和截图。历史原始失败及修复证据完整保留于 source_code/docs/auto-audit 和 source_code/docs/repair-validation；没有冒充本轮重跑。SECURITY_SCAN.json 是有限敏感信息检查，不是安全认证。\n', encoding='utf-8')
    (target / 'README.md').write_text('''# StockInsight AI 最终提交包

同花顺 2027 届校园招聘 · AI 产品经理（AIME 金融智能 Agent 方向） · 题目 03。

请先阅读 [SUBMISSION.md](SUBMISSION.md)。公网：https://stockinsight-midea-research.eagercomet2.chatgpt.site/ 。源码主入口：https://github.com/p1gsang/stockinsight-ai 。

本包以最终 Git 提交归档，生产功能保持版本 19；之后只有文档、审计工具及日志变更。Groq 已真实接入，本次规划成功、解释因 TPD 429 失败，完整 AI 主链路 FAIL；行情/估值未接入。详见 [限制](docs/LIMITATIONS.md)。

## 本地运行

Node >=22.13，建议 24 LTS；安装 Node 时需包含 npm。进入 source_code 后运行：

```powershell
cd source_code
npm ci
npm run dev
# http://127.0.0.1:5173/
```

无密钥可用真实公开财报快照与规则研究。启用真实 LLM 需复制 .env.example 到 .env.local，安全填写服务端变量，再运行 python tools/configure_local.py 创建本地 .dev.vars；本地模型 HTTP 另需 npm run db:local。生产 Secrets 不在包内；不在前端填写 API Key。

```powershell
npm test
npm run typecheck
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

原始 PDF 不随包分发；新环境原文 pytest 会明确 skip，先运行 python tools/collect_reports.py 和 python tools/enrich_reports.py 可核验。独立审计另安装 requirements-audit.txt。完整架构、变量、口径和环境限制见 [源码 README](source_code/README.md)。本轮复用已安装依赖，没有冒称全新 npm 安装通过。

## 包内目录

- source_code/：Git 归档的完整源码、锁文件、安全环境变量示例和历史证据。
- docs/：正式说明、AI/测试/审计报告与约 12 分钟本人清单。
- evidence/current/：本次实际执行日志、脱敏响应和两张真实浏览器截图。
- demo/：120 秒演示脚本；视频未录制。
- MANIFEST.sha256：文件完整性校验；PACKAGE_RECEIPT.json：源码与公开仓库版本映射。

独立评审口令须通过私下授权渠道交付，不在此包。候选人本人审核尚待签认；ZIP 是补充备份，源码仓库是主要交付入口。
''', encoding='utf-8')
    write_json(target / 'PACKAGE_RECEIPT.json', {'generated_at': datetime.now(timezone.utc).isoformat(), 'timezone': 'America/New_York',
        'local_source_commit': commit, 'local_source_tree': tree, 'public_github_commit': args.public_commit,
        'public_repo': 'https://github.com/p1gsang/stockinsight-ai', 'production_version': 19,
        'production_source_commit': 'd1ff590263af946fa48b4f419914ff877550122f', 'source_files': len(source),
        'source_archive_method': 'Every tracked blob read with git show HEAD:path; canonical bytes, no untracked private files',
        'live_llm_acceptance': 'FAIL: Groq plan success, analysis 429 / TPD', 'candidate_review': 'NOT TESTED', 'video': 'NOT TESTED'})
    bundle_files = [(p.relative_to(target).as_posix(), p.read_bytes()) for p in target.rglob('*') if p.is_file()]
    bundle_scan = scan(bundle_files)
    if bundle_scan['status'] != 'PASS':
        print(json.dumps(bundle_scan)); return 1
    write_json(target / 'evidence/SECURITY_SCAN.json', {'source': source_scan, 'package_payload': bundle_scan})
    link_names = [p.relative_to(target).as_posix() for p in target.rglob('*.md') if not p.relative_to(target).as_posix().startswith('source_code/')]
    links = local_links(target, link_names)
    if links['status'] != 'PASS':
        print(json.dumps(links)); return 1
    write_json(target / 'evidence/LINK_CHECKS.json', links)
    files = sorted([p for p in target.rglob('*') if p.is_file()])
    manifest = {p.relative_to(target).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    (target / 'MANIFEST.sha256').write_text(''.join(f'{sha}  {name}\n' for name, sha in manifest.items()), encoding='utf-8')
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in sorted(target.rglob('*')):
            if p.is_file():
                z.write(p, target.name + '/' + p.relative_to(target).as_posix())
    with zipfile.ZipFile(archive) as z:
        corrupt = z.testzip()
        valid = corrupt is None and all(hashlib.sha256(z.read(target.name + '/' + name)).hexdigest() == sha for name, sha in manifest.items())
        archived_entries = [(name[len(target.name) + 1:], z.read(name)) for name in z.namelist()]
        archived_scan = scan(archived_entries)
        # Re-read all members, validating CRC/hash and path safety without extracting
        # or modifying the source/delivery folders.
        path_safe = all(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts for name in z.namelist())
        extraction_root = pathlib.Path(tempfile.mkdtemp(prefix='final-unzip-', dir=ROOT / '.sites-runtime')).resolve()
        if not extraction_root.is_relative_to((ROOT / '.sites-runtime').resolve()) or not path_safe:
            raise SystemExit('Unsafe extraction destination or archive member')
        z.extractall(extraction_root)
        extracted = all(hashlib.sha256((extraction_root / target.name / name).read_bytes()).hexdigest() == sha for name, sha in manifest.items())
    receipt = {'verified_at': datetime.now(timezone.utc).isoformat(), 'status': 'PASS' if valid and extracted and path_safe and archived_scan['status'] == 'PASS' else 'FAIL',
        'zip': str(archive), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'file_count': len(archived_entries), 'source_files': len(source), 'crc': 'PASS' if corrupt is None else 'FAIL',
        'all_manifest_hashes_match': valid, 'actual_extraction_verified': extracted, 'safe_member_paths': path_safe, 'archive_sensitive_scan': archived_scan,
        'local_links': links, 'source_commit': commit, 'source_tree': tree, 'public_commit': args.public_commit}
    write_json(receipt_path, receipt)
    print(json.dumps(receipt, ensure_ascii=False))
    return 0 if receipt['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
