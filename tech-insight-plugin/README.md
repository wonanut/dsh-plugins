# 技术洞察（Tech Insight）

DSH Web 插件：在左侧导航新增「技术洞察」入口，一键联网检索并生成结构化技术洞察报告。报告自动归档，支持多轮补充修订、手动编辑分节、历史版本回滚与 Markdown 导出。

仓库：[wonanut/dsh-plugins](https://github.com/wonanut/dsh-plugins)，本插件位于 `tech-insight-plugin/` 目录。

## 安装（给其他人）

前提：目标机器已安装 DeepSeek Harness（DSH），并能使用插件管理（Web 的 Plugins 页或 `plugin_manager` 工具）；DSH 需要能运行 `pnpm`。

**方式 A：npm（最简）**

在 DSH 会话里让 Agent 执行 `plugin_manager install_bundle`，target 填包名与版本：

```text
@wonanut/dsh-tech-insight@1.0.1
```

（npm 包地址：https://www.npmjs.com/package/@wonanut/dsh-tech-insight）

**方式 B：从 GitHub 安装**

target 使用「commit + 子目录」形式（把 `<commit>` 换成 [仓库提交](https://github.com/wonanut/dsh-plugins/commits/main) 里的 sha）：

```text
git+https://github.com/wonanut/dsh-plugins.git#<commit>&path:/tech-insight-plugin
```

**方式 C：本地目录**

```bash
git clone https://github.com/wonanut/dsh-plugins.git
```

然后让 Agent 把 `dsh-plugins/tech-insight-plugin` 的绝对路径作为 `plugin_manager install_bundle` 的 target。

安装者不需要本地构建：仓库里已经提交了构建产物 `client.js`。

## 功能

- **一键洞察**：输入技术名称（可选关注点、快速/标准/深度三档），Host 通过 DSH `web` 服务多路检索、抓取正文，再由当前默认模型生成报告。
- **后台执行、切页不丢**：生成/修订任务是 Host 后台任务（内存任务表），浏览器只负责启动与轮询；切换插件、切换页面、关闭面板都不会中断。切回来会自动续接进度，若任务已在你离开期间完成，会自动补归档并选中报告。
- **固定结构**：技术介绍、**技术方案设计**（总体架构 / 核心流程 / 关键技术选型 / 关键实现与参数 / 失败处理与可靠性 / 落地步骤）、技术关键难点、技术使用场景、业界使用状态、相关参考。
- **以当前年份为基准**：检索词、业界状态与参考默认使用运行时的当前年份（不写死年份），并优先最近 12–18 个月的资料。
- **两段式生成**：先用高推理强度产出一份简短的「技术方案要点」，再关闭推理、把全部输出预算留给完整报告 JSON（推理与正文共用输出上限，避免高推理把正文预算挤爆）；若仍触发长度上限，会自动用压缩版提示重试一次。
- **方案细节优先**：方案分节要求写出模块职责、端到端流程、≥3 个选型维度的候选与取舍、参数/容量数量级、失败兜底与分阶段落地路径；检索词也围绕“架构 / 选型 / 参数 / 调优 / 高可用”展开，并按深度提升抓取页数、输出预算与推理强度。
- **图文并茂**：技术方案配内联 SVG 分层架构图，另有难点强度条、场景价值矩阵、业界时间线；由模型产出结构化数据、前端 SVG 渲染，不依赖外部渲染服务；报告正文固定单列排版。
- **联网来源可追溯**：报告中的参考链接只允许来自实际检索/抓取到的 URL，模型不得编造链接；来源清单与检索词随报告保留。
- **归档**：生成成功自动归档到浏览器 localStorage（key `dsh.tech-insight.v1`），左栏可搜索、查看、删除；归档列可收起为窄条（点击箭头图标展开），折叠状态会记住。生成/修订一开始就在目录里插入一条带「生成中 / 修订中」标签的临时条目，生成期间可以切到其他报告查看，点回该条目即恢复进度视图。
- **多次补充修订**：
  - 补充修订：填写修订要求，可选「联网检索新资料」，Host 返回完整的新版本报告；
  - 手动编辑：按分节编辑正文，或修改标题与一句话结论；
  - 版本历史：每个动作都追加一个 revision，可查看任意历史版本并回滚（回滚本身也记录为新版本）。
- **导出**：复制 Markdown、下载 `.md` 文件（`技术洞察-{topic}-{YYYYMMDD}.md`；导出的 markdown 含正文与参考，图为页面内渲染）。
- **环境状态**：页面顶部展示模型与联网检索是否就绪，失败时给出可操作提示。

## 架构

```
index.js              Host 路由 + 后台任务表（status / 启动洞察 / 启动修订 / 轮询任务 / 取消任务）
lib/insight.js        Host 纯逻辑：检索词、来源合并、正文提取、提示词、JSON 解析、报告规范化、service
client.js             Client 产物（由 build.mjs 拼接 src/*.js 生成，勿手改）
src/00-core.js        常量、localStorage 归档、Report 归一化、Markdown 导出、JSON/SSE 网络层
src/10-ui.js          全局样式（DSH 主题 token）与 UI 原语、安全 markdown-lite 渲染
src/20-generate.js    生成输入区、四阶段进度、错误卡、SSE 封装
src/25-visuals.js     内联 SVG 可视化（方案架构图 / 难点强度 / 场景矩阵 / 时间线）
src/30-report.js      报告视图、分节编辑、修订弹窗、版本历史
src/40-archive.js     左栏归档列表
src/50-page.js        页面状态编排
src/90-apply.js       sidebar.panellist + main slot 注册
```

- Host 侧依赖 `webServer`，其余能力按需通过 `ctx.get('web')` / `ctx.get('llm')` / `ctx.get('agentDefaultModel')` 获取，缺失时返回可读错误而不是崩溃。
- 浏览器只拿到报告文本与来源链接，模型账号与密钥始终留在 Host。
- **联网认证**：DeepSeek 官方搜索 provider 只在「发起会话」使用 `deepseek-account` 路由时才复用账号登录态，否则会去读 `DEEPSEEK_API_KEY`。插件路由由浏览器触发、本身没有 Agent 会话，因此 Host 会在检索时显式挑选一个使用 DeepSeek 账号路由的存活会话，并在 `agents.withInitiator()` 作用域内执行检索；若没有任何账号会话（例如冷启动、未登录），错误信息会提示先登录 / 打开账号会话或配置 API Key。
- 所有浏览器路由沿用 DSH Connection 的同源信任检查（未认证返回 401）。
- 报告正文区铺满可用宽度，报告末尾有收尾条（来源数 / 继续修订 / 导出），减少宽屏与长页底部的空白。
- 后台任务在 Host 内独立执行，HTTP 请求立即返回 job；页面切换只影响轮询，不影响任务；任务默认 5 分钟超时、保留最近 20 个。

## 开发

```bash
node build.mjs          # 生成 client.js 并做语法检查
node build.mjs --check  # 只做语法检查
node --test test/*.test.mjs   # Host 纯逻辑 + 路由集成测试
```

修改 `src/*.js` 后必须重新运行 `node build.mjs`。修改 Host（`index.js` / `lib/`）后，在「设置 → 插件」里关闭再打开本插件即可加载新模块；重新安装会走包管理路径。

## 数据与隐私

- 报告归档保存在当前浏览器的 localStorage，不上传；清理浏览器数据或更换浏览器后归档不可恢复，建议对重要报告使用「导出 .md」。
- 联网检索使用 DSH 当前的 Web 搜索 provider；模型使用当前 profile 的默认模型。

## 验收状态

- Host 纯逻辑与路由：`test/insight.test.mjs` + `test/routes.test.mjs` 共 28 条测试通过（含 SSE 帧格式、401/405、错误帧、修订 revision 递增、visuals 归一化与失败丢弃）。
- Client 可视化：`test/visuals.test.mjs` 7 条测试通过（四类 SVG 图渲染、TiFigure 分派、visuals 归一化）。
- 构建：`node build.mjs` 通过；Client slot 注册已在运行页面确认（`sidebar.panellist` id=tech-insight order=7、`main` key=tech-insight）。
- 受限项：本次开发环境无法驱动已连接页面的浏览器交互，页面的浅色/深色目视验收与真实联网生成流程请在使用时确认。
