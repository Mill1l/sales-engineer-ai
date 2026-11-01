# Phase 2 规则与复用契约

## 入口
`selectProducts(products: unknown, input: unknown): SelectionReport` 同时校验产品资料与需求，返回 `{ ok: false, issues }` 或 `{ ok: true, requirements, results }`，不会把非法请求变成选型结果。纯 TypeScript 同步运行，不读取环境变量、不访问网络、不依赖 React。

`requirementsSchema` 拒绝未知额外字段。Phase 3 若提取出暂不支持的硬性要求，必须展示为待人工处理，不得先删除字段再静默调用选型。人工确认之后才进入规则引擎。

## 需求数据语义
- 国家、场景和负载 W 必填。空白可选数字由适配器转换为 null，不转换成 0。
- 电气值、拓扑、安装、后备时间、冗余、预算未知时不会当作通过。
- `topology: any`、`runtimeMinutes: 0`、`redundancy: not_required`、`budget: {kind: unconstrained}` 都是明确解除对应门槛的选择，不代表产品能力已核验。
- `phases` 表示输入和输出相同相数（1→1 或 3→3）；混合相数方案需要另行审查。
- 不从国家推定供电，不从场景推定拓扑，不从 UPS 额定功率因数推定负载功率因数。
- VA 已提供时不覆盖；仅 VA 缺失且 W/PF 明确时推导 VA。三项提供但不一致超过 2% 时返回输入错误；这只是数据录入容差，不是设备规格容差。

## 判定
每条 RuleCheck 含 id、label、outcome、required、reason、evidence 及可选 question。

1. 任一 required 检查 failed → excluded。
2. 无失败但存在 required pending → pending_verification。
3. 其余 → confirmed_match。

advisory 余量建议与未要求立即供货时的库存 caveat 不阻断状态，但不会被隐藏或标为已经符合。市场在售和预算空白是必要待确认项。known stock = 0 只有立即供货为硬性要求时才排除。

Matched 是当前结构化硬性条件的结果，不是完整安装设计、报价或采购授权；实际 JSON 的所有三条记录仍为 partially_verified，当前不会得到 Matched。

## 规则细节
- W、VA 分别比较，任何一个已知超限都排除。额定资料未知则待核验。
- 容量余量公式：目标额定容量 = 实际负载 × (1 + marginPercent / 100)。默认 20% advisory；hard 模式才因策略未达标而排除。0% 不取消额定检查。
- 输入电压只比较已核验输入范围，输出电压只比较已核验输出列表；不以标题 nominalVoltageV 代替范围。厂家负载/降额与现场适用性需后续设计确认。
- 相数分别比较输入/输出证据；已知冲突排除，缺证待核验。
- 仅记载 tower 不足以证明不可能 rack。SRT rack 转换需要另购套件，即使客户接受套件仍要确认配件适配和完整报价；明确禁止所需套件则排除。
- 冗余要求须系统审查；已核验资料明确无冗余能力而要求冗余时排除，不从系列名推定能力。
- 续航仅查匹配实际负载 W 的厂家数据点，同时确认电池配置与测试条件；找不到适用点就待核验。没有曲线数据时，手动填写条件也不能制造证据。无插值、无外推、无电池容量换算。
- 预算比较不换汇；仅基础价格低于上限也不足以证明包含税费、运输和配件的整套预算。已知基础价超上限可排除，其余需完整报价审查。
- 来源引用保留字段名、URL、核验日期与 locator。产品记录不因选型操作而修改。

## 排序和追问
状态优先，其次未解决必要检查数，再其次余量是否达标，然后较小的额定 W、VA 和 SKU。额定值未知排后；相同输入与相同证据得到稳定结果。排序是继续评估的优先级，不代表便宜、在售或库存充足。

追问从未解决检查生成并去重，客户需求问题优先，厂家/渠道证据问题另列。结果卡可展开满足项、冲突、待核验项、建议和明确解除的条件；不会把未知项归到满足项。

## 测试证据边界
真实产品数据完整性测试继续保留。完整匹配、已知不兼容相数/电压、厂家续航点、已知商业冲突使用 `tests/selection.test.ts` 内明确标注的合成夹具，绝不写入 src/data/products.json，也不作为演示产品。

Phase 3 可复用：需求 schema/类型、归一化及 VA derivation、规则入口、SelectionReport/RuleCheck 状态协议、证据引用、nextQuestions、结果卡和手动输入兜底。AI 解析应另存原文依据与不确定状态，未经确认的不确定值传 null，不升级为已知值。
