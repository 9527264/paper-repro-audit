# 控制类论文可复现性标注库（自动化23-1第十组创新产品）

给控制方向的论文记录六件「照着做需要、但经常没给」的事：对象模型、建模过程、控制器结构、控制器参数、仿真设置、响应曲线。
只记录有没有给，不评价论文好坏。纯静态站点，无后端、无依赖、无构建。

## 文件结构

```
paper-audit-site/
├── index.html                     列表页：筛选 + 统计 + 表格
├── about.html                     判定标准与提交规则
├── assets/
│   ├── style.css
│   └── app.js                     全部前端逻辑（★ 上线前改里面一行的仓库名）
├── data/
│   ├── papers.csv                 源数据（用 Excel 直接改）
│   └── papers.js                  自动生成，别手改
├── scripts/
│   ├── csv2js.py                  CSV → JS，同时校验数据
│   └── 更新数据.bat                双击运行
├── .github/ISSUE_TEMPLATE/
│   └── submit-paper.yml           别人提交标注用的表单
└── README.md
```

## 本地先看一眼

**直接双击 `index.html`** 就能打开，不需要装任何东西、不需要起服务器。

## 改数据（以后每次只有这 3 步）

1. 用 Excel 打开 `data/papers.csv`，加一行（表头 18 列不要动，取值不要乱填）；
2. 双击 `scripts/更新数据.bat`——它会校验数据，**有问题会直接告诉你第几行错在哪，且不会生成新文件**；
3. 把 `data/papers.csv` 和 `data/papers.js` 两个文件上传覆盖到 GitHub 仓库。

看到 `[校验通过]` 才算成功。校验规则：表头必须是那 18 列；六个标注项只能是 `0/1/2/NA`；类型只能是 `仿真/实验/工程`；总评只能是 `能/存疑/不能`；`id` 不能重复；年份 4 位。

## 上线到 GitHub Pages（约 10 分钟，全部在网页上点）

1. 打开 github.com，右上角 **+ → New repository**，名字填 `paper-repro-audit`，选 **Public**，不要勾 README，创建。
2. 进入仓库 → **Add file → Upload files** → 把本文件夹里的 `index.html`、`about.html`、`assets`、`data`、`scripts`、`README.md` 拖进去 → Commit。
3. `.github` 是隐藏目录，拖拽常会漏。单独补：**Add file → Create new file**，文件名输入 `.github/ISSUE_TEMPLATE/submit-paper.yml`（输入斜杠会自动建目录），把本地这个文件的内容粘进去 → Commit。
4. **改仓库地址**：打开仓库里的 `assets/app.js`，第 1 行附近找到
   `var REPO = 'YOUR-NAME/paper-repro-audit';`
   把 `YOUR-NAME` 换成你的 GitHub 用户名 → Commit。
5. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → Branch 选 `main`、目录选 `/ (root)` → Save。
6. 等 1~2 分钟，访问 `https://<你的用户名>.github.io/paper-repro-audit/`。

## 国内访问慢怎么办

GitHub Pages 在国内时快时慢，属正常。代码不用改，换一个支持拖拽上传的静态托管即可：

- **Cloudflare Pages**：新建项目 → Direct Upload → 把整个文件夹拖进去 → 得到 `xxx.pages.dev`。
- 同样免费，不用备案（前提是不绑定自己的域名）。

## 说明

- 站内数据只含书目信息与标注结果，**不含论文全文或图片**，避免版权问题。
- 首批数据建议先标 30 篇再对外说「上线」，数量太少会显得空。当前 `papers.csv` 里 6 条是**示例数据**（标题以「示例」开头），页面统计会自动排除它们。
- 别人提交走 Issue 表单：Issue 开着＝待审，你确认后录入 CSV 并关闭＝已发布。审核机制不需要写代码。

## 自检（改了代码或数据后跑一次，可选）

本机没装 node/python 也没关系，用 DSH 自带的那份：

```
"%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" scripts\expected.py
"%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" scripts\csv2js.py
"%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" scripts\verify.js
```

`expected.py` 用最直白的写法独立算出各筛选场景应有几条、各字段计数；`verify.js` 用极简 DOM 桩跑真实 `app.js`，把渲染结果与它逐条比对。全部打勾才算改对了。这只是开发期工具，不影响站点运行，上线时传不传都行。
