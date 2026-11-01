# Sales Engineer AI — Goals

独立学习演示项目，非 Schneider Electric 官方工具。

## 产品范围
- 面向海外 B2B 技术销售，以智利为首发市场，产品仅 SMT1500I、SRT2200XLI、SRT3000XLI。
- 最终 MVP 支持英文、西语、中文询盘；结构化手动输入和明确标记的内置案例在无 AI 时可独立工作。
- 提取国家、场景、W、VA、功率因数、电压、相数、后备时间、拓扑、安装、预算、冗余；区分 known / unknown / uncertain。
- 输出 confirmed_match / excluded / pending_verification，以及逐条件理由、追问和英文/西语初步邮件。

## 正确性底线
- 不编造需求、技术参数、续航、价格或库存；官网存在不等于本地在售。
- 同时检查 W 与 VA，以及所有已声明硬性要求；任一硬性失败即排除，必要数据缺失则待核验。
- 功率余量是可配置策略，不是普适硬性标准。VA 的推导必须有明确 W 与功率因数，并保留推导说明。
- 续航仅采用适用 SKU、电池配置、负载和条件的厂家曲线/数据，不从电池容量推算。
- API Key 只用服务端环境变量，禁止 NEXT_PUBLIC_* 密钥。

## 当前交付边界
Phase 1 已完成：项目基础、真实产品 JSON、逐字段证据与数据完整性检查。
Phase 2 已完成：独立规则引擎、手动需求输入、可解释选型与测试。
本轮 Phase 3：中/英/西语询盘解析、逐字段原文依据、人工确认、原规则引擎与可追溯结果、英文/西语事实锁定销售回复；包括可替换服务端 AI adapter、Mock 闭环、调用控制和重点智利案例。销售回复由本次用户明确纳入 Phase 3。Phase 3 已验收。用户现明确授权 Phase 4A：业务验收、展示优化和可选 Live smoke 脚本；默认 Mock，不执行付费调用，不公开部署，完成 4A 后停止。

## Phase 4B 本轮授权增量
优先 DeepSeek 官方 API，默认 deepseek-flash，可切 deepseek-v4-pro。保留 Mock、OpenAI 可选 adapter、人工确认与确定性选型。完成 adapter/兼容性测试/15例评测准备；只 dry-run，不使用对话中提供的密钥，不执行付费 API 或部署。产品 JSON 不变。
