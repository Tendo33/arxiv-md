# 维护者导读包

这套文档不是产品说明，而是给以后继续维护这个仓库的人准备的源码导读。

推荐阅读顺序：

1. [00-codebase-map.md](./00-codebase-map.md)
2. [01-quickstart-path.md](./01-quickstart-path.md)
3. [02-request-lifecycle.md](./02-request-lifecycle.md)
4. [03-advanced-features.md](./03-advanced-features.md)
5. [04-learning-plan.md](./04-learning-plan.md)

如果你只有 20 分钟，至少先读：

- `00-codebase-map.md`
- `02-request-lifecycle.md`

## 这套文档解决什么问题

- 代码入口分散，不容易第一次就读对顺序
- Popup、Settings、Content Script、Background 各自有自己的状态面
- MinerU 是后台任务流，和标准模式不是同一条链路
- 旧文档曾经混入过历史方案，维护时容易误判当前实现

## 读完后的目标

你应该能独立回答这些问题：

- 一个 `Markdown` 点击从页面到下载到底经过哪些文件
- 标准模式和 MinerU 模式分别在哪里分叉
- 为什么 HTML 清洗在后台，Markdown 转换却在内容脚本
- 哪些状态存在 `sync`，哪些状态存在 `local`
- 如果要新增转换器、设置项或任务动作，应该先改哪一层
