# Sales Engineer AI

## 2026-11-01：审计修复第一批（Q05 / Q04）

本批只修复 Mock 配置独立性和邮件客户文本边界。原237项测试保留，新增13项正确行为回归，合计250项通过；Lint、TypeScript、标准生产构建及构建后TypeScript均通过。完整记录见 `outputs/AUDIT-REPAIR-BATCH-1.md`，日志及浏览器下载在 `outputs/batch-1-evidence/`。

Mock 请求先确定请求模式，不读取或校验未使用的 Live 模型、密钥、Token/超时配置；公共调用限额、请求体/同源/Schema限制仍有效。Live配置错误返回脱敏的 `configuration_error`（503），不伪装为客户输入错误，不自动变成Mock成功；可用性接口单列Mock是否可用。

生成邮件中，应用、目的地及附加要求以每行 `> [Customer text ...; unverified]` 或 `> [Texto del cliente ...; sin verificar]` 明确归属。换行、控制及Unicode方向字符显示为 `[U+XXXX]`，不会变成新的销售承诺段落。客户原文及已确认需求保持原样供审核；下载增加归属说明。正常保修/交期要求仍保留为待核验。英/西语、详细/简洁、服务端/本地兜底共用该呈现边界；人工编辑邮件仍必须自行审稿，不会被宣称已自动重验。

本批没有付费模型调用、发送邮件或部署；没有读取/复制 `.env.local`，产品JSON及六个原Demo不变。Q01/Q02数字与语境、Q03遗漏复核等仍待后续批次，不能将本批视作完整产品审计问题已解决。

独立学习演示项目，非 Schneider Electric 官方工具。

面向智利市场的 B2B UPS 售前辅助工具。已实现 **Phase 1 产品证据库、Phase 2 确定性选型、Phase 3 询盘→人工确认→规则→销售回复闭环**。默认 Mock 无付费调用；Live 服务端 adapter 已实现，本轮未使用真实 key 发起付费验证。现已完成 Phase 4A 与本轮 Phase 4B DeepSeek 接入/兼容性测试/15例评测准备；未执行付费 Live 调用或公开部署。默认 Live provider 优先 DeepSeek，详见文末当前配置。

## 开发
需要 Node.js >=20.9 和 pnpm 11（本环境使用内置运行时）。

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

访问 http://localhost:3000 浏览产品库，访问 http://localhost:3000/selection 使用询盘/手动选型。Mock 无需 AI 密钥。页面首个 **Chile Distributor Inquiry** 按钮一键加载并提取重点西语演示询盘；人工确认后才运行规则。

本机的 Node/pnpm 未加入默认 PATH。若命令找不到，可先执行：

```sh
export PATH="/Users/mill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/mill/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

其他电脑安装 Node.js 与 pnpm 后直接运行上述标准命令即可，不需要此本机路径。

```sh
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm start
```

## 数据与状态
`src/data/products.json` 包含 3 个真实 SKU，逐字段附来源引用与核验状态。数据在加载时经 Zod 校验，不合法则失败，不自动补齐。

`verified_official` 仅表示该字段在官方页面有明确支持，`pending_manual_verification` 表示待人工核验。整条产品记录均为 `partially_verified`。`nominalVoltageV` 仅为标题/已选型号的标称电压，**不能代替完整输入范围或可配置输出电压证据**。当前相数、输入/输出范围、续航、本地在售、价格和库存仍未知。SRT 机架安装需要另购配件，不表示已随箱提供。

来源日期是本次资料核验日，不是厂家发布日期，也不代表实时监测。来源访问使用研究工具解析后的官方网页正文，不是完整下载存档。详见 `docs/SOURCES.md`。

## 文件结构
`src/app` 页面与样式；`src/components` 共用导航、目录与选型交互；`src/data` 本地产品库；`src/lib` schema/加载校验；`src/lib/selection` 需求 schema、归一化、规则引擎、表单适配器与案例；`tests` 数据与规则测试；`docs` 来源审计和规则说明。

## 手动演示
进入 `/selection`，点击案例按钮加载，再点击 **Run shortlist**。加载不会自动运行；修改任一字段会清除旧结果。

| 案例 | 关键输入 | 预期行为 |
| --- | --- | --- |
| 800 W server room | 800 W / 1000 VA，15 min | 三个型号容量通过，但电气、续航和市场证据缺失，全部 Pending Verification |
| Online required | 1600 W，PF 0.8，Online | 推导 2000 VA；SMT 排除，SRT 待核验；SRT3000 优先，因为 SRT2200 未满足建议 VA 余量 |
| W fits, VA does not | 900 W / 1800 VA | SMT 的 W 通过、VA 失败，Not Matched；SRT 待核验 |
| Missing VA / PF | 800 W，VA/PF 均空 | VA 不补值；生成向客户询问 VA/PF 的问题 |
| 3,000 W overload | 3000 W / 3300 VA | 三个型号均因 W 硬性超限排除 |
| 20% margin as a hard limit | 900 W / 1000 VA，20% hard | 需要 1080 W / 1200 VA；SMT 因显式余量策略排除 |

空表提交、负数、PF > 1、VA < W、相互矛盾的 W/VA/PF、预算上限未选币种等会显示错误，不产生选型结果。场景均为虚构客户输入，**不是模拟产品资料**。

## 状态与证据边界
硬性失败优先返回 `excluded`（Not Matched）；无失败但必要证据缺失返回 `pending_verification`；只有所有必要条件通过或被客户显式解除才返回 `confirmed_match`。库存等非阻断商业待核验项仍单列显示，不能当作有库存。

余量默认 20% advisory，不会代替额定 W/VA 检查，也不会自动变成硬性标准。预算空白保持待确认；明确无上限才不做预算判定。来源和产品记录的部分核验状态一直保留。

Matched 分支使用仅存在于测试中的合成完整证据夹具验证，当前三个真实 SKU 的电气/续航/市场证据不足，**不会返回 Matched**。更多细节见 `docs/SELECTION-RULES.md`。

## 后续阶段
Phase 3 的 AI 解析与英/西语事实锁定邮件均已实现（邮件由本次用户明确纳入 Phase 3）。AI 不取代规则结论；手动表单作为无 AI 的兜底。后续已按用户授权推进 Phase 4A/4B 准备；不扩展到 CRM、登录、支付、发送邮件或生产部署。

`.env.example` 包含当前 Phase 4B 服务端配置模板。不要使用 `NEXT_PUBLIC_` 保存 API Key，也不要提交 `.env.local`。本地 MVP 不含用户账号或持久化询盘；限额是单进程基本控制，不是生产鉴权或分布式计费系统。

## Phase 1 验证结果
2026-10-31：10 项数据完整性测试通过；Lint 零错误零警告；TypeScript 检查和生产构建通过；本地 HTTP 200；SKU 检索、拓扑筛选、证据展开和重置已做浏览器实测，1440px 桌面及 390px 移动端无横向溢出，未捕获浏览器错误/警告。规则引擎与 AI 的测试将在对应阶段实施。

## Phase 2 验证结果
2026-10-31：全部 **77 项测试通过**（原 10 项 + 新 67 项），Lint 0 错误/0 警告，独立 TypeScript 检查与最终 production build 均通过；`/` 与 `/selection` HTTP 200。

浏览器实测：6 个演示案例；W/PF → VA 公式；W/VA 分别判定；建议/硬性余量；全部排除提示；待核验与追问展开；空表、负数和缺失币种报错；编辑后清除旧结果；预算币种修正后恢复；原目录筛选与跨页面导航。1440px 桌面/390px 移动端无横向溢出，未记录 console error/warn。

与 Phase 1 源码包逐字节对比，`src/data/products.json` 完全未修改。当前仍缺完整电压/相数/频率/部分连接器、续航曲线、机架实际适配、冗余架构及市场/报价/库存证据。测试中的完整电气/商业事实仅为合成夹具。

本地验收服务器在结束时停止，未发布网站。按开发命令启动即可操作。阶段说明和截图在 outputs/PHASE-2-HANDOFF.md、outputs/phase-2-desktop.jpg、outputs/phase-2-mobile.jpg。

## Phase 3 配置背景（OpenAI 保留，可选）
复制 `.env.example` 为 `.env.local`，默认 `AI_PROVIDER=mock`，不需要 key 即可完整演示。本节为保留的OpenAI配置背景；当前优先DeepSeek。任何Live都还必须显式设 `AI_ALLOW_PAID_CALLS=yes` 并通过模拟/匿名化确认，详见文末当前配置。OpenAI可选项为 `AI_PROVIDER=openai`、自己的 `OPENAI_API_KEY` 和可用 `OPENAI_MODEL`。不要将 key 粘贴进页面或询盘。

| 服务端变量 | 默认值 / 用途 |
| --- | --- |
| AI_PROVIDER | 默认mock；当前优先deepseek，openai为保留可选项；Live另需付费开关 |
| OPENAI_API_KEY | 空；仅服务端使用 |
| OPENAI_MODEL | gpt-6-luna，可替换为账号可用且支持 Responses/Structured Outputs 的模型 |
| AI_TIMEOUT_MS | 25000，允许 1000–28000 |
| AI_PARSE_MAX_TOKENS | 4500，允许 500–6000 |
| AI_EMAIL_MAX_TOKENS | 1200，允许 200–2000；用于受约束编排，不是整封正文长度 |
| AI_CALLS_PER_MINUTE | 20，所有解析/邮件调用共享 |
| AI_CALLS_PER_DAY | 100，进程内 24 小时计数；重启会重置 |

采用官方 OpenAI JavaScript SDK（锁文件版本 7.45.1）的 Responses `responses.parse` 与 `zodTextFormat`，而不是仅提示输出 JSON。[官方结构化输出文档](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)、[官方 SDK 文档](https://developers.openai.com/api/docs/libraries)。选择默认 GPT-6 Luna 是因为该任务受 schema/原文证据/人工确认约束，且邮件事实不开放自由生成，适合成本敏感的聚焦任务；其官方模型页列明支持 Structured Outputs。[模型说明](https://developers.openai.com/api/docs/models/gpt-6-luna)。账号权限、真实响应质量和延迟仍需用自己的 key 验证。

Mock 提取只精确匹配页面列出的六段演示原文，**不宣称能解析任意文本**。修改为其他询盘后使用 Live 或手动表单。Live 失败会明确显示错误；可手动选 Mock 案例，或使用邮件“safe local template”按钮，不静默伪造 AI 成功。

## Token 与费用估算
估算而非实测：一次短询盘解析约 1800–3500 input tokens（含指令与 schema）、900–2200 output tokens；一次事实锁定邮件编排约 3000–6000 input、300–1000 output tokens。语言、输入长度、约束数量和模型 reasoning 会改变用量；API 响应的 usage 在 Live UI 显示，Mock 显示无付费 token。

核对日 2026-10-31，官方 GPT-6 Luna 模型页给出的每百万 token 普通 input/output 价格为 $0.10/$0.50；模型/服务档位改变时请重新查价。[官方模型价格](https://developers.openai.com/api/docs/models/gpt-6-luna)、[完整价格表](https://developers.openai.com/api/docs/pricing)。

计算方法：`成本 = input_tokens / 1e6 × input单价 + output_tokens / 1e6 × output单价`。例：解析 2500 in + 1500 out ≈ $0.001；邮件编排 4500 in + 700 out ≈ $0.0008；一轮约 $0.0018（美元）。这是忽略缓存、服务档位、额外 reasoning/失败调用与税费的规划示例，不是账单承诺。输出上限约束单次输出，不是账户美元硬预算；还应在供应商后台设置项目预算/告警。

SDK 自动重试为 0，超时和校验失败不自动重试；最大询盘 6000 字符、请求体 32KB。当前限额是单进程共享的基本防误调用措施，不适用于多实例生产环境。应用不记录完整询盘或 key，也不持久化客户数据；Live会传给选定供应商。OpenAI adapter使用store:false；DeepSeek Chat不附带未经文档化的store参数。两者都不应据此承诺第三方零保留。

## 三分钟重点演示
1. `/selection` 点击 **Chile Distributor Inquiry**，强调“Mock · no AI API called”；展示原始西语、ES、1800 W、15 min、5 台、智利和对应原文。
2. 展示 VA/PF、电压、相数等 Unknown。“compacta y confiable”也被保留为需澄清的附加要求；不自动猜机架形式。
3. 不添加未知事实，勾选已审查原文与字段，点击 Run shortlist。多台的每台负载分配未确认时保持 Pending；可说明如果客户确认每台 1800 W，才额外勾选每台负载确认。
4. 展示两个 SRT Pending、SMT 因 Online 拓扑冲突 Not Matched；展开原因、官方来源与追问。没有完整匹配，不声称满足 15 分钟。
5. 点击 Generate sales reply，默认西语 Mock/模板；展示待确认项、数量与下一步，不虚构价格/库存/在售。编辑、复制或下载原文+提取+需求+结果+邮件 JSON。

英文/中文、单位换算、VA 超限、3kW 和 rack/frequency 等另外五个案例也可完整操作。多台“3kW overload”需明确客户确认该负载为每台后，才判定各机型容量超限。

## 已实现与验证限制
- 已实现：服务端 Live adapter、严格输出/原文/单位校验、人工确认门槛、唯一规则边界、服务端重算邮件事实、可编辑复制下载、六个 Mock 闭环、超时与限额。
- Mock：预定义多语种提取与固定模板/编排，不是实际模型推理；UI 与审计记录明确标记。
- 邮件：Live AI 只编排完整已批准事实和选择批准的措辞；技术正文由规则固定渲染，**不是自由生成销售话术**。手动编辑后标记未校验。没有自动发送。
- 未真实验证：项目 API Key、Live 模型权限、真实多语种响应质量、真实耗时与账单。本轮没有付费 API 调用。
- 尚缺官方技术/商业证据的字段仍保持 Unknown，产品 JSON 不修改。后续范围按用户授权的4A/4B准备记录。

架构与可信边界见 `docs/PHASE-3-ARCHITECTURE.md`；规则协议见 `docs/SELECTION-RULES.md`。

## Phase 3 最终验收（2026-10-31）
- `pnpm test`：138/138 通过；原数据约束 10 项、原规则 67 项文件逐字节未改，新增 AI/流程 49 项、SDK/API 12 项。
- `pnpm run lint`：0 错误/0 警告；`pnpm run typecheck`：通过；`pnpm run build`：通过。TypeScript 单独检查在构建结束后运行，避免与 Next 生成类型文件相互竞争。
- `/`、`/selection` HTTP 200；Mock 解析和邮件实际经生产 API 路由成功，不依赖真实 key。GET 可用性返回 Live=false，默认 Mock。
- 浏览器六个案例完整闭环通过；人工确认阻断、原文证据、修改后失效与重新选型、草稿编辑警示、复制和完整 JSON 下载均实测通过。
- 1440px 桌面和 390px 移动端无横向溢出；最终浏览器检查未捕获 error/warn。
- 生产浏览器静态 JS 未包含 OPENAI_API_KEY、浏览器绕过标志或测试 key 标记。产品 JSON 与 Phase 2 源码包逐字节一致。
- 实测发现的 loopback Origin/Host 差异已修复并添加回归测试；未绕过同源检查。
- 智利案例已保存在 outputs/CHILE-DISTRIBUTOR-INQUIRY.json、outputs/CHILE-DISTRIBUTOR-REPLY.es.txt，来自实际 UI 下载记录。没有为演示填补未知值或假定每台负载。
- 本地验收服务结束时停止；未公开部署，未发起付费 Live API 调用，未进入 Phase 4。

## Phase 4A：业务验收与面试展示
用户已授权本阶段，原 Phase 3 的停止边界已更新。产品 JSON 和原四个测试文件（138 项）不变；六个 Mock 询盘原文不变。新增 `tests/business-acceptance.test.ts` 的 38 项测试。报告见 `outputs/PHASE-4A-ACCEPTANCE.md`，三分钟讲稿见 `outputs/PHASE-4A-INTERVIEW.md`。

`/selection` 新增业务痛点与职责说明、四步跳转、提取快照、客户/厂家待核验重点、可直接进入回复的候选摘要。仍须人工确认；编辑需求会清除旧选型和邮件。快照展示原始提取，当前需求以可编辑表单及确认后结果为准。

提取证据校验增加方向电压绑定（不能把 output 的数字当 input）、负数符号保留、否定/备选证据保守置空。复杂句法、引述、跨句矛盾和模型漏提仍可能超出字面校验能力；源片段不是自动语义证明，不能取消人工审核。未提供的参数不会按国家或型号推断。

### Live 安全与用量审查
- `server-only` adapter；key/模型通过服务端环境变量，`AI_PROVIDER=mock` 仍为默认。浏览器不接收 key。仅配置可用不代表账号/模型已验证。
- SDK Responses `parse` + strict Zod format，检查 completed、非空输出、原文依据；邮件严格检查全部 fact IDs 并由服务端原库重算，拒绝额外正文或状态。
- 6000 字符、32KB 流式体、25 秒、0 重试、独立输出 token cap、进程限额、同源校验、no-store / store:false 均保留。无完整询盘、密钥或 SDK 错误正文日志。
- 服务端 Token 统计仅接受非负整数。Live 未返回可信 usage 时显示“成本未知”，不显示免费；Mock 无付费 token。不是持久账单台账，失败请求也可能收费，应核对供应商账单。
- 官方接口依据：[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)、[Token counting](https://developers.openai.com/api/docs/guides/token-counting)（2026-10-31 核对）。结构约束并不能证明业务语义正确。模型与价格仍沿用上方带日期说明，需实际账号验证。

### 可选 Live Smoke Test（本轮不执行真实调用）
安全默认：

```sh
pnpm run smoke:live
```

只打印 dry-run，不访问本地 HTTP 或供应商。脚本不自动被 test/build 调用。**以下仅是获得后续付费授权后的操作说明，本轮未执行：**

1. 使用独立项目 key，在供应商设置低额度和告警；本地 `.env.local` 按文末DeepSeek配置设置key、模型和付费开关，重启本地服务。不要把 key 传给脚本或浏览器。
2. 人工批准后显式执行：

```sh
ALLOW_PAID_SMOKE_TEST=yes pnpm run smoke:live --execute-paid
```

可选 `SMOKE_BASE_URL=http://127.0.0.1:3000`。脚本只允许 HTTP loopback，拒绝重定向，最多一个 Live 提取 POST、不重试；失败立即停止。它核对智利案例关键字段与未知项、quote 原文存在性，只打印通过状态和用量；不打印原文/响应/key。不自动确认需求，不生成或发送邮件。

3. Smoke 只验证提取路径；随后人工复核字段再在 UI 验证邮件编排、来源与 caveat，记录时延和 usage，用本文公式核算。不要把脚本通过当作任意询盘质量验收。
4. 完成后恢复 `AI_PROVIDER=mock` 并重启。脚本双开关只保护脚本；4B另有服务端 `AI_ALLOW_PAID_CALLS` 默认关闭。启用后Live UI仍可付费调用，不是美元硬预算。

### 验收与后续边界
176/176 单元测试（原138 + 新38）通过；Lint、生产构建和构建后独立 TypeScript 检查通过。生产浏览器 Chile 闭环、未确认阻断、人工修改后失效/重算、1440px/390px 布局通过，控制台无 error/warn。产品 JSON、原138项测试、六个询盘文件与 Phase 3 ZIP 逐字节一致。

本轮没有真实 API 付费请求，也没有公开部署。待核验产品规格/商业信息维持原状态。整个 Next 服务不可访问时，服务端 Mock 路由也不能运行；OpenAI 不可用不影响 Mock，手动规则和明确的本地邮件模板仍是独立兜底。多实例限额、鉴权、美元硬预算、客户数据保留策略与生产可观测性需在部署前补齐；具体后续计划见验收报告。


## Phase 4B 当前配置：DeepSeek 优先，默认 dry-run

DeepSeek adapter使用官方 `https://api.deepseek.com/chat/completions`，默认 `deepseek-flash`，仅支持另一个明确模型 `deepseek-v4-pro`。复用现有SDK，不需要OpenAI账号/key；原Mock与可选OpenAI adapter保留。[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/) 要求json_object、JSON提示和示例；本地继续严格Zod/来源/单位/规则/邮件事实校验。DeepSeek Responses兼容接口存在，但本轮不声称与原OpenAI严格Structured Outputs完全等价。

**已在对话中贴出的密钥应撤销换新；本轮未将其写入任何文件，也未使用。** 若已有 `.env.local`，直接在本地编辑器修改；没有才从 `.env.example` 复制。不要把真实key贴进对话、网页表单、命令行参数或Git。

安全默认（占位符示意，切勿填入已泄露key）：

```dotenv
AI_PROVIDER=mock
AI_ALLOW_PAID_CALLS=no
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
```

付费开关关闭时，即使配置了key，Live也不允许发送请求。模型切换只改 `DEEPSEEK_MODEL=deepseek-v4-pro` 后重启，接口地址固定，不能由浏览器或请求改写。UI解析与邮件均默认Mock；Live分别要求模拟/人工匿名化确认，并在服务端拦截明显email、凭据与长电话号码；人工仍须清除姓名、联系信息、真实内部项目资料等，不能把正则当完整匿名化系统。

### 第一次真实 Smoke Test：操作说明，尚未执行

1. 在DeepSeek控制台撤销对话中出现的key，新建key并检查余额/用量控制；在本地编辑器的 `.env.local` 中配置新的 `DEEPSEEK_API_KEY`。默认先保持付费开关关闭。
2. 验证无网络准备命令：

```sh
pnpm run smoke:live
pnpm run eval:prepare
pnpm run test:evaluation
```

3. 获得明确付费执行授权后，才在 `.env.local` 设置 `AI_PROVIDER=deepseek`、`AI_ALLOW_PAID_CALLS=yes`，确认模型，重启 `pnpm run dev`。另一个终端明确执行：

```sh
ALLOW_PAID_SMOKE_TEST=yes pnpm run smoke:live --execute-paid
```

脚本默认期望DeepSeek，且只接受loopback、拒绝重定向；先GET校验配置，再最多一个Live提取POST。只发送固定模拟智利原文，带模拟数据确认；无自动重试、人工确认或邮件生成。成功输出计量与核验标志，错误详情在服务端仅保存稳定码。若失败/超时，先检查本地聚合日志与后台账单，不直接重跑。旧OpenAI可选脚本需额外明确 `SMOKE_PROVIDER=openai`，不会自动切供应商。
4. Smoke通过后，人工审核字段和unknown，再在UI确认选型。Live邮件必须另选Live并确认匿名化，是独立计费调用；不会因Live提取自动开启。未知技术事实仍不能变Matched。
5. 验证结束恢复 `AI_PROVIDER=mock`、`AI_ALLOW_PAID_CALLS=no` 并重启。不要在面试中无意开启付费或上传真实客户文本。

### 每次调用的计量与成本

API响应带 `telemetry`，成功界面显示model、latency、Token、估算USD。实际provider尝试（包括失败）写本地忽略目录 `work/ai-call-metrics.jsonl`；测试写独立 `work/test-ai-call-metrics.jsonl`、testOnly=true。字段仅ID/时间/provider/配置模型/任务/耗时/用量/稳定错误码/成本估算，无客户正文、回复、推理、key或SDK错误内容；SDK日志强制off。不是客户询盘数据库或供应商账单。

[DeepSeek官方价格](https://api-docs.deepseek.com/quick_start/pricing/) 于2026-10-31核对，以下为USD/百万token的峰时保守计价，全部输入按未命中缓存：

| 模型 | 输入cache miss | 输出 |
| --- | --- | --- |
| deepseek-flash | $0.30 | $1.20 |
| deepseek-v4-pro | $1.32 | $3.96 |

`estimateUSD = (inputTokens × inputRate + outputTokens × outputRate) / 1,000,000`。缓存命中Token若提供会记录，但估算不折扣；非峰时/缓存实际费用可能更低。价格会变，真实调用前重新核对。未知Token/模型、API失败无用量时成本为null，不当作免费。

规划例（**非实测**）：解析4000 input + 2000 output → Flash $0.0036；邮件6000 input + 700 output → Flash $0.00264；完整一轮约$0.00624。15例若各解析+邮件约$0.0936，仅为该假设的算术结果；无W/矛盾案例不能自动进入邮件，也没有自动批跑。Pro同假设一轮约$0.023892。实际schema长度、语言、约束、失败与重试都会改变用量；输出上限4500/1200仍在，非美元硬预算。失败请求可能已收费。

记录延迟涵盖service调用及输出校验，不含写盘时间；记录模型是配置别名，不证明固定后端快照。写盘失败显示persisted:false，不能为补日志再次付费调用。文件没有自动轮转，仍需本地保留策略；多实例计量/预算与鉴权要在部署前单独实现。

### 本轮验收与15例准备

原176项测试不变，新 `tests/deepseek.test.ts` 47项（包含15例参数化闭环），共223项通过。覆盖JSON Output调用形状、空/非法/Schema错误、截断/超时/API失败、隐私/付费门槛、日志与成本、EN/ES事实锁定及15例模拟响应。Lint、TypeScript、生产构建通过。产品JSON与原六例原文保持不变。

15例清单：`tests/fixtures/phase-4b-evaluation.json`。当前仓库未找到先前独立15例清单，故以原六例+九个业务边界补建并固定；不是宣称恢复未见过的外部计划。`eval:prepare`只显示not_run；离线测试是兼容性与管线验收，不是模型质量/延迟/账单实测。完整计划见 `docs/PHASE-4B-PLAN.md`，交付见 `outputs/PHASE-4B-DEEPSEEK.md`。真实API与部署均未执行。

## 中文界面增量（2026-10-31）
按用户新授权将界面默认改为简体中文：询盘、表单、证据标签、选型状态与主要理由、追问、邮件操作、用量与错误提示及产品目录。原始询盘、字段quote、官方产品名称/来源备注及英/西语邮件保留原文。翻译仅在展示层，不修改产品JSON、六条原询盘、规则引擎或原223测试。已同步到用户实际运行的解压目录，不读取或修改.env.local，不调用付费API。

中文界面验收：原223项单元测试通过；Lint、TypeScript和主项目production build通过。浏览器模拟智利询盘的中文提取/证据/选型/西语邮件、真实模式中文确认提示及中文目录通过。原产品JSON、规则引擎、六条询盘及测试文件校验和不变。保留厂家与核验备注原文，少量罕见技术说明可仍显示英文原文，不作AI翻译。未读取或修改用户密钥，未执行付费调用。

## 客户简洁版邮件（2026-10-31，用户新增授权）
保留原完整技术邮件协议，服务端根据同次selectProducts报告增加customerEmail；不增加provider调用、不改变规则或产品事实。界面默认展示简洁版，可切换详细技术版，两个版本分别保留人工修改。简洁版保留需求、候选状态、硬性冲突、全部必要待核验条件的分组摘要、关键追问、附加约束及续航/商业限制；详细版及下载记录保留逐项证据。原有已生成邮件可在本地切换整理，不必再次付费。

本次邮件增量实际验收：237/237单元测试通过，原223测试文件及产品JSON/规则引擎不变；已有真实邮件本地生成251词西语简洁版，浏览器切换、编辑保留、复制、双版本下载通过，未额外调用AI。TypeScript编译器API已通过（同一tsconfig，54文件，0诊断）；Lint与production build进程长时间等待，已停止，不能宣称本次这两项检查通过；详情见outputs/CUSTOMER-MAIL-UPDATE.md。TypeScript排除outputs/work，避免把导出的项目副本纳入源代码检查。
