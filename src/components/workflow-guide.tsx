import type { InquiryReview } from "./inquiry-panel";
import type { GoodReport } from "@/lib/ai/mail";
import { statusLabels, fieldZh } from "@/lib/ui-zh";

export function WorkflowGuide({ review, report }: { review: InquiryReview | null; report: GoodReport | null }) {
  const values = review?.response.extraction.requirements;
  return <>
    <section className="project-intro" aria-label="项目介绍">
      <div><div className="eyebrow">面向海外 B2B 技术销售</div><h2>从不完整的询盘，走向有依据的下一步。</h2><p>客户询盘通常缺少关键电气参数。本工具分别记录客户需求、官方产品证据和商业供货条件，避免混淆。</p></div>
      <dl><div><dt>AI 辅助</dt><dd>提取带原文依据的需求，组织已审核的邮件事实。</dd></div><div><dt>人工确认</dt><dd>检查歧义和未知项，确认需求后再进行选型。</dd></div><div><dt>规则判断</dt><dd>分别检查 W、VA 和硬性条件；缺少证据时保持待核验。</dd></div></dl>
    </section>
    <nav className="workflow-steps" aria-label="操作步骤">
      <a href="#inquiry-title">01 · 客户原文</a><a href={review ? "#extraction-evidence" : "#request-title"}>02 · 证据与确认</a>
      <a href="#results-title">03 · 选型及理由</a>{report ? <a href="#email-title">04 · 销售回复</a> : <span>04 · 选型后生成回复</span>}
    </nav>
    {values && <section className="demo-brief" aria-label="需求提取摘要">
      <div className="brief-heading"><h2>{review.inquiry.includes("Hola, somos una empresa distribuidora") ? "智利经销商询盘（Chile Distributor Inquiry）" : "需求复核"}</h2><span className="ai-mode-badge">{review.response.provider === "mock" ? "模拟模式 · 不调用付费 API" : "真实 AI 提取 · 需要人工复核"}</span></div>
      <p>原始提取快照：请核对下方原文片段。人工修改以需求表单中的当前值为准。</p>
      <div className="brief-facts"><span>{values.country ?? "国家未知"}</span><span>{values.loadW === null ? "负载 W 未知" : `${values.loadW} W 需求负载`}</span><span>{values.topology === "double_conversion_online" ? "要求在线式 UPS" : values.topology === "line_interactive" ? "要求在线互动式 UPS" : values.topology === "any" ? "两种拓扑均可接受" : "拓扑未知"}</span><span>{values.runtimeMinutes === null ? "续航要求未知" : `${values.runtimeMinutes} 分钟续航要求 · 尚未核实`}</span><span>{values.quantity ?? "未知"} 台采购需求</span></div>
      <div className="verification-priorities"><div><strong>向客户追问</strong><p>请补充缺失的 VA／功率因数、电压、相数、频率、安装方式、预算和负载分配。采购多台不代表已确认每台负载。</p></div><div><strong>向厂家／渠道核验</strong><p>核验适用的厂家续航曲线、电气兼容性、机架配件，以及智利在售、报价、库存与交期。客户要求的续航不是已验证的产品性能。</p></div></div>
      <a className="secondary-button" href="#human-confirmation">复核表单并确认未知项 →</a>
    </section>}
  </>;
}

export function ShortlistBrief({ report }: { report: GoodReport }) {
  const pending = report.results.filter((r) => r.status !== "excluded").flatMap((r) => r.checks.filter((c) => c.required && c.outcome === "pending"));
  const labels = [...new Set(pending.map((c) => fieldZh(c.label)))];
  return <section className="shortlist-brief" aria-label="Decision summary">
    <h3>选型结论一览</h3>
    <ul>{report.results.map((r) => <li key={r.product.sku}><a href={`#candidate-${r.product.sku}`}>{r.product.sku}</a><span className={`match-badge ${r.status}`}>{statusLabels[r.status]}</span></li>)}</ul>
    {labels.length > 0 && <p><strong>必要待核验项：</strong> {labels.join(" · ")}</p>}
    <a className="secondary-button" href="#email-title">前往生成销售回复 →</a><small>下方保留详细判断理由与官方证据。</small>
  </section>;
}
