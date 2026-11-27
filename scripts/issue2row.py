# -*- coding: utf-8 -*-
"""把一条 Issue（Issue Forms 提交的标注）解析成一行数据，追加进 data/papers.csv，并重新生成 papers.js。

用法（GitHub Actions 里由 .github/workflows/publish.yml 调用）：
    ISSUE_BODY_FILE=issue.md ISSUE_AUTHOR=someone python scripts/issue2row.py

环境变量：
    ISSUE_BODY_FILE  Issue 正文文件（优先）
    ISSUE_BODY       Issue 正文文本（没有文件时用）
    ISSUE_AUTHOR     提交人 GitHub 用户名
    DRY_RUN=1        只解析、打印结果，不写文件

退出码：0 成功；1 数据不合规（不写入）；2 这篇已经收录过（不写入）。
"""

import csv
import io
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "papers.csv"

COLS = [
    "id", "title", "journal", "year", "doi", "paper_type", "plant", "ctrl_type",
    "m1_model", "m2_deriv", "m3_struct", "m4_params", "m5_simset", "m6_plot",
    "repro", "notes", "annotator", "date",
]
SCORE_COLS = COLS[8:14]
NO_RESPONSE = "_No response_"

# 标题前缀 → 字段。按顺序匹配，先匹配到的赢
HEAD_MAP = [
    ("论文标题", "title"),
    ("期刊", "journal"),
    ("年份", "year"),
    ("DOI", "doi"),
    ("论文类型", "paper_type"),
    ("被控对象", "plant"),
    ("控制方法", "ctrl_type"),
    ("总评", "repro"),
    ("备注", "notes"),
]


def die(msg, code=1):
    print("[失败] " + msg)
    raise SystemExit(code)


def read_body():
    path = os.environ.get("ISSUE_BODY_FILE", "").strip()
    if path:
        return Path(path).read_text(encoding="utf-8")
    return os.environ.get("ISSUE_BODY", "")


def split_sections(body):
    """GitHub Issue Forms 的正文是若干「### 标题 + 内容」块。"""
    sections = []
    cur_head, cur_lines = None, []
    for line in body.replace("\r\n", "\n").split("\n"):
        if line.startswith("### "):
            if cur_head is not None:
                sections.append((cur_head.strip(), "\n".join(cur_lines).strip()))
            cur_head, cur_lines = line[4:], []
        else:
            cur_lines.append(line)
    if cur_head is not None:
        sections.append((cur_head.strip(), "\n".join(cur_lines).strip()))
    return sections


def clean_value(v):
    v = (v or "").strip()
    if v == NO_RESPONSE:
        return ""
    v = re.sub(r"<!--.*?-->", "", v, flags=re.S).strip()
    return v


def parse(body):
    row = {}
    for head, value in split_sections(body):
        value = clean_value(value)
        m = re.match(r"^m([1-6])\b", head)
        if m:
            key = SCORE_COLS[int(m.group(1)) - 1]
            row[key] = value.split()[0].upper() if value.split() else ""
            continue
        for prefix, key in HEAD_MAP:
            if head.startswith(prefix):
                row[key] = value
                break
    return row


def validate(row):
    problems = []
    for k in ("title", "journal", "year", "paper_type", "plant", "ctrl_type", "repro"):
        if not row.get(k):
            problems.append("缺少「%s」" % k)
    for k in SCORE_COLS:
        if row.get(k) not in ("2", "1", "0", "NA"):
            problems.append("%s 的取值 %r 不在 2/1/0/NA 里" % (k, row.get(k)))
    if row.get("year") and not re.match(r"^\d{4}$", row["year"]):
        problems.append("年份 %r 不是 4 位数字" % row["year"])
    if row.get("paper_type") and row["paper_type"] not in ("仿真", "实验", "工程"):
        problems.append("论文类型 %r 只能是 仿真/实验/工程" % row["paper_type"])
    if row.get("repro") and row["repro"] not in ("能", "存疑", "不能"):
        problems.append("总评 %r 只能是 能/存疑/不能" % row["repro"])
    if problems:
        die("；".join(problems))


def norm_title(s):
    return re.sub(r"\s+", "", (s or "")).lower()


def load_csv():
    text = CSV_PATH.read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    head, body = rows[0], rows[1:]
    if head != COLS:
        die("papers.csv 的表头和脚本里的 COLS 对不上")
    return body


def next_id(body):
    nums = [int(m.group(1)) for m in (re.match(r"^S(\d+)$", r[0]) for r in body if r) if m]
    return "S%03d" % (max(nums) + 1 if nums else 1)


def write_csv(body):
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\r\n").writerows([COLS] + body)
    CSV_PATH.write_text(buf.getvalue(), encoding="utf-8-sig")


def main():
    body_text = read_body()
    if not body_text.strip():
        die("没有拿到 Issue 正文")

    row = parse(body_text)
    validate(row)

    body = load_csv()
    if any(norm_title(r[1]) == norm_title(row["title"]) for r in body if len(r) > 1):
        print("[跳过] 这篇已经收录过：%s" % row["title"])
        raise SystemExit(2)

    item = {
        "id": next_id(body),
        "title": row["title"],
        "journal": row["journal"],
        "year": row["year"],
        "doi": row.get("doi") or "无",
        "paper_type": row["paper_type"],
        "plant": row["plant"],
        "ctrl_type": row["ctrl_type"],
        "repro": row["repro"],
        "notes": row.get("notes") or "无",
        "annotator": os.environ.get("ISSUE_AUTHOR", "").strip() or "GitHub 提交",
        "date": date.today().isoformat(),
    }
    for k in SCORE_COLS:
        item[k] = row[k]

    new = [item[c] for c in COLS]
    print("解析结果：")
    for c in COLS:
        print("  %-12s %s" % (c, item[c]))

    if os.environ.get("DRY_RUN") == "1":
        print("\n[DRY_RUN] 没有写文件")
        return

    body.append(new)
    write_csv(body)

    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "csv2js.py")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(r.stdout)
    if r.returncode != 0:
        print(r.stderr)
        die("csv2js.py 校验没过，请检查数据")

    print("\n[完成] 已写入 %s" % item["id"])


if __name__ == "__main__":
    main()