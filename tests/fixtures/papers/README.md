# arXiv 论文夹具

由 `scripts/crop-fixtures.mjs` 从 https://arxiv.org/html/<id>v1 整页裁剪而来（整页原件不入库）。
只收 CC BY 4.0 / CC0 1.0 论文，许可以 arXiv 摘要页的 license 链接为准（2026-10-28 核对）。
每个文件第一行注释写明来源 URL 和许可。仅用于转换测试。

| arXiv ID | 标题 | 许可 |
|---|---|---|
| 2305.18290 | Direct Preference Optimization: Your Language Model is Secretly a Reward Model | CC BY 4.0 |
| 2312.16475 | Federated Continual Learning via Knowledge Fusion: A Survey | CC0 1.0 |
| 2401.11627 | Tight Verification of Probabilistic Robustness in Bayesian Neural Networks | CC BY 4.0 |
| 2402.18614 | Deep Neural Network Models Trained With A Fixed Random Classifier Transfer Better Across Domains | CC BY 4.0 |
| 2402.18734 | Priority Sampling of Large Language Models for Compilers | CC BY 4.0 |
| 2402.18762 | Disentangling the Causes of Plasticity Loss in Neural Networks | CC BY 4.0 |
| 2402.18994 | Spyx: A Library for Just-In-Time Compiled Optimization of Spiking Neural Networks | CC BY 4.0 |
| 2402.19155 | Beyond Language Models: Byte Models are Digital World Simulators | CC BY 4.0 |
| 2402.19308 | Loss-Free Machine Unlearning | CC BY 4.0 |
| 2402.19464 | Curiosity-driven Red-teaming for Large Language Models | CC BY 4.0 |
| 2402.19469 | Humanoid Locomotion as Next Token Prediction | CC BY 4.0 |

裁剪方式（每篇约 6–41 KB）：只留 `article.ltx_document` 的标题、作者块、摘要首段；正文挑代表段落
（行间公式 ≤2、含行内公式段 ≤3、表格 1、SVG `<object>` 图 1、含引用段 ≤2、含脚注段 ≤2）并保留小节标题；
参考文献只留被引用到的条目；`<math>` 只留 alttext 和 TeX annotation；去掉 style 属性。
