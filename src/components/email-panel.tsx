"use client";

import { useState } from "react";
import { Copy, Download, Mail } from "lucide-react";
import { type GoodReport, type EmailLanguage } from "@/lib/ai/mail";
import { renderCustomerMail } from "@/lib/ai/customer-mail";
import { cleanEmailRequirements, localEmailOutput, emailClipboardText, inquiryRecord } from "@/lib/ai/email-artifacts";
import type { generateEmail } from "@/lib/ai/service";
import { postJson, type InquiryReview } from "./inquiry-panel";

import type { CallMetrics } from "@/lib/ai/metering";
import { errorZh } from "@/lib/ui-zh";
import { CallMetricsNote } from "./call-metrics";
type EmailVersion = "customer" | "technical";
type Draft = { subject: string; body: string };
type EmailOutput = Awaited<ReturnType<typeof generateEmail>> & { telemetry?: CallMetrics; view?: EmailVersion; drafts?: Partial<Record<EmailVersion, Draft>> };
export function EmailPanel({ report, review, liveAvailable }: { report: GoodReport; review: InquiryReview | null; liveAvailable: boolean }) {
  const [language, setLanguage] = useState<EmailLanguage>(review?.response.extraction.language === "es" ? "es" : "en");
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [safeData, setSafeData] = useState(false);
  const [output, setOutput] = useState<EmailOutput | null>(null);
  const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  // No extra hooks: preserve existing paid results during a development hot refresh.
  const version: EmailVersion = output?.view ?? (output?.customerEmail ? "customer" : "technical");
  const customerEmail = output ? output.customerEmail ?? renderCustomerMail(output.selection, language) : null;
  const canonical = version === "customer" ? customerEmail : output;
  const edited = canonical !== null && (body !== canonical.body || subject !== canonical.subject);
  const apply = (next: EmailOutput) => { setOutput({ ...next, view: "customer" }); setSubject(next.customerEmail.subject); setBody(next.customerEmail.body); setNotice(""); };
  const switchVersion = (next: EmailVersion) => {
    if (!output || next === version || !customerEmail) return;
    const drafts = { ...output.drafts, [version]: { subject, body } };
    const draft = drafts[next] ?? (next === "customer" ? customerEmail : output);
    setOutput({ ...output, customerEmail, view: next, drafts }); setSubject(draft.subject); setBody(draft.body); setNotice("已切换版本，未调用 API。两版人工修改分别保留。");
  };
  // Strip normalized derived metadata before sending through the strict requirements boundary.
  const cleanRequirements = () => cleanEmailRequirements(report);
  const localFallback = () => {
    apply(localEmailOutput(report, language)); setError(""); setNotice("已明确使用本地模板兜底，未调用 AI API。");
  };
  const download = () => {
    const record = inquiryRecord({ review, report, generatedEmail: output ? { ...output, customerEmail } : null, editedEmail: output ? { subject, body, version, manuallyEdited: edited } : null });
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "sales-engineer-inquiry-record.json"; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="email-panel" aria-labelledby="email-title"><div className="ai-panel-heading"><div><div className="eyebrow"><Mail size={14} />确认需求 → 规则事实 → 客户回复</div><h2 id="email-title">销售邮件草稿</h2><p>可编辑、复制或下载；不会自动发送邮件。</p></div></div>
    <div className="email-controls"><label>邮件语言<select value={language} onChange={(e) => { setLanguage(e.target.value as EmailLanguage); setOutput(null); }} disabled={busy}><option value="en">英文</option><option value="es">西班牙文</option></select></label><label>邮件生成模式<select value={mode} onChange={(e) => { setMode(e.target.value as "mock" | "live"); setOutput(null); }} disabled={busy}><option value="mock">模拟模板（不计费）</option><option value="live" disabled={!liveAvailable}>真实 AI（事实锁定）</option></select></label><button className="primary-button" disabled={busy} onClick={() => {
      // Keep the strict Phase 2 input shape; derived VA metadata is not a customer field.
      if (mode === "live" && !safeData) { setError("请先确认需求为模拟／已匿名化信息，再生成真实 AI 邮件。"); return; }
      setBusy(true); setError(""); setOutput(null); setBody(""); setSubject("");
      void postJson<EmailOutput>("/api/email", { requirements: cleanRequirements(), confirmed: true, language, mode, ...(mode === "live" ? { dataPolicy: "synthetic_or_anonymized" } : {}) }).then(apply).catch((e) => setError(e instanceof Error ? errorZh(e.message) : "生成失败，请稍后重试或使用本地模板。")).finally(() => setBusy(false));
    }}>{busy ? "正在生成，请稍候…" : "生成销售回复"}</button></div>
    {mode === "live" && <label className="request-checkbox"><input type="checkbox" checked={safeData} onChange={(e) => setSafeData(e.target.checked)} />我确认需求仅含模拟或已人工匿名化的信息。本次真实 AI 邮件生成是单独计费的调用。</label>}
    <CallMetricsNote metrics={output?.telemetry} />
    <p className="ai-privacy">AI 仅能组织已审核的事实及开头／结尾措辞，不能新增、改写或遗漏技术结论、状态、追问与证据。</p>
    {error && <div className="ai-error" role="alert"><p>{error}</p><button onClick={localFallback}>改用本地安全模板</button></div>}
    {output && <><div className="email-version-switch" role="group" aria-label="邮件版本"><button type="button" aria-pressed={version === "customer"} disabled={busy} onClick={() => switchVersion("customer")}>客户简洁版</button><button type="button" aria-pressed={version === "technical"} disabled={busy} onClick={() => switchVersion("technical")}>详细技术版</button></div><p className="ai-privacy">{version === "customer" ? "适合初步客户跟进：从同一份已核验规则结果本地整理，不额外调用 AI。完整参数、逐项理由和来源保留在详细技术版及下载记录中。" : "完整技术审核记录：保留全部产品状态、参数、证据链接、待核验条件和追问。"}</p><div className="email-output-status"><span className="ai-mode-badge">{output.provider === "mock" ? "模拟／模板 · 非真实 AI 生成" : version === "customer" ? "真实 AI 结果 · 简洁版本地整理" : "真实 AI 辅助 · 技术事实锁定"}</span><span>{output.usage ? `${output.usage.inputTokens} 输入／ ${output.usage.outputTokens} 输出 Token` : output.provider === "mock" ? "未使用付费 API Token" : "未取得用量统计，成本未知"}</span></div><label className="inquiry-text"><span>邮件主题</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} /></label><label className="inquiry-text"><span>邮件正文</span><textarea rows={18} value={body} onChange={(e) => setBody(e.target.value)} maxLength={30000} /></label>{edited && <p className="ai-error">草稿已被人工修改：修改内容尚未重新进行事实校验，请核对后再复制。</p>}<div className="email-actions"><button className="secondary-button" onClick={() => { void navigator.clipboard.writeText(emailClipboardText({ subject, body })).then(() => setNotice("已复制；邮件尚未发送。")).catch(() => setNotice("无法访问剪贴板，请选中文本后手动复制。")); }}><Copy size={14} />复制邮件</button><button className="secondary-button" onClick={download}><Download size={14} />下载完整询盘记录</button></div></>}
    {notice && <p role="status" className="ai-notice">{notice}</p>}
  </section>;
}
