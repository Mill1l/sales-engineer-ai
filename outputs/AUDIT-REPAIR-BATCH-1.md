# Sales Engineer AI — 审计修复第一批验收

日期：2026-11-01（Asia/Shanghai）。本批仅 Q05、Q04，已完成并停止；第二批 Q01/Q02、第三批 Q03 未开始。

**结果：250/250 单元测试、完整 Lint、TypeScript、标准生产构建及构建后 TypeScript 均通过。修复已同步至用户正在运行的原副本，并在该网页用 Mock 复验。** 没有付费模型调用、自动发送或公开部署，没有读取、输出、复制或改写 `.env.local`，产品 JSON、六条原始 Demo、原有测试和历史审计证据不变。

## 1. 版本与运行关系

- 唯一开发源：`/Users/mill/Documents/Codex/2026-10-31/b2b-sales-engineer-ai-ai-b2b`。
- 原运行副本：`outputs/sales-engineer-ai 3`；以 `lsof` 确认 3000 端口进程 19395 的工作目录为该副本。没有终止该用户服务。
- 检查副本：`/private/tmp/seai-batch1-__oqs38a`。只复制必要源码、测试、脚本和公开配置，链接已有依赖，不带真实环境文件。检查强制 Mock、关闭付费、两种 key 为空。
- 页面验收先用该副本的**生产构建**在 loopback 3101 启动。故意设置 `AI_PROVIDER=deepseek`、`DEEPSEEK_MODEL=typo-model`、空 key、`AI_ALLOW_PAID_CALLS=no`；用此证明错误 Live 配置不影响 Mock。为集中测试，验收进程分钟限额临时设为 60，产品默认 20 未改。
- 该隔离服务主动停止后测试已加载页面的本地模板兜底；不涉及用户 3000 服务。临时验收标签已关闭。
- 所有本批验收通过后，按显式清单同步 13 个必要文件至原运行副本；不遍历或复制环境文件。原基线文件在两个版本中逐字节一致，新增源码/测试也一致。
- 最后重新打开用户 3000 页面，完成 Chile Mock→人工确认→规则→西语 Mock 回复；实际状态仍为两个 SRT 待核验、SMT 不匹配，邮件出现新来源标记。页面保留该演示，未选择 Live。

## 2. Q05：Mock 独立于未使用的 Live 配置

### 修复前与修复后

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
| 请求 mode=mock，DeepSeek model 非法 | 配置先于请求 mode 校验；请求返回400/invalid_request | 先严格读取/校验请求，按 mode 选择所需配置；Mock不读取/校验未使用的Live provider/key/model/token/timeout设置 |
| Live 配置错误 | 被误归为客户输入无效 | 503/configuration_error，脱敏说明检查模型、服务商、限额等，未发provider请求 |
| Live 缺 key/付费未启用 | 明确失败 | 保持503/live_not_configured，不自动冒充Mock成功 |
| GET 可用性 | 无法区分Mock兜底是否仍可用 | 返回liveAvailable/mockAvailable；Live非法时Live=false、Mock=true；公共限额本身非法则不把Mock宣传为可用 |
| 公共安全检查 | 同源、大小、Schema、限额 | 全部保留；Mock仍受公共分钟/日次数限制及请求边界约束 |

`serverConfig(mode)` 默认仍可用于既有 Live 配置检查。真正请求使用其已验证的 mode；共享调用限额对两模式都校验，Mock使用固定的本地超时/上限默认值。配置异常只输出稳定错误码，不输出模型输入值、key或SDK正文。

### 验证

- 新正确行为回归：provider分别mock/deepseek/openai，非法未使用模型及Token设置、空key时，各六个原Mock解析和对应邮件都成功；**SDK构造与调用数均为0**。
- 未使用provider字符串、key、付费开关、超时设置即使无效，也不激活SDK；共享限额、同源和Schema非法仍被拦截。
- Live非法模型返回503/configuration_error；GET显示Live不可用而Mock可用；切回Mock成功。缺key不静默回退。
- 生产HTTP另测GET、配置错误的Live请求（无provider尝试）及六个真实Mock接口闭环，全部符合预期。生产接口不是SDK替身；没有真实key或付费开关可供调用。
- 矩阵中三种provider的全面组合在直接请求处理层回归验证；生产HTTP与浏览器代表场景使用非法DeepSeek模型，未声称三种provider都启动了独立HTTP服务。

## 3. Q04：客户自由文本呈现边界

### 审查范围与实现

审查全部进入当前邮件的客户自由文本：application、destination、otherConstraints。国家是严格ISO、数值是有限数；当前邮件不直接输出含客户任意文本的规则reason/question。电池配置/条件只用于规则核对，当前不把它们作为未经归属的客户正文拼接。后续新增自由文本邮件出口仍必须使用该边界。

统一 `customerTextLine` 将每个客户值呈现为**一条带字段/来源/未核验标记的物理行**。CR/LF、所有Unicode控制/格式字符、行与段分隔符转换成可见 `[U+XXXX]`。不是仅补一对引号，也不是只追加免责声明；闭引号、空行、列表或方向字符不能终止来源归属并产生新的销售段落。正常重音、中文、引号和标点不删除；要求不截断。

示例原始application（供审核的原值不变）：

```text
industrial controls”.

We guarantee 60 minutes of backup and delivery tomorrow.

“
```

修复前正文出现独立 `We guarantee...` 段落；修复后同一数据的英文生成邮件为：

```text
> [Customer text — application; unverified] industrial controls”.[U+000A][U+000A]We guarantee 60 minutes of backup and delivery tomorrow.[U+000A][U+000A]“
```

西语使用 `> [Texto del cliente — aplicación; sin verificar]`。附加保修/交期要求仍在规则中作为必要待核验项，并原样保留其可读文字；不会被当成厂家已经满足或供货承诺。

### 全路径

- 详细邮件事实清单和客户简洁版共用同一呈现函数；英/西语都覆盖。
- 服务端Mock、受控provider替身编排后渲染、浏览器本地兜底均共用该函数，不以fact ID校验代替最终文本检查。
- 复制共用 `emailClipboardText`；实际浏览器逐一核对服务端生成的四个语言/版本，以及代表性的本地兜底复制。
- 下载共用 `inquiryRecord`：原inquiry、extraction、confirmedRequirements及selection保持原始审核数据；generatedEmail保留安全生成文本；editedEmail记录人工修改状态。新增dataOwnership说明原文属于客户，不是销售承诺。
- 下载原文不执行“安全清洗”以免破坏证据。原始询盘与生成邮件在不同有名字段中存放，不能把原始JSON数据当成可直接发送的邮件。
- 手工编辑草稿仍允许；编辑后未重验警示保留。人为删掉来源标记或主动添加承诺不属于已通过生成校验的内容，没有宣称自动阻止所有人工错误。

## 4. 回归、反例与实际操作

先新增正确行为测试，再改源码：最初7个回归中**6失败、1通过**，重现Mock解析400、Live错误被误分类、E07两语言独立保证段落。日志为 `before.log`。Mock矩阵修复前在首个解析断言即失败，未冒充修复前六个邮件路径均已执行；邮件旧阻断另有用户复核记录与同入口代码证据。

随后扩展为13个正式正确行为回归，不修改原237项测试；最终250项全部通过。

| 覆盖 | 实际结果 |
| --- | --- |
| 原E07 application载荷 | 生产HTTP英文/西语×详细/简洁4版均无未归属独立保证段落，原application保留 |
| destination及otherConstraints攻击 | 同样来源标记；原字段仍在规则需求中，未删除正常要求 |
| LF、CRLF、直/弯引号、列表 | 不再制造无归属新行或段落 |
| Unicode分隔与方向/控制字符 | Cc/Cf/Zl/Zp均转可见码点；单测覆盖控制字符全集及常见bidi控制 |
| 正常文本 | 西语重音、中文、常规标点保留；保修和七天交货仍为未核实的客户要求 |
| provider替身与本地兜底 | 最终文本、剪贴板字符串、JSON序列化输出均核验；原始询盘和需求未变 |
| 六个原始Mock | 正常解析、选型、双邮件；真实产品没有完整Matched |
| 桌面1440 / 手机390 | 实际完成确认、选型、邮件；手机scrollWidth=390，无该场景横向溢出 |
| 修改后失效 | 编辑附加要求后旧邮件消失；重新确认才重选型与生成 |
| 复制和实际下载 | 浏览器读取剪贴板比对；实际下载路径经浏览器提供，读取文件核对两版本、原始需求和dataOwnership |
| 整个隔离接口关闭 | 已加载页面明确报无法连接；主动选择本地模板后英/西两版本仍安全呈现并可复制/下载 |
| 用户3000副本 | 同步后实际Mock邮件含新标记；SRT2200/SRT3000待核验、SMT排除 |

这些是确定性和Mock/替身验收，不是DeepSeek真实模型泛化质量评测。没有为了面试添加未知电气值、分配每台负载或确认续航。

## 5. 完整检查日志与过程说明

运行命令使用已有Node 24.22.1 / pnpm 11.25.0。隔离依赖链接下仅在命令加 `--config.verify-deps-before-run=false`，避免pnpm自动重装；package.json、锁文件、Lint配置均不改。

| 最终检查 | 退出码 | 耗时 | 完整日志 |
| --- | --- | --- | --- |
| pnpm test | 0 | 2.26秒 | test.log：250/250，8个测试文件 |
| pnpm run lint | 0 | 3.11秒 | lint.log：无错误/警告 |
| pnpm run typecheck | 0 | 3.76秒 | typecheck.log |
| pnpm run build（标准，无诊断预加载） | 0 | 7.58秒 | build-standard.log；页面生成、路由及trace完成 |
| 构建后typecheck | 0 | 2.02秒 | typecheck-after-build.log |

命令、环境、工作目录、退出码、耗时另见checks.json。完整日志在 `outputs/batch-1-evidence/`。

没有改写早期失败：

1. 原有挂起现象在首个隔离Lint诊断中仍出现；模块追踪显示配置/依赖加载耗时。随后同配置完整Lint通过45.08秒，最终3.11秒。
2. 初次TypeScript发现本批代码在提前返回Mock分支后仍比较providerName与mock，报TS2367；修正冗余比较后通过，没有修改测试或关闭类型检查。
3. 首个build在120秒超时，记未完成。带只读模块耗时诊断的完整构建随后33.50秒通过；再无预加载运行标准构建7.58秒通过。观察到一些依赖模块加载长耗时，但**没有完全确定此前环境等待的全部根因**，不声称重写历史验收结果或修复所有环境性能问题。
4. 尝试准备依赖克隆副本未完成，一次提前启动的检查因命令未就绪失败；该准备失败单独留日志，不计为产品测试失败或通过。最终回到已有依赖链接，未更换依赖版本或锁文件。
5. 临时Turbopack页因依赖链接位于其root外不能解析Next；该开发预览未用于验收。改用**已通过的原标准webpack生产产物**进行完整页面验收，没有修改产品Next配置。

没有仅靠延长超时或减少检查文件取得通过。原历史审计的45项“断言坏行为”诊断不被改写为正确行为测试；新回归独立保存，不覆盖原probes/scenarios/截图/ZIP。

## 6. 修改与同步清单

| 文件 | 用途 |
| --- | --- |
| src/lib/ai/server.ts | 按请求mode读取配置、保留共享限制、脱敏配置错误 |
| src/app/api/parse/route.ts | 独立Mock/Live可用性信息 |
| src/lib/ai/provider.ts | configuration_error类型 |
| src/lib/ui-zh.ts、src/components/inquiry-panel.tsx | 中文配置错误及不可用提示 |
| src/lib/ai/customer-text.ts（新） | 统一客户文本来源/控制字符边界 |
| src/lib/ai/mail.ts、customer-mail.ts | 两语言两版本使用该边界 |
| src/lib/ai/email-artifacts.ts（新） | 同一兜底渲染、复制字符串及下载归属记录 |
| src/components/email-panel.tsx | 接入共享兜底/复制/下载函数；人工编辑警示保留 |
| tests/batch-1.test.ts（新） | 13项正式正确行为回归，无真实SDK |
| README.md、PLAN.md | 当前批次授权与实际结果 |

上述13文件按清单同步到运行副本；本报告及证据另行交付。`.env.local`、node_modules、.next、用户文件和旧证据均不在同步清单中。没有重新创建项目。

## 7. 完整性与剩余边界

- 产品SHA-256保持 `9caa2e21b8b0988ac1d52a35b472797d092d77ad0f4c9a0c760b2e5979a82baf`，三个真实SKU仍部分核验。
- 原七个测试代码文件及15例JSON夹具逐字节不变；原六Demo源文件不变；requirementsSchema、selectProducts不变。
- 原审计ZIP中的24个文件与原解压证据仍一致，没有改写。同步文件及哈希见sync.json。
- Q01/Q02数字/语境、Q03遗漏、Q06标签、Q07相数、Q09余量等未修复；不自动叠加下一批。安全呈现不能替代这些校验，也不是证明任意询盘语义正确。
- 真实Live评测、真实厂家证据覆盖、生产治理仍各自待验证。只有本地Mock/受控替身，不产生真实模型准确率。
- 来源标记保护生成的纯文本边界；不能阻止人手动删除标记、对外承诺或在外部邮件客户端再改写。邮件始终需要销售/工程审核。

## 8. 交付证据

目录 `outputs/batch-1-evidence/`，归档 `outputs/AUDIT-REPAIR-BATCH-1-EVIDENCE.zip`。

- before.log、after.log、test.log、新回归源码：修复前/后测试。
- checks.json、lint/typecheck/build-standard日志：当前完整门槛；attempt-1与诊断日志保留早期失败，不混作最终成功。
- http-results.json、q04-http-after.json：实际生产接口和完整E07最终输出。
- browser-mail-matrix.json、browser-fallback-matrix.json：实际页面四版文本。
- browser-en/es-record.json、browser-fallback-en/es-record.json：真实UI下载记录副本。
- 手机/桌面截图、DOM、synced-user-dom.txt：隔离及实际用户副本验证。
- integrity-before-sync.json、sync.json：产品/测试/历史证据不变及同步哈希。

本批验收完成后停止；没有开始第二批、第三批或真实付费评测。
