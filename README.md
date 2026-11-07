# dsh-plugins

个人维护的 DeepSeek Harness（DSH）插件集合。

## 插件列表

| 插件 | 目录 | 说明 |
|---|---|---|
| 技术洞察（Tech Insight） | [`tech-insight-plugin/`](./tech-insight-plugin) | 左侧导航一键联网洞察技术，生成含技术方案设计、关键难点、使用场景、业界状态与参考的结构化报告；报告可归档、可多次补充修订与回滚。 |

## 安装

DSH 的 `plugin_manager install_bundle` 支持从本仓库安装指定子目录的插件。以「技术洞察」为例，target 使用 commit 固定的形式：

```text
git+https://github.com/wonanut/dsh-plugins.git#<commit>&path:/tech-insight-plugin
```

把 `<commit>` 替换成 [main 分支提交](https://github.com/wonanut/dsh-plugins/commits/main) 的 sha。安装后刷新页面即可在左侧导航看到入口。

本地开发时也可以直接克隆仓库，把插件子目录的绝对路径作为安装 target。

## 说明

- 插件 Host 代码会运行在 DSH 进程中，权限等同当前用户；安装前请自行审阅源码。
- 仓库内已提交构建产物（如 `client.js`），安装者不需要本地构建。
- 各插件的详细功能、配置与开发方式见对应子目录的 README。
