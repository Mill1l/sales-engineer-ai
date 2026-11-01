# Phase 4A 业务验收增量

复用 Phase 3 架构；没有替换catalog、requirementsSchema、确定性规则引擎或两个API协议。

```text
原始询盘（不可信数据）
  → parse schema / server-only provider / timeout & cap
  → strict extraction DTO
  → quote存在 + 单位/方向/符号/歧义校验
  → 人工复核可编辑表单（所有未知保留）
  → requirementsSchema → selectProducts
  → 三状态 + 检查理由/证据/客户与厂家追问
  → 服务端 catalog 重算 → approved MailFact 集合
  → AI/Mock 仅编排完整fact IDs → 校验 → 确定性正文
  → 编辑/复制/下载；不发送
```

WorkflowGuide 和 ShortlistBrief 只渲染提取快照/规则输出，不产生额外产品事实。快照不随人工修改重写；表单与结果展示当前确认需求。任何字段编辑清除确认、旧规则结果与邮件。

numericEvidence 对输入/输出分别绑定其方向附近数值；同一quote出现多个不同同类值或否定/备选描述保守留空，显示待人工确认。此校验不是完整语义证明；仍需查看完整邮件，特别是跨句矛盾、引述与漏提。

validatedUsage 在服务边界验证计量。Live缺失计数为unknown，不是零费用；失败调用的计费只可从供应商账单确认。没有引入日志存储、遥测或客户数据数据库。

scripts/live-smoke.mjs 不被app导入；默认无请求。显式 paid 参数 + 环境开关后只访问loopback，GET确认配置，再最多一次Live提取POST；没有自动确认或邮件请求。脚本开关不是UI全局付费锁，Live UI仍需有意识配置与操作。

测试及安全审查见 outputs/PHASE-4A-ACCEPTANCE.md；真实API与部署只提供计划，均未执行。
