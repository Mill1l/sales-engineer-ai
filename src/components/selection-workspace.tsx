"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, CircleHelp, ClipboardList, ExternalLink, FlaskConical, RotateCcw, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import type { Product } from "@/lib/catalog-schema";
import { selectProducts, type RuleCheck, type SelectionReport, type SelectionResult } from "@/lib/selection/engine";
import { draftToInput, emptyDraft, type RequirementDraft } from "@/lib/selection/form";
import { selectionDemos } from "@/lib/selection/demos";
import { WorkspaceShell } from "./workspace-shell";
import { InquiryPanel, ExtractionReview, type InquiryReview } from "./inquiry-panel";
import { EmailPanel } from "./email-panel";
import { extractionToDraft } from "@/lib/ai/contracts";
import { WorkflowGuide, ShortlistBrief } from "./workflow-guide";

import { statusLabels, fieldZh, ruleTextZh, errorZh, valueZh, demoLabels, demoDetails } from "@/lib/ui-zh";

const fieldNames: Record<string, string> = {
  country: "国家", application: "应用场景", loadW: "负载 W", loadVA: "负载 VA", powerFactor: "功率因数", inputVoltageV: "输入电压", outputVoltageV: "输出电压", phases: "相数", topology: "UPS 拓扑", runtimeMinutes: "后备时间", mounting: "安装方式", "budget.amount": "预算金额", "budget.currency": "预算币种", marginPercent: "容量余量",
};
const groupLabels = { passed: "已满足条件", failed: "已确认的冲突", pending: "尚待核验", advisory: "余量策略建议", not_required: "客户明确不要求" };

function CheckGroups({ checks }: { checks: RuleCheck[] }) {
  return <div className="rule-groups">{(["failed", "pending", "passed", "advisory", "not_required"] as const).map((outcome) => {
    const group = checks.filter((check) => check.outcome === outcome);
    return <details key={outcome} className={`rule-group group-${outcome}`} open={outcome === "failed" && group.length > 0}>
      <summary><span>{outcome === "passed" ? <Check size={14} /> : outcome === "failed" ? <X size={14} /> : <CircleHelp size={14} />}{groupLabels[outcome]}<b>{group.length}</b></span><ChevronDown size={14} /></summary>
      {group.length === 0 ? <p className="no-rules">暂无{groupLabels[outcome]}。</p> : <ul>{group.map((check) => <li key={check.id}>
        <strong>{fieldZh(check.label)}{!check.required && <small> · {check.outcome === "pending" ? "非阻断提醒" : "可选／策略项"}</small>}</strong><p>{ruleTextZh(check.reason)}</p>
        {check.evidence.map((source, index) => <a key={`${fieldZh(source.field)}-${index}`} href={source.url} target="_blank" rel="noreferrer" title={source.locator}>{fieldZh(source.field)} · 核验于 {source.verifiedOn}<ExternalLink size={11} /></a>)}
      </li>)}</ul>}
    </details>;
  })}</div>;
}

function ResultCard({ result, index }: { result: SelectionResult; index: number }) {
  const failed = result.checks.filter((c) => c.required && c.outcome === "failed");
  const pending = result.checks.filter((c) => c.required && c.outcome === "pending");
  const p = result.product;
  return <article id={`candidate-${p.sku}`} className={`selection-result status-${result.status}`}>
    <div className="result-top"><div className="result-name"><span className="result-number">{String(index + 1).padStart(2, "0")}</span><div><p>{p.name}</p><h3>{p.sku}</h3></div></div><span className={`match-badge ${result.status}`}>{result.status === "excluded" ? <X size={13} /> : result.status === "confirmed_match" ? <Check size={13} /> : <CircleHelp size={13} />}{statusLabels[result.status]}</span></div>
    <div className="result-capacity"><span><b>{p.specifications.ratedW.value?.toLocaleString("en-US") ?? "?"}</b> W</span><span><b>{p.specifications.ratedVA.value?.toLocaleString("en-US") ?? "?"}</b> VA</span><span>{p.specifications.topology.value === "double_conversion_online" ? "在线双变换式" : p.specifications.topology.value === "line_interactive" ? "在线互动式" : "拓扑尚未核验"}</span></div>
    <p className="result-verdict">{result.status === "excluded" ? `${failed.length} 项已确认的硬性冲突。缺少其他证据不会覆盖已确认冲突。` : result.status === "pending_verification" ? `可继续评估：仍有 ${pending.length} 项必要条件尚未确认。` : "本次范围内所有必要条件均已通过；报价前仍需复核商业条件。"}</p>
    <CheckGroups checks={result.checks} />
    <details className="questions-panel"><summary><ClipboardList size={15} />建议下一轮追问 <span>{result.nextQuestions.length}</span><ChevronDown size={14} /></summary>{result.nextQuestions.length === 0 ? <p>本次评估范围内没有未解决的追问。</p> : (["customer", "manufacturer"] as const).filter((audience) => result.nextQuestions.some((q) => q.audience === audience)).map((audience) => <div key={audience}><h4>{audience === "customer" ? "向客户追问" : "向厂家／当地渠道核实"}</h4><ul>{result.nextQuestions.filter((q) => q.audience === audience).map((q) => <li key={ruleTextZh(q.text)}>{ruleTextZh(q.text)}</li>)}</ul></div>)}</details>
    <div className="result-source"><ShieldCheck size={13} /><a href={p.sourceUrl} target="_blank" rel="noreferrer">官方产品参数来源<ExternalLink size={11} /></a><span>{p.recordStatus === "partially_verified" ? "部分参数已核验" : p.recordStatus} · {p.verifiedOn}</span></div>
  </article>;
}

export function SelectionWorkspace({ products }: { products: Product[] }) {
  const [draft, setDraft] = useState<RequirementDraft>({ ...emptyDraft });
  const [report, setReport] = useState<SelectionReport | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [review, setReview] = useState<InquiryReview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [inquiryKey, setInquiryKey] = useState(0);
  useEffect(() => {
    if (report) document.getElementById(report.ok ? "results-title" : "request-errors")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);
  const issues = report && !report.ok ? report.issues : [];
  const update = <K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value })); setReport(null); setDemoId(null); setConfirmed(false);
  };
  const input = (key: keyof RequirementDraft, label: string, { required = false, hint = "", min = "0", max, type = "number", step = "any", placeholder = "未知" }: { required?: boolean; hint?: string; min?: string; max?: string; type?: string; step?: string; placeholder?: string } = {}) => <label className="request-field"><span>{label}{required && <b> *</b>}</span><input name={key} value={String(draft[key])} type={type} min={type === "number" ? min : undefined} max={max} step={type === "number" ? step : undefined} required={required} placeholder={placeholder} aria-invalid={issues.some((i) => i.field === key)} onChange={(e) => update(key, e.target.value)} />{hint && <small>{hint}</small>}</label>;
  const select = (key: keyof RequirementDraft, label: string, options: [string, string][], hint?: string) => <label className="request-field"><span>{label}</span><select name={key} value={String(draft[key])} onChange={(e) => update(key, e.target.value)}><option value="">未知／待确认</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select>{hint && <small>{hint}</small>}</label>;
  const summary = report?.ok ? report : null;
  const originalDraft = review ? extractionToDraft(review.response.extraction.requirements) : null;
  const editedFields = originalDraft ? Object.keys(originalDraft).filter((key) => draft[key as keyof RequirementDraft] !== originalDraft[key as keyof RequirementDraft]).map((key) => key.startsWith("budget") ? "budget" : key) : [];

  return <WorkspaceShell page="selection"><main className="selection-main">
    <div className="page-heading"><div><div className="eyebrow"><span />客户询盘 → 人工确认 → 规则选型 → 销售回复</div><h1>AI 售前选型工作台</h1><p>读懂客户需求，由人工确认，用证据支持选型。</p></div><Link className="secondary-button" href="/">查看产品资料与证据<ArrowRight size={15} /></Link></div>
    <div className="disclaimer"><ShieldCheck size={18} /><div><strong>独立学习演示项目，非 Schneider Electric 官方工具。</strong><span>三个型号均仅完成部分参数核验。容量合适不代表方案已确认，也不代表报价或库存承诺。</span></div></div>
    <WorkflowGuide review={review} report={summary} />
    <InquiryPanel key={inquiryKey} onLiveAvailable={setLiveAvailable} onInvalidate={() => { setDraft({ ...emptyDraft }); setReview(null); setConfirmed(false); setReport(null); setDemoId(null); }} onReview={(next) => { setReview(next); setDraft(extractionToDraft(next.response.extraction.requirements)); setConfirmed(false); setReport(null); setDemoId(null); }} />
    {review && <ExtractionReview extraction={review.response.extraction} editedFields={editedFields} />}
    <details className="manual-demo-details"><summary>手动填写演示案例（不调用 AI）</summary><section className="demo-strip" aria-label="手动选型案例"><div><FlaskConical size={18} /><h2>加载手动案例</h2><span>虚构客户需求 · 真实产品证据</span></div><div className="demo-buttons">{selectionDemos.map((demo) => <button key={demo.id} type="button" aria-pressed={demoId === demo.id} title={demoDetails[demo.id] ?? demo.detail} onClick={() => { setDraft({ ...demo.draft }); setDemoId(demo.id); setReport(null); setReview(null); setConfirmed(false); setInquiryKey((key) => key + 1); }}>{demoLabels[demo.id] ?? demo.title}</button>)}</div>{demoId && <p>{demoDetails[demoId]} 请核对表单后再运行选型。</p>}</section></details>
    <div className="selection-layout">
      <section className="request-panel" aria-labelledby="request-title"><div className="request-heading"><SlidersHorizontal size={18} /><div><h2 id="request-title">客户技术需求</h2><p>留空即未知；不会根据国家或应用场景猜测参数。</p></div></div>
        <form noValidate onSubmit={(event) => { event.preventDefault(); setReport(confirmed ? selectProducts(products, draftToInput(draft)) : { ok: false, issues: [{ field: "confirmation", message: "请先检查提取／手填的需求，并勾选人工确认后再运行选型。" }] }); }}>
          {issues.length > 0 && <div id="request-errors" className="request-errors" role="alert"><strong>请检查客户输入</strong><ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{fieldNames[issue.field] ?? issue.field}: {errorZh(issue.message)}</li>)}</ul></div>}
          <fieldset><legend>01 · 客户背景与负载</legend><div className="request-grid">
            {input("country", "国家代码", { required: true, type: "text", placeholder: "例如 CL（智利）", hint: "填写两字母国家代码；当前产品资料面向智利（CL）。" })}
            {input("application", "应用场景", { required: true, type: "text", placeholder: "例如：服务器机房" })}
            {input("destination", "交货目的地", { type: "text", placeholder: "未知" })}{input("quantity", "采购数量（台）", { min: "1", max: "10000", step: "1" })}
            {input("loadW", "有功负载（W）", { required: true, hint: "填写实际运行负载，不是 UPS 的额定容量。" })}
            {input("loadVA", "视在负载（VA）", { hint: "VA 与 W 分别检查；仅在明确功率因数时可推导。" })}
            {input("powerFactor", "负载功率因数 PF", { min: "0", max: "1", hint: "0 < PF ≤ 1；缺 VA 时仅在 PF 明确后按 W / PF 计算。" })}
          </div>{Number(draft.quantity) > 1 && <label className="request-checkbox"><input type="checkbox" checked={draft.loadPerUnitConfirmed} onChange={(e) => update("loadPerUnitConfirmed", e.target.checked)} />客户已确认：上述 W／VA 是每台 UPS 的负载。未确认则负载分配保持待核验，不会自动除以采购数量。</label>}</fieldset>
          <fieldset><legend>02 · 电气参数与安装</legend><div className="request-grid">
            {input("inputVoltageV", "输入电压（V）")}{input("outputVoltageV", "输出电压（V）")}
            {input("frequencyHz", "要求频率（Hz）")}
            {select("phases", "输入／输出相数", [["1", "单相输入／单相输出"], ["3", "三相输入／三相输出"]], "输入与输出相数不同的系统，需要单独人工审查。")}
            {select("topology", "UPS 拓扑要求", [["any", "两种拓扑均可"], ["line_interactive", "在线互动式"], ["double_conversion_online", "在线双变换式"]])}
            {input("runtimeMinutes", "最低后备时间（分钟）", { hint: "填 0 表示客户明确不设最低续航要求。" })}
            {select("mounting", "安装方式", [["tower", "塔式"], ["rack", "机架式"]])}
            {draft.mounting === "rack" && select("rackKitAccepted", "是否接受单独购买机架套件？", [["yes", "接受，但需核验适配"], ["no", "不接受另购套件"]])}
            {select("redundancy", "冗余要求", [["not_required", "单台 UPS 即可"], ["n_plus_one", "要求 N+1 冗余"], ["dual_path", "要求双路供电"]])}
          </div></fieldset>
          <label className="request-field extra-constraints"><span>其他硬性要求／尚待确认的偏好</span><textarea rows={3} value={draft.otherConstraints} onChange={(e) => update("otherConstraints", e.target.value)} placeholder="每行填写一项，未单独核实前保持待核验。" /></label>
          <fieldset><legend>03 · 商业条件</legend><div className="request-grid">
            {select("budgetMode", "预算", [["unconstrained", "客户明确无预算上限"], ["limit", "已明确预算上限"]], "预算留空表示待确认，不代表已满足预算。")}
            {draft.budgetMode === "limit" && <>{input("budgetAmount", "最高金额")}{select("budgetCurrency", "预算币种", [["CLP", "CLP"], ["USD", "USD"], ["EUR", "EUR"], ["CNY", "CNY"]], "不会自动假定汇率。")}</>}
          </div><label className="request-checkbox"><input type="checkbox" checked={draft.requireInStock} onChange={(e) => update("requireInStock", e.target.checked)} />必须有当地现货（硬性条件）</label><p className="field-note">始终检查当地在售状态；即使不要求立即供货，也会明确提示库存未知。</p></fieldset>
          <fieldset><legend>04 · 容量余量策略</legend><div className="request-grid">
            {input("marginPercent", "额外容量余量（%）", { max: "100", hint: "目标容量 = 负载 ×（1 + 余量 / 100）。" })}
            <label className="request-field"><span>余量的适用方式</span><select name="marginMode" value={draft.marginMode} onChange={(e) => update("marginMode", e.target.value)}><option value="advisory">建议偏好</option><option value="hard">硬性要求</option></select><small>这是可配置策略，不是所有场景通用的行业硬标准。</small></label>
          </div></fieldset>
          <details className="runtime-context"><summary>厂家续航数据的适用条件<ChevronDown size={14} /></summary><p>只有实际负载及适用条件下的厂家数据才能核验续航；填写这些字段不会补造证据。</p>{input("batteryConfiguration", "已确认的电池配置", { type: "text" })}{input("runtimeConditions", "适用的厂家测试条件", { type: "text" })}</details>
          <label id="human-confirmation" className="request-checkbox confirmation-box"><input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setReport(null); }} />我已核对需求及原文依据。未知项仍保留未知；人工修改的值来自已确认的客户信息。</label>
          <div className="request-actions"><button className="primary-button" type="submit">确认并运行选型<ArrowRight size={16} /></button><button className="reset-request" type="button" onClick={() => { setDraft({ ...emptyDraft }); setReport(null); setDemoId(null); setReview(null); setConfirmed(false); setInquiryKey((key) => key + 1); }}><RotateCcw size={14} />重置</button></div>
          <p className="privacy-note">由本地确定性规则进行选型，AI 无权决定匹配状态。</p>
        </form>
      </section>
      <section className="selection-results" aria-labelledby="results-title" aria-live="polite"><div className="results-heading"><div><div className="eyebrow">可解释的产品初筛</div><h2 id="results-title">候选产品评估</h2></div><span>{summary ? summary.results.length : products.length} 个范围内型号</span></div>
        {!summary ? <div className="selection-placeholder"><ClipboardList size={35} /><h3>每一项判断都有依据。</h3><p>填写客户需求或加载演示询盘，人工确认后运行选型。</p><div><span className="match-badge confirmed_match">已匹配</span><span className="match-badge pending_verification">待核验</span><span className="match-badge excluded">不匹配</span></div><p>已确认的硬性冲突会排除产品；必要证据缺失则保持待核验。</p></div> : <>
          <div className="evaluation-summary"><div className="evaluation-counts">{(["confirmed_match", "pending_verification", "excluded"] as const).map((status) => <div key={status}><strong>{summary.results.filter((result) => result.status === status).length}</strong><span>{statusLabels[status]}</span></div>)}</div>
            <p><strong>{summary.requirements.country} · {summary.requirements.application}</strong></p><p>{summary.requirements.loadW} W · {summary.requirements.effectiveVA === null ? "VA 未知" : `${Number(summary.requirements.effectiveVA.toFixed(3))} VA (${valueZh("vaOrigin", summary.requirements.vaOrigin)})`} · {summary.requirements.marginPercent}% {summary.requirements.marginMode === "hard" ? "硬性余量" : "建议余量"}</p>
            {summary.requirements.derivation && <p className="derived-value"><Check size={13} />{summary.requirements.derivation}</p>}
          </div>
          <ShortlistBrief report={summary} /><p className="sort-explanation">依次按状态、未解决的必要条件数量、余量偏好、额定容量和型号排序。排序表示继续评估的优先级，不代表采购推荐。</p>
          {summary.results.every((result) => result.status === "excluded") && <div className="all-excluded" role="status">没有型号满足已知硬性条件。请先核对冲突，再考虑扩大产品范围；系统未自动放宽要求。</div>}
          {summary.results.map((result, index) => <ResultCard key={result.product.sku} result={result} index={index} />)}
          <p className="field-note">应用场景用于后续沟通；本工具不认证现场安全、启动冲击、接口、环境适用性或完整安装设计。价格与库存需向当地渠道实时确认。</p>
          <EmailPanel key={JSON.stringify(summary.requirements)} report={summary} review={review} liveAvailable={liveAvailable} />
        </>}
      </section>
    </div><footer><Link href="/">Sales Engineer AI · 产品资料库</Link><span>独立学习演示项目，非 Schneider Electric 官方工具</span><span>中文界面 · 业务核验演示</span></footer>
  </main></WorkspaceShell>;
}
