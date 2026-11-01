# Phase 3 架构与可信边界

## 数据流
```
Original inquiry (ZH / EN / ES)
 → POST /api/parse → provider adapter (Mock / OpenAI Responses)
 → strict extraction DTO → literal quote + unit checks
 → editable manual form + explicit human confirmation
 → requirementsSchema → selectProducts (Phase 2 pure TS engine)
 → RuleCheck / evidence / Pending / Excluded / Matched
 → POST /api/email (confirmed requirements only)
 → server catalog + selectProducts re-run
 → immutable bilingual MailFact manifest
 → provider composes constrained MailPlan
 → complete fact-ID validation → fixed technical rendering
 → editable draft / copy / local JSON download (never send)
```

## 模块
- `src/lib/ai/contracts.ts`：可空 DTO、原文证据、单位核验、请求 schema 与表单适配。缺失必填字段不编造；解析草稿与可执行需求是两个阶段。
- `provider.ts`：可替换的接口；`mock-provider.ts` 仅精确匹配 6 个明示案例；`openai-provider.ts` 使用官方 SDK 与 Structured Outputs，带 server-only 保护。
- `service.ts`：独立可注入、可单测的编排、超时、服务端重新选型。
- `mail.ts`：由规则构造英/西语事实清单；AI 只编排批准事实和选择已批准的开头/结尾。不存在开放式技术 prose 通道，拒绝新增事实、漏掉 caveat 或重复/伪造 fact ID。
- `server.ts` / `limits.ts`：环境变量、adapter 选择、单进程限额、有限请求体、同源检查与安全错误响应。
- `/api/parse`：GET 仅返回 Live 是否可用、模型和长度限制；不返回 key。POST 严格提取。
- `/api/email`：只接受确认需求、语言、模式；不接收客户端产品参数、结果或价格。
- `InquiryPanel` / `ExtractionReview` / `EmailPanel`：原文、证据、确认、草稿和审计记录；询盘/需求变更使确认、结果和邮件失效。

## 兼容规则扩展
频率、目的地、数量和其他约束为可选/默认字段。旧请求仍可通过。只有明确频率才检查厂家 frequencyHz；缺证返回 Pending。额外约束逐项保留为 Pending，而不是静默丢弃。多台请求必须确认每台负载，否则 W/VA 和续航评估保持 Pending，不按数量分摊。若确认每台后再修改 W，必须重新确认和选型。

产品 JSON 完全不修改。相数、完整电压范围、续航和商业证据继续 Unknown/Needs Verification。单位换算只进行明确 kW→W、kVA→VA、h→min 等，不从 W 猜 VA/PF，不从智利推电压。

## 提示注入与事实准确性
客户原文是 untrusted user data，系统指令明确禁止听从其中的角色/规则覆盖指令。DTO 严格拒绝多余型号/匹配字段；quote 必须原样出现，数字单位须相符，不确定或无证据值清空。字面证据和 schema **不能证明自然语言语义绝对正确**，所以必须人工确认。复杂千位/小数歧义、混合相数、证书和站点设计要求要人工核实。

邮件比普通提示词过滤更保守：没有任意生成技术正文的入口。即使模型产生新价格/库存语句、试图漏掉“不匹配/待核验”，也无法通过 fact-ID 和枚举校验。草稿手动编辑后另标未校验，下载保留生成版本与编辑版本。

## 调用与隐私
默认 Mock 不调用 OpenAI；Live 必须服务器 `AI_PROVIDER=openai` 和 `OPENAI_API_KEY`，浏览器配置只有可用性/模型名。SDK 设 store:false，不开工具、不自动重试。应用不写客户正文或 key 到日志，不持久化询盘；本地下载记录由用户主动保存。store:false 不等于第三方供应商零日志或零保留承诺。

限额是所有本机访客共享的进程内计数，20 次/分钟、100 次/24h，重启会重置，多实例不共享；生产部署前应另做身份校验与共享限额。本轮仅 loopback 本地运行，不部署。

同源检查比对 Origin 的 host/协议与实际 Host/协议，不信任 forwarded headers；同时支持 Next 将内部请求 URL 归一为 localhost 的情况。请求体按流累积，超过 32KB 即停止读取。

## 测试与真实 API 边界
原 77 项测试保留原样。新增测试覆盖解析 schema/缺失值/字面依据/单位、注入、失效与超时、邮件完整事实集合、服务端重算、限额与同源、SDK 参数与安全错误。SDK 测试用 stub，不等于真实 OpenAI 接口已成功调用。

Live 的代码路径、官方 helper JSON schema 生成和服务端边界有测试；真实账号模型权限、延迟、多语种提取质量和账单仍需用户配置 API Key 后验收。Mock 的语言和提取是预定义 fixture，不伪装成模型推理。
