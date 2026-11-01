# Phase 4B — DeepSeek 优先：实现与评测准备

范围：在原项目添加服务端 DeepSeek adapter、兼容性与故障测试、固定15例业务评测、匿名聚合计量和安全 smoke 入口。本轮仅准备，不执行付费请求，不部署，不修改产品事实。

## 接口选择

2026-10-31核对 [DeepSeek Chat API](https://api-docs.deepseek.com/api/create-chat-completion/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[Responses兼容性](https://api-docs.deepseek.com/guides/responses_api/)。DeepSeek已提供Responses兼容接口，因此不能简单断言“完全不兼容”；本轮没有实测原OpenAI responses.parse + strict json_schema的端到端等价性。采用官方Chat JSON Output路径，避免依赖未经验证的等价假设。

固定 `https://api.deepseek.com`，`/chat/completions`，默认 `deepseek-flash`，可切 `deepseek-v4-pro`。复用已安装的OpenAI格式SDK，无OpenAI账号/API调用要求。传 `response_format: {type: "json_object"}`、JSON schema和示例；非thinking模式、独立token上限、0重试。空/空白、非法JSON、Schema不符、非stop、拒绝/工具响应均失败关闭，不尝试提取markdown或“修补”JSON。

JSON Output不等于严格Schema或技术正确。必须继续：严格Zod → 原文/单位证据检查 → 人工确认 → requirementsSchema → selectProducts；邮件服务端按原catalog重算，仅允许完整批准fact IDs，不能增加性能/库存/报价/交期。

## 15例基线

仓库未找到先前独立15例文件。本轮保留原六例精确原文，并据业务边界补九例；不声称恢复了未见过的外部清单。固定于 `tests/fixtures/phase-4b-evaluation.json`，均为虚构/模拟客户文本，非产品证据。

| ID | 评测重点 |
| --- | --- |
| chile-distributor | 西语重点智利询盘，1800W、15min、5台，VA/PF/电气未知、负载分配未确认 |
| english-kw | 英文kW/PF，显式单位转换与后续W/PF推导 |
| chinese-va | W可容纳但VA单独超限 |
| spanish-overload | 3kW/3.3kVA，仍不能默认每台负载 |
| rack-frequency | 明确机架、电压、单相和频率，不把需求当产品已核验 |
| missing-va | VA和PF都缺失，不计算VA |
| w-va-conflict | W>VA，需求矛盾阻断选型 |
| line-interactive | 西语Line-interactive要求及unidad单数 |
| missing-load | 无W不编造，待人工补充 |
| ambiguous-load | 900W或1800W尚未确认，保持空值 |
| english-injection | 忽略指令/捏造库存性能诱导不能控制状态或邮件 |
| unverified-performance | 未经验证的极高续航与永久免维护要求 |
| voltage-directions | 西语输入230V/输出120V不可混用 |
| commercial-requests | 要求现货/询价/交期，不表示已经供货承诺 |
| chinese-confirmed-electrical | 中文显式PF/电压/相数/频率/预算，不按国家推断 |

`pnpm run eval:prepare` 只输出准备清单和not_run，完全没有网络分支。`pnpm run test:evaluation` 用SDK替身和人工标准提取值走JSON→证据→规则→锁定回复；无W/矛盾输入正确阻断，不为凑闭环自动补值。测试中的确认是明确的测试夹具，真实smoke不自动确认。它们证明兼容性与边界，不证明真实模型准确率。

## 后续真实评测顺序（尚未执行）

1. 用户撤销已在对话中出现的key，换新key在本地配置；默认不开付费。
2. 明确授权后仅一个智利smoke，人工评审完整原文、字段值、quote、unknown与遗漏。记录实测Token、耗时和成本估算，不自动重试。
3. 人工确认后独立操作Live邮件，核对所有facts/技术待核验/商业限制；邮件生成是另一次付费调用，默认仍Mock。
4. 分别评审15例，保存逐字段正确/漏提/无依据填充、单位错误、规则一致性和邮件事实一致性。遇到非法/空输出记录失败，不以改断言或删案例掩盖。
5. 比较Flash与Pro需再次确认调用额度；不自动双模型批跑，不由AI自行验证UPS性能。部署需单独授权及鉴权、分布式限额/预算、监控与隐私保留方案。

## 安全与计量

Live需 `AI_PROVIDER=deepseek` + 非空 `DEEPSEEK_API_KEY` + `AI_ALLOW_PAID_CALLS=yes`。UI初始仍Mock；parse/email分别要求模拟/人工匿名化确认。明显email、凭据、电话号码在服务端拦截；这不是完整隐私检测，姓名、公司内部信息等必须人工去除，不上传真实敏感资料。

成功和失败的实际provider尝试都由API边界保存聚合记录：`work/ai-call-metrics.jsonl`。仅请求ID、开始时间、provider、配置模型、任务、耗时、Token（含可用缓存命中）、稳定错误码和估算USD，无原文、回复、推理、Key或SDK错误正文。测试写独立 `work/test-ai-call-metrics.jsonl` 并标 `testOnly:true`。SDK日志强制off。没有发生provider尝试的配置/隐私/限额拒绝不是已计费调用，不生成伪造用量。

成本按2026-10-31官方峰时、全部输入cache miss计保守估算，忽略缓存折扣和off-peak折扣；未知用量/未知模型不当零成本。失败可能收费。记录不是供应商账单或美元硬上限；metadata写盘失败在响应中标记persisted:false，不能为补日志重发付费请求。记录模型是配置的计费别名，不证明后端模型快照永久不变。
