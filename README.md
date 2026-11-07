# dsh-plugins

个人维护的 DeepSeek Harness（DSH）插件集合。

## 插件列表

| 插件 | 目录 | 说明 |
|---|---|---|
| 技术洞察（Tech Insight） | [`tech-insight-plugin/`](./tech-insight-plugin) | 左侧导航一键联网洞察技术，生成含技术方案设计、关键难点、使用场景、业界状态与参考的结构化报告；报告可归档、可多次补充修订与回滚。 |
| Agent 实验室（Agent Lab） | [`agent-lab-plugin/`](./agent-lab-plugin) | 在模拟 TUI 中观察一个迷你 Agent 的完整流转（上下文、模型、8 个工具、记忆、90% 压缩、会话、数据流），并阅读运行中的源码与 12 节原理长文；支持模拟 / 真实 DeepSeek 双模式。 |

## 安装

### npm（推荐）

```text
@wonanut/dsh-tech-insight@1.0.1
@wonanut/dsh-agent-lab@0.2.0
```

把上面的包名与版本作为 DSH `plugin_manager install_bundle` 的 target 即可。

### 从本仓库安装

DSH 的 `plugin_manager install_bundle` 支持从本仓库安装指定子目录的插件。以「技术洞察」为例，target 使用 commit 固定的形式：

```text
git+https://github.com/wonanut/dsh-plugins.git#<commit>&path:/tech-insight-plugin
```

把 `<commit>` 替换成 [main 分支提交](https://github.com/wonanut/dsh-plugins/commits/main) 的 sha。安装后刷新页面即可在左侧导航看到入口。

以「Agent 实验室」为例：

```text
git+https://github.com/wonanut/dsh-plugins.git#<commit>&path:/agent-lab-plugin
```

本地开发时也可以直接克隆仓库，把插件子目录的绝对路径作为安装 target。

## 开发与发布

插件开发在独立工作目录进行，构建产物 `client.js` 需要一起提交（安装者不构建）。

```bash
# 1. 在插件目录构建并跑测试
cd tech-insight-plugin
node build.mjs
node --test test/*.test.mjs

# 2. 同步到本仓库（示例；按实际路径调整）
rsync -a --delete --exclude '.DS_Store' --exclude 'node_modules' --exclude '*.log' \
  /path/to/dev/tech-insight-plugin/ ./tech-insight-plugin/

# 3. 提交并推送
cd ..
git add -A
git commit -m "feat(tech-insight): ..."
git push origin main
git tag v1.0.1 && git push origin v1.0.1
```

安装方建议固定到 commit：`git+https://github.com/wonanut/dsh-plugins.git#<commit>&path:/tech-insight-plugin`。

## 说明

- 插件 Host 代码会运行在 DSH 进程中，权限等同当前用户；安装前请自行审阅源码。
- 仓库内已提交构建产物（如 `client.js`），安装者不需要本地构建。
- 各插件的详细功能、配置与开发方式见对应子目录的 README。
