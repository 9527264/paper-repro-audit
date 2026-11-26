# -*- coding: utf-8 -*-
"""把 data/papers.csv 转成 data/papers.js，同时做数据校验。

用法（双击 ../scripts/更新数据.bat 也行）：
    python scripts/csv2js.py

校验不通过时：不生成 papers.js，打印出错行号与原因，退出码 1。
校验通过时：生成 papers.js，打印统计摘要，退出码 0。
"""

import csv
import json
import sys
from pathlib import Path

# 某些控制台代码页装不下中文，宁可显示成问号也不要抛 UnicodeEncodeError
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
_ARGS = [a for a in sys.argv[1:] if not a.startswith("-")]
CSV_PATH = Path(_ARGS[0]) if len(_ARGS) > 0 else ROOT / "data" / "papers.csv"
JS_PATH = Path(_ARGS[1]) if len(_ARGS) > 1 else ROOT / "data" / "papers.js"

COLS = [
    "id", "title", "journal", "year", "doi", "paper_type", "plant", "ctrl_type",
    "m1_model", "m2_deriv", "m3_struct", "m4_params", "m5_simset", "m6_plot",
    "repro", "notes", "annotator", "date",
]
SCORE_COLS = COLS[8:14]
FIELD_NAMES = {
    "m1_model": "对象模型",
    "m2_deriv": "建模过程",
    "m3_struct": "控制器结构",
    "m4_params": "控制器参数",
    "m5_simset": "仿真设置",
    "m6_plot": "响应曲线",
}
SCORES = {"0", "1", "2", "NA"}
TYPES = {"仿真", "实验", "工程"}
REPRO = {"能", "存疑", "不能"}


def fail(msg):
    print("[校验失败] " + msg)
    sys.exit(1)


def main():
    if not CSV_PATH.exists():
        fail("找不到 %s" % CSV_PATH)

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        rows = list(reader)

    if header != COLS:
        missing = [c for c in COLS if c not in header]
        extra = [c for c in header if c not in COLS]
        fail("表头与约定不一致\n  缺少：%s\n  多出：%s\n  实际：%s"
             % (missing or "无", extra or "无", header))

    errors = []
    seen_ids = {}
    for i, row in enumerate(rows, start=2):  # 第 2 行是第一条数据（第 1 行表头）
        rid = (row.get("id") or "").strip()
        if not rid:
            errors.append("第 %d 行：id 为空" % i)
        elif rid in seen_ids:
            errors.append("第 %d 行：id '%s' 与第 %s 行重复" % (i, rid, seen_ids[rid]))
        else:
            seen_ids[rid] = i

        for col in ("title", "journal"):
            if not (row.get(col) or "").strip():
                errors.append("第 %d 行（%s）：%s 为空" % (i, rid or "?", col))

        year = (row.get("year") or "").strip()
        if not (len(year) == 4 and year.isdigit()):
            errors.append("第 %d 行（%s）：year 应为 4 位数字，实际 '%s'" % (i, rid or "?", year))

        ptype = (row.get("paper_type") or "").strip()
        if ptype not in TYPES:
            errors.append("第 %d 行（%s）：paper_type 只能是 %s，实际 '%s'"
                          % (i, rid or "?", "/".join(sorted(TYPES)), ptype))

        for col in SCORE_COLS:
            v = (row.get(col) or "").strip()
            if v not in SCORES:
                errors.append("第 %d 行（%s）：%s 只能是 0/1/2/NA，实际 '%s'"
                              % (i, rid or "?", col, v))

        rep = (row.get("repro") or "").strip()
        if rep not in REPRO:
            errors.append("第 %d 行（%s）：repro 只能是 能/存疑/不能，实际 '%s'"
                          % (i, rid or "?", rep))

    if errors:
        print("[校验失败] 发现 %d 处问题，未生成 papers.js：\n" % len(errors))
        for e in errors:
            print("  - " + e)
        sys.exit(1)

    if not rows:
        fail("CSV 里一条数据都没有")

    # 规范化：去掉首尾空白，保证 JS 侧取值稳定
    clean = []
    for row in rows:
        clean.append({c: (row.get(c) or "").strip() for c in COLS})

    body = json.dumps(clean, ensure_ascii=False, indent=1)
    JS_PATH.write_text("// 由 scripts/csv2js.py 自动生成，不要手改这个文件\n"
                       "// 改数据请编辑 data/papers.csv，然后双击 scripts/更新数据.bat\n"
                       "window.PAPERS = " + body + ";\n", encoding="utf-8")

    # ---- 统计摘要 ----
    total = len(clean)
    sample = sum(1 for r in clean if r["title"].startswith("示例"))
    print("[校验通过] %d 条记录，其中示例 %d 条、正式 %d 条" % (total, sample, total - sample))
    print("已生成 %s\n" % JS_PATH)
    print("%-12s %4s %4s %4s %4s   %s" % ("字段", "2有", "1半", "0无", "NA", "未给全率(0+1)"))
    for col in SCORE_COLS:
        vals = [r[col] for r in clean]
        c2 = vals.count("2")
        c1 = vals.count("1")
        c0 = vals.count("0")
        cna = vals.count("NA")
        denom = c2 + c1 + c0
        rate = (c1 + c0) / denom * 100 if denom else 0.0
        print("%-12s %4d %4d %4d %4d   %5.1f%%"
              % (FIELD_NAMES[col], c2, c1, c0, cna, rate))

    gaps = []
    for col in SCORE_COLS:
        vals = [r[col] for r in clean]
        denom = len([v for v in vals if v != "NA"])
        gaps.append(((vals.count("0") + vals.count("1")) / denom if denom else 0, col))
    gaps.sort(reverse=True)
    print("\n最缺的一项：%s（%.1f%%）" % (FIELD_NAMES[gaps[0][1]], gaps[0][0] * 100))


if __name__ == "__main__":
    main()