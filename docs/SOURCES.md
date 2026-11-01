# 来源核验记录

核验日期：2026-10-31（Asia/Shanghai）。本地 JSON 的来源记录和字段 locator 是供后续复查的索引，不是完整网页快照。官网页面可查不证明智利在售或有现货。

## 访问方式与结果
首次访问不含 slug 的三个短地址均失败。随后访问下面的完整官方产品地址成功，读取到标题、SKU 和产品特征正文。全文技术规格动态表格未在研究工具返回文本中提供，因此未补写相数、电压范围、输出可选电压等参数。搜索索引仅用于发现链接，最终已核验字段来自实际打开的官方页面文本。

| SKU | 官方智利页面 | 核实的技术事实 | 证据定位 |
| --- | --- | --- | --- |
| SMT1500I | [Chile 产品页](https://www.se.com/cl/es/product/SMT1500I/smartups-de-apc-l%C3%ADnea-interactiva-1500-va-torre-230-v-8-salidas-iec-c13-smartslot-avr-lcd/) | 1000 W / 1500 VA；line interactive；标题标称 230 V；tower；8 × IEC C13 | 标题、SKU 下的产品特征；研究返回正文约第 20–29 行 |
| SRT2200XLI | [Chile 产品页](https://www.se.com/cl/es/product/SRT2200XLI/unidad-smartups-srt-de-apc-de-2200-va-y-230-v/) | 1980 W / 2200 VA；double-conversion online；标称 230 V；tower，可用另购轨道套件转 rack | 标题、未链接的当前选择值、产品特征，约第 28–52 行 |
| SRT3000XLI | [Chile 产品页](https://www.se.com/cl/es/product/SRT3000XLI/unidad-smartups-srt-de-apc-3000-va-y-230v/) | 2700 W / 3000 VA；double-conversion online；标称 230 V；tower，可用另购轨道套件转 rack | 标题、未链接的当前选择值、产品特征，约第 31–55 行 |

SRT 页面明确轨道套件 SRTRK4 或 SRTRK3 单独出售；需要针对实际机柜和安装要求再次确认配件适配。页面中的替换电池“可用”提示不是整机库存证据。

## 排除的错误读取方式
- SRT 页面显示 120/208/220/230/240 V 和多个 W 的系列切换链接，不能都作为当前 SKU 支持值。仅记录标题/当前选中值，并不据此推定完整电气兼容性。
- 搜索出现经销商价格、库存和续航信息，均未用作本库官方证据。
- 搜索出现其他地区的生命周期信息，没有移植为智利销售状态。
- 已发现官方安装手册和数据表链接，但未逐项完成适用性核验，未作为已验证字段来源。

## 人工核验队列
1. 官方 SKU 数据表：输入/输出相数、输入范围、配置输出电压、频率、SRT 插头/插座；核对版本和区域。
2. 官方续航曲线：负载 W、电池包型号/数量、测试条件；获取可靠数据点后另设验证策略，不做容量换算。
3. 客户现场：实际供电、插头/线路、负载 W/VA/PF、冲击电流、环境、机柜、冗余定义。
4. 厂家/授权渠道：智利生命周期、报价、实时库存与交期，单独保存商业证据及有效期。

## 状态语义
- verified_official：单个字段有已读取的官方文本证据。
- pending_manual_verification：null 值；未能建立明确官方证据。
- partially_verified：整条产品记录仍有未核验项目。此状态不是引擎的 confirmed_match。

修改资料后必须重新运行 schema 与完整性测试，并更新核验日期、字段 locator 和未解决事项。
