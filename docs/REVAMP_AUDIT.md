# arXiv to Markdown 全面审计与翻新记录

## 产品理解

这是一个 Manifest V3 Chrome/Edge 扩展：在 arXiv 摘要页注入 Markdown 与 PDF 操作；标准模式抓取 ar5iv HTML 并在当前页面转换为 Markdown，MinerU 模式提交 PDF URL 后由后台轮询并在弹窗任务中心下载 ZIP。设置页负责模式、MinerU token、通知、自动提示、元数据和语言。

## 原问题

- 弹窗和内容按钮使用 emoji 作为状态、下载、复制、重试图标，跨平台视觉不一致，也不满足统一 icon system。
- 弹窗头部使用渐变和偏重阴影，信息层级不够稳定；任务列表没有明确的动态播报语义。
- 日志模块直接读取未定义的 `process`，在浏览器运行时存在 `ReferenceError` 风险。
- 文件名清理正则包含控制字符转义，导致 ESLint 失败；文件名安全逻辑与浏览器环境耦合。
- 没有项目级 PRODUCT/DESIGN 文档，视觉真相只存在于 CSS 与 HTML，后续维护缺乏约束。
- 构建产物存在体积告警（background.js、icon.svg），当前架构仍可用，但需要后续按功能拆分和压缩资产。

## 本轮已修复

- 将弹窗状态与操作按钮的 emoji 替换为内联 SVG 线性图标，统一 14px、`currentColor`、`aria-hidden` 语义；保留按钮文本和现有操作契约。
- 给任务列表增加 `aria-live="polite"`，让后台轮询结果对辅助技术可感知。
- 将弹窗主色从渐变改为稳定的酒红色表面，调整背景与焦点颜色，保持原品牌方向并减少装饰噪声。
- 日志生产环境判断改用 `globalThis.process?.env`，浏览器无 `process` 时安全降级。
- 重写文件名控制字符过滤为字符码过滤，修复 ESLint 的 `no-control-regex` 与无效转义问题。

## 验证

- `npm run build`：通过；webpack 仅保留既有产物体积告警。
- `npm test -- --runInBand`：通过（当前项目无测试文件）。
- `npm run lint`：无 error，保留 6 个既有未使用变量/console warning。
- 未在本轮执行浏览器截图；需在已登录 Chrome 中验证 arXiv 摘要页注入、弹窗任务刷新、设置页响应式与键盘焦点。

## 持续设计约束

- 视觉模式为 Operate：优先快速识别转换状态、错误与恢复动作；主色酒红，背景暖灰，状态色只用于语义。
- 图标必须使用 SVG 或图标库，不使用 emoji 充当控制图标；装饰性图形不应替代文本标签。
- 所有动态任务状态应通过可见文本和 `aria-live` 同步；错误消息需包含问题与恢复动作。
- 保持 Standard/MinerU/PDF 三条现有工作流及权限边界，不以框架迁移替代产品改进。

## 功能漂移复核（2026-09）

早期实现对上游页面和接口有几个过时假设：ar5iv 的 `HEAD` 并不稳定（部分边缘节点返回 405/403），只看 `response.ok` 会把错误页当成可用；arXiv ID 只支持 `YYMM.NNNN`，无法识别仍在使用的旧式 `cs/YYMMNNN` 等标识；MinerU 请求没有超时，服务 worker 可能长时间挂起。上述问题会表现为“明明有论文却直接 PDF 兜底”、旧论文按钮不出现、或任务永久 processing。

本轮已把 ID 解析扩展为 modern 与 legacy 两种格式，并支持 bare ID、abs/pdf/export URL；ar5iv 可用性检查在 HEAD 被拒绝时改用 GET，同时校验最终 URL 与 HTML content-type，避免将重定向/错误页面判为成功；MinerU 创建与查询请求加入 `AbortController` 超时（使用统一 `REQUEST_TIMEOUT`），超时错误进入现有轮询重试和最终失败链路。既有消息协议、三层转换策略、任务去重和存储键保持不变，未发生产品语义漂移。

仍需后续实测/决策：ar5iv 对个别论文可能返回可读 HTML 但缺少 `article.ltx_document`，当前仍按解析失败走 PDF；MinerU API 的模型版本和语言字段应在其账户控制台确认后再调整；扩展尚无自动化测试夹具，建议补充 metadata、ar5iv 状态判定和 MinerU 响应 schema 的纯函数测试。

## Popup 系列化翻修（2026-09-09）

- Popup 改为语义化 header/main/footer 骨架，统一 40px icon button、36px action button、状态徽章、卡片边界与间距 token；保留酒红品牌色及全部任务消息协议。
- 新增响应式窄视口布局（280px 以下操作纵向排列）、长标题安全换行、统一 focus-visible、reduced-motion 与动态任务区域语义。
- 确认对话框沿用现有 popup.js 的焦点记忆、Escape 关闭与 Tab trap；装饰空状态 SVG 标记 aria-hidden。
- Settings 去除渐变背景、提高最小字号至 12px，并为原 outline:none 路径增加可见 focus ring；成功/主操作色改为稳定纯色以和 popup token 对齐。
- 版权文案移除过时年份。icon.svg 仍为上游 593KB 资产，未改变视觉内容；需后续专门做 SVG path 优化。

验证：`npm run build`、`npm run lint`（0 errors，6 个既有 warning）、`npm test -- --runInBand` 均通过。

## 全面修复补充（2026-09-09）

- 对 MinerU v4 响应契约做容错：`code` 支持数字/字符串零值，查询结果优先读取 `data.extract_result`，并保留旧版扁平字段 fallback；完成态缺少 ZIP 地址会明确失败。
- 设置页移除语言、欢迎和模式选择中的 emoji 功能图标，改用内联 SVG 并标记装饰图形 `aria-hidden`。
- 设置页新增系列 token、窄视口响应式布局与 `prefers-reduced-motion` 规则；popup 操作图标补齐 `aria-hidden`。
- 使用 SVGO 优化 `assets/icon.svg`，体积由约 593KB 降至约 209KB，视觉内容保持不变。

补充验证：`npm run build`、`npm run lint -- --quiet`、`npm test -- --runInBand` 均通过；build 仅保留 background.js 体积告警。

## 发布

本轮翻修版本：1.1.8。
