/** Presentation only: never translate customer source text, stored product evidence or rule IDs. */
export const statusLabels = { confirmed_match: "已匹配", pending_verification: "待核验", excluded: "不匹配" };
export const fieldLabels: Record<string, string> = {
 country:"国家",application:"应用场景",loadW:"有功负载（W）",loadVA:"视在负载（VA）",powerFactor:"功率因数",inputVoltageV:"输入电压",outputVoltageV:"输出电压",phases:"相数",frequencyHz:"频率",topology:"UPS 拓扑",runtimeMinutes:"后备时间（分钟）",mounting:"安装方式",rackKitAccepted:"是否接受另购机架套件",budget:"预算",redundancy:"冗余要求",requireInStock:"是否必须有现货",batteryConfiguration:"电池配置",runtimeConditions:"续航测试条件",quantity:"采购数量",destination:"交货地点",otherConstraints:"其他要求",
 capacity_w:"有功功率（W）",capacity_va:"视在功率（VA）",margin:"容量余量",input_voltage:"输入电压",output_voltage:"输出电压",inputPhases:"输入相数",outputPhases:"输出相数",runtime:"电池后备时间",market:"当地在售状态",stock:"库存",frequency:"频率",ratedW:"额定有功功率",ratedVA:"额定视在功率",nominalVoltageV:"型号标称电压",inputVoltageRangeV:"输入电压范围",outputVoltagesV:"可配置输出电压",rackKitIncluded:"机架套件是否包含",outputConnectors:"输出接口",runtimeCurve:"厂家续航曲线",lifecycleChile:"智利在售状态",price:"价格",
 "Active power (W)":"有功功率（W）","Apparent power (VA)":"视在功率（VA）","Capacity margin":"容量余量","Topology":"UPS 拓扑","Input voltage":"输入电压","Output voltage":"输出电压","Input phases":"输入相数","Output phases":"输出相数","Installation":"安装方式","Battery runtime":"电池后备时间","Redundancy":"冗余要求","Market availability":"当地在售状态","Budget":"预算","Stock":"库存","Frequency":"频率","Additional requirement":"其他要求",
};
export const fieldZh = (field: string) => fieldLabels[field] ?? field;
const enums: Record<string,string> = { double_conversion_online:"在线双变换式",line_interactive:"在线互动式",any:"两种拓扑均可",tower:"塔式",rack:"机架式",rack_with_optional_kit:"机架式（需选配套件）",not_required:"不要求",n_plus_one:"N+1 冗余",dual_path:"双路供电",unconstrained:"无预算上限",limit:"预算上限",provided:"客户提供",derived:"按 W / PF 推导",unknown:"未知" };
export function valueZh(field:string,value:unknown):string {
 if(value===null) return "需要确认";
 if(typeof value==="boolean") return value?"是":"否";
 if(field==="budget" && typeof value==="object") { const b=value as {kind:string;amount?:number;currency?:string};return b.kind==="unconstrained"?"客户明确无预算上限":`${b.amount} ${b.currency}`; }
 if(Array.isArray(value)) return value.length?value.join("；"):"未提供";
 if(["topology","mounting","redundancy","vaOrigin"].includes(field) && typeof value==="string") return enums[value]??value;
 return String(value);
}
export const apiErrorsZh: Record<string,string> = {
 configuration_error:"服务端 AI 配置无效。请检查服务商、模型、Token／超时和调用限额设置并重启；未向服务商发送请求。可用模拟模式继续，未使用的真实 AI 配置不影响模拟请求。",
 timeout:"AI 请求超时，未应用结果。请稍后重试，或改用模拟／手动模式。",provider_unavailable:"AI 服务暂时不可用（也可能是密钥、余额或模型权限问题）。未自动重试，请检查服务商控制台。",invalid_output:"AI 输出未通过结构、原文证据或事实一致性校验，请人工检查或使用模拟模式。",empty_output:"AI 返回了空内容，未应用结果。可使用模拟／手动模式。",invalid_json:"AI 返回的内容不是有效 JSON，未应用任何结果。",schema_mismatch:"AI 返回的数据结构不符合要求，已拒绝使用。",data_policy_required:"请先确认数据为模拟或已人工匿名化，并删除联系方式、密钥和机密内容。",live_not_configured:"真实 AI 尚未启用。请检查服务端密钥及付费开关，并重启服务。",invalid_request:"输入无效，请检查必填项、数值、确认状态和文本长度。",rate_limited:"已达到本地调用限额，请稍后再试；手动选型仍可使用。",mock_scenario_only:"模拟提取仅支持六个预置询盘原文。自定义文本请使用真实 AI 或手动表单。",
};
export function errorZh(message:string) {
 const exact:Record<string,string>={"Failed to fetch":"无法连接服务，请检查启动网页的终端是否仍在运行。","fetch failed":"无法连接服务，请检查本地服务与网络。","Enter a valid number.":"请输入有效数字。","Enter a value greater than zero.":"请输入大于 0 的数值。","Enter a two-letter country code (for example CL).":"请输入两字母国家代码，例如智利 CL。","Describe the application.":"请填写应用场景。","VA cannot be lower than W for the same load.":"同一负载的 VA 不能小于 W，请核对。","W, VA and power factor disagree by more than 2%; confirm the measurements.":"W、VA 和功率因数的计算结果偏差超过 2%，请确认实测数据。","Instruction-like content detected. It cannot override the rule engine; review all fields.":"原文含类似指令的内容，不能覆盖规则判断；请逐项检查需求。"};
 if(exact[message])return exact[message];
 const missing=message.match(/^([a-zA-Z]+): missing, uncertain or unsupported source evidence; confirm manually\.$/);
 if(missing)return `${fieldZh(missing[1])}：原文依据缺失、不确定或不支持该值，请人工确认。`;
 if(/^(Too (small|big)|Invalid input|Invalid option|Invalid string|Invalid type|Unrecognized key)/.test(message))return "输入格式、范围或必填项不符合要求，请核对对应字段。";
 return message;
}
const text:Record<string,string>={
"Multiple units requested; per-UPS load is not confirmed. No automatic load allocation.":"客户需要多台 UPS，但尚未确认每台负载；不会自动分摊。",
"Per-UPS load allocation is unconfirmed; VA is not allocated automatically.":"每台 UPS 的负载分配尚未确认，不会自动分配 VA。",
"VA is unknown; W alone cannot establish apparent-power capacity.":"VA 未知，仅凭 W 无法判断视在功率是否满足。",
"Verified rated W is missing.":"缺少已核验的额定 W 参数。","Verified rated VA is missing.":"缺少已核验的额定 VA 参数。",
"Customer topology requirement is unknown.":"客户尚未确认 UPS 拓扑要求。","Product topology is not verified.":"产品拓扑尚未核验。","Customer explicitly allows either topology.":"客户已明确接受两种拓扑。",
"Customer input voltage is unknown; country is not used to infer it.":"客户输入电压未知，不会根据国家推断。","Customer output voltage is unknown.":"客户输出电压未知。","Customer phase requirement is unknown.":"客户相数要求未知。",
"Customer installation requirement is unknown.":"客户安装方式要求未知。","Product installation modes are not verified.":"产品安装方式尚未核验。","Rack compatibility is not established by the documented tower mode.":"资料记录塔式安装，不能据此确认机架适配。","Rack requested but customer does not accept the required separate conversion kit.":"客户要求机架安装，但不接受所需的另购转换套件。",
"Per-UPS load must be confirmed before checking manufacturer runtime data.":"必须先确认每台 UPS 的实际负载，才能核验厂家续航数据。","Minimum runtime is unknown.":"客户尚未确认最低后备时间。","Manufacturer data exists, but its battery configuration/test conditions have not been confirmed applicable.":"虽有厂家数据，但尚未确认其电池配置与测试条件适用于本项目。","No manufacturer runtime point at this load. This engine does not interpolate or extrapolate.":"没有该负载下的厂家续航数据点，本引擎不会插值或外推。",
"Customer explicitly specified no minimum runtime target; no runtime claim is made.":"客户明确不设最低续航目标；不据此作出任何续航性能承诺。","Redundancy requirement is unknown.":"冗余要求未知。","Customer explicitly has no redundancy requirement.":"客户明确不要求冗余。",
"Chile sales lifecycle is unknown. An official page is not proof of current sale.":"智利当前在售状态未知。官方页面存在不代表仍在销售。","Budget is unspecified, so affordability is not confirmed.":"客户未提供预算，不能认定已满足预算。","Customer explicitly stated no budget ceiling. Price remains unverified; no affordability claim is made.":"客户明确无预算上限，但价格仍未核验，也不作报价承诺。","A rack solution needs an inclusive accessory quote; a base-UPS price alone would not establish budget fit.":"机架方案需要包含配件的完整报价，不能只用 UPS 主机价格判断预算。",
"0% additional capacity selected; rated W and VA checks still apply.":"已选择 0% 额外余量，仍须分别检查额定 W 与 VA。",
"Is the stated W/VA load per UPS or the total project load? Confirm the per-UPS load before sizing.":"所述 W／VA 是每台 UPS 的负载，还是整个项目总负载？请在选型前确认。","What is the total load in VA, or the measured load power factor?":"总负载的 VA 或实测功率因数是多少？","Confirm load VA/PF and the official W/VA ratings before checking the margin.":"请先确认负载 VA／功率因数及官方额定 W／VA，再检查容量余量。",
"Is online double conversion required, or is either topology acceptable?":"是否必须采用在线双变换式 UPS，还是两种拓扑均可？","What voltage is available at the UPS supply point?":"UPS 供电点可提供多少伏输入电压？","What output voltage does the protected equipment require?":"被保护设备需要多少伏输出电压？","Confirm the input and output phase configuration; this form uses the same phase count for both.":"请确认输入与输出相数；本表单采用相同输入／输出相数。","Please provide the official input operating range and relevant load/derating conditions.":"请提供官方输入工作电压范围及负载／降额适用条件。","Please provide this SKU's official configurable output voltages.":"请提供该具体型号的官方可配置输出电压资料。","Please verify input/output frequency and compatibility for this exact SKU.":"请核验该具体型号的输入／输出频率及兼容性。",
"Will the UPS be installed as a tower or in a rack?":"UPS 采用塔式还是机架式安装？","Please verify the installation modes and accessories for this SKU.":"请核验该型号的安装方式及所需配件。","Please confirm rack compatibility for this exact SKU; do not substitute a rack variant.":"请确认当前具体型号的机架适配，不可替换成其他机架型号的资料。","Please verify the rail kit, cabinet dimensions and complete accessory quotation.":"请核验导轨套件、机柜尺寸和完整配件报价。","Can the solution include the separately purchased rack conversion kit, subject to fit verification?":"是否接受另购机架转换套件，并进一步核验安装适配？","Confirm the actual load on each UPS and the required battery configuration.":"请确认每台 UPS 的实际负载及所需电池配置。","How many minutes of backup are required at the stated load?":"在所述实际负载下，需要后备供电多少分钟？","Confirm the exact battery configuration and applicability of the manufacturer's runtime test conditions.":"请确认具体电池配置，并核实厂家续航测试条件是否适用。",
"Is N+1 or dual-path redundancy required, or is a single UPS acceptable?":"需要 N+1／双路冗余，还是单台 UPS 即可？","Please validate the proposed redundancy architecture and all required components.":"请核验冗余系统架构及所需全部组件。","Please confirm whether this exact SKU is currently offered for sale in Chile.":"请向厂家／授权渠道确认该具体型号目前是否在智利销售。","Is there a budget ceiling and currency, or explicitly no budget constraint?":"是否有预算上限及币种，或客户是否明确无预算上限？","Please obtain a complete UPS and rack-kit quotation in the customer's budget currency.":"请按客户预算币种获取包含 UPS 和机架套件的完整报价。","Please confirm a current complete-scope quotation including agreed taxes, delivery and accessories.":"请确认最新完整报价，包括约定的税费、运输及配件。","Please confirm stock and delivery lead time with an authorized local channel.":"请向当地授权渠道确认库存与交期。","How many UPS units must be available immediately?":"需要立即供应多少台 UPS？",
};
export function ruleTextZh(value:string):string {
 if(text[value])return text[value];
 let m=value.match(/^([\d.,]+) W load vs ([\d.,]+) W rated\.$/);if(m)return `实际负载 ${m[1]} W；已核验额定功率 ${m[2]} W。`;
 m=value.match(/^([\d.,]+) VA (derived from W \/ PF|provided) vs ([\d.,]+) VA rated\.$/);if(m)return `负载 ${m[1]} VA（${m[2]==="provided"?"客户提供":"按 W / PF 推导"}）；已核验额定容量 ${m[3]} VA。`;
 m=value.match(/^Required (.+); documented (.+)\.$/);if(m)return `客户要求：${enums[m[1]]??m[1]}；官方记录：${enums[m[2]]??m[2]}。`;
 m=value.match(/^Customer requires (.+) V\. The model's nominal voltage does not establish its input operating range\.$/);if(m)return `客户要求 ${m[1]} V。型号标称电压不能代替完整输入电压范围。`;
 m=value.match(/^(.+) V requested; no verified configurable output voltage list\.$/);if(m)return `客户要求 ${m[1]} V，但缺少已核验的可配置输出电压清单。`;
 m=value.match(/^(.+)-phase requested; (input|output) phases not verified\.$/);if(m)return `客户要求 ${m[1]} 相；产品${m[2]==="input"?"输入":"输出"}相数尚未核验。`;
 m=value.match(/^(.+) minutes requested at (.+) W; official runtime data is missing\. No runtime inferred from rating or battery capacity\.$/);if(m)return `要求在 ${m[2]} W 下后备 ${m[1]} 分钟；缺少厂家数据，不会从额定功率或电池容量推算。`;
 m=value.match(/^(.+)% policy cannot be fully checked without both W and VA ratings and load values\.$/);if(m)return `${m[1]}% 余量策略需要明确负载及额定 W、VA，目前无法完整核验。`;
 m=value.match(/^(.+) Hz requested; manufacturer frequency specification is unverified\.$/);if(m)return `客户要求 ${m[1]} Hz；厂家频率参数尚未核验。`;
 if(value.startsWith("Unresolved customer requirement: "))return "尚未核实的客户要求："+value.slice("Unresolved customer requirement: ".length);
 if(value.startsWith("Please clarify and verify the additional requirement: "))return "请澄清并核验附加要求："+value.slice("Please clarify and verify the additional requirement: ".length);
 if(value.startsWith("Stock is unknown."))return "库存未知；"+(value.includes("Immediate stock is required")?"客户要求现货，必须进一步核验。":"客户未将现货设为硬性要求，但仍需单独确认供货情况。");
 if(value.startsWith("Ceiling "))return "客户已给出预算上限，但没有可比较的已核验价格；不得推断汇率或报价。原始预算说明："+value;
 if(value.startsWith("Tower requested;"))return "客户要求塔式安装；官方安装记录："+value.slice(value.indexOf(": ")+2).replace(/tower/g,"塔式").replace(/rack_with_optional_kit/g,"机架式（需另购套件）");
 if(value.startsWith("Rack conversion is documented."))return "资料支持机架转换，但仍需确认套件接受情况、具体套件／机柜适配和完整报价。";
 if(value.startsWith("Requested ")&&value.includes("redundancy"))return "客户提出冗余需求，必须进行系统架构审查；不能推断单机具备相应能力。";
 m=value.match(/^Please provide manufacturer runtime data at (.+) W, with battery configuration and test conditions\.$/);if(m)return `请获取 ${m[1]} W 负载下的厂家续航数据，并注明电池配置和测试条件。`;
 m=value.match(/^Please obtain a manufacturer runtime point at (.+) W\.$/);if(m)return `请获取 ${m[1]} W 负载下的厂家续航数据点。`;
 if(value.startsWith("Please provide the official "))return "请提供该具体型号的官方参数证据。原始核验要求："+value;
 return value;
}
export const demoLabels:Record<string,string>={
"chile-distributor":"智利经销商询盘（Chile Distributor Inquiry）","english-kw":"英文 · kW 与功率因数","chinese-va":"中文 · VA 独立超限","spanish-overload":"西语 · 3 kW 过载","rack-frequency":"英文 · 机架与频率","missing-va":"缺少 VA／功率因数","server-room":"800 W 服务器机房","online":"必须在线式 UPS","va-limit":"W 满足但 VA 超限","overload":"3000 W 过载","hard-margin":"将 20% 余量设为硬性要求",
};
export const demoDetails:Record<string,string>={"server-room":"三个型号都需要继续核验电气、续航和智利在售资料。","online":"1600 W、PF 0.8 → 2000 VA。SMT 被排除，两个 SRT 待核验。","va-limit":"900 W／1800 VA。SMT 因 VA 超限被排除，两个 SRT 待核验。","missing-va":"只提供 800 W，不猜测 VA，需向客户追问。","overload":"三个型号均因额定有功功率不足被排除。","hard-margin":"900 W／1000 VA → 目标容量 1080 W／1200 VA，SMT 被排除。"};
