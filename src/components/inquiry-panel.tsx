"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileSearch, Globe2, ShieldCheck } from "lucide-react";
import { inquiryDemos } from "@/lib/ai/demos";
import { MAX_INQUIRY_CHARS, type ReviewedExtraction } from "@/lib/ai/contracts";
import type { parseInquiry } from "@/lib/ai/service";

import type { CallMetrics } from "@/lib/ai/metering";
import { apiErrorsZh, fieldZh, valueZh, errorZh, demoLabels } from "@/lib/ui-zh";
import { CallMetricsNote } from "./call-metrics";
export type ParseResponse = Awaited<ReturnType<typeof parseInquiry>> & { telemetry?: CallMetrics };
export type InquiryReview = { inquiry: string; response: ParseResponse };
export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: signal ?? AbortSignal.timeout(30000) });
  const output = await response.json();
  if (!response.ok) throw new Error(apiErrorsZh[output.error] || "请求失败，请使用模拟模式或手动填写。");
  return output as T;
}
export function InquiryPanel({ onReview, onInvalidate, onLiveAvailable }: { onReview: (review: InquiryReview) => void; onInvalidate: () => void; onLiveAvailable: (available: boolean) => void }) {
  const [inquiry, setInquiry] = useState("");
  const [safeData, setSafeData] = useState(false);
  const [metrics, setMetrics] = useState<CallMetrics>();
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [config, setConfig] = useState<{ liveAvailable: boolean; model: string; configurationError?: string }>({ liveAvailable: false, model: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const callback = useRef(onLiveAvailable);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/parse", { signal: controller.signal }).then((r) => r.json()).then((data) => { setConfig(data); callback.current(Boolean(data.liveAvailable)); }).catch(() => {});
    return () => { controller.abort(); active.current?.abort(); };
  }, []);
  const change = (text: string) => {
    revision.current++; active.current?.abort(); setBusy(false); setInquiry(text); setSafeData(false); setMetrics(undefined); setError(""); setNotice(""); onInvalidate();
  };
  const extract = async (text = inquiry, chosenMode = mode) => {
    if (text.trim().length < 10 || text.length > MAX_INQUIRY_CHARS) { setError(`请输入 10 至 ${MAX_INQUIRY_CHARS} 个字符。`); return; }
    if (chosenMode === "live" && !safeData) { setError("请先勾选模拟／已匿名化数据确认，再发起真实 AI 调用。"); return; }
    const current = ++revision.current;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setBusy(true); setError(""); setNotice(""); onInvalidate();
    try {
      const response = await postJson<ParseResponse>("/api/parse", { inquiry: text, mode: chosenMode, ...(chosenMode === "live" ? { dataPolicy: "synthetic_or_anonymized" } : {}) }, controller.signal);
      if (revision.current !== current) return;
      setMetrics(response.telemetry);
      onReview({ inquiry: text, response });
      setNotice(`${response.provider === "mock" ? "模拟提取结果 · 未调用 AI API" : "真实 AI 提取结果"} · ${response.extraction.language.toUpperCase()} · 请人工确认后再选型${response.usage ? ` · ${response.usage.inputTokens} 输入／ ${response.usage.outputTokens} 输出 Token` : response.provider !== "mock" ? " · 未取得用量统计，成本未知" : ""}`);
    } catch (e) { if (revision.current === current) setError(e instanceof Error && e.name !== "AbortError" ? errorZh(e.message) : "请求已停止或超时，未应用任何结果。可选择模拟案例或手动填写。"); }
    finally { clearTimeout(timeout); if (revision.current === current) setBusy(false); }
  };
  return <section className="inquiry-panel" aria-labelledby="inquiry-title"><div className="ai-panel-heading"><div><div className="eyebrow"><Globe2 size={13} />中／英／西语询盘 · 必须人工复核</div><h2 id="inquiry-title">从客户原始询盘开始</h2><p>提取需求 → 查看原文依据 → 人工确认 → 运行选型。</p></div><span className={`ai-mode-badge ${mode}`}>{mode === "mock" ? "模拟模式 · 不调用付费 API" : "真实 AI · 服务端 API"}</span></div>
    <div className="ai-demo-buttons">{inquiryDemos.map((demo, index) => <button key={demo.id} type="button" className={index === 0 ? "chile-demo-button" : ""} onClick={() => { change(demo.inquiry); setMode("mock"); void extract(demo.inquiry, "mock"); }} disabled={busy}>{index === 0 && <span aria-hidden="true">🇨🇱</span>}{demoLabels[demo.id] ?? demo.title}</button>)}</div>
    <label className="inquiry-text"><span>客户原始询盘</span><textarea maxLength={MAX_INQUIRY_CHARS} rows={5} value={inquiry} onChange={(event) => change(event.target.value)} placeholder="粘贴中文、英文或西班牙文客户询盘…" /></label>
    <div className="inquiry-controls"><label>AI 调用模式<select value={mode} onChange={(event) => { active.current?.abort(); revision.current++; setBusy(false); setMode(event.target.value as "mock" | "live"); }}><option value="mock">模拟演示（Mock）· 仅支持六个预置询盘</option><option value="live" disabled={!config.liveAvailable}>真实 AI（Live）· {config.liveAvailable ? config.model : "付费开关未开启或未配置密钥"}</option></select></label><span>{inquiry.length}/{MAX_INQUIRY_CHARS}</span><button className="primary-button" type="button" disabled={busy || inquiry.trim().length < 10} onClick={() => void extract()}><FileSearch size={16} />{busy ? "正在提取，请稍候…" : "提取客户需求"}<ArrowRight size={15} /></button></div>
    {mode === "live" && <label className="request-checkbox"><input type="checkbox" checked={safeData} onChange={(e) => setSafeData(e.target.checked)} />我确认这是模拟或已人工匿名化的数据，不含客户身份、联系方式、密钥或机密资料。真实 AI 调用会按用量计费。</label>}
    <CallMetricsNote metrics={metrics} />
    {config.configurationError && <p className="ai-error" role="alert">{apiErrorsZh.configuration_error}</p>}
    <p className="ai-privacy"><ShieldCheck size={13} />模拟演示（Mock）不会调用真实 AI。真实模式会将询盘发送给已配置的服务商。本应用不保存询盘正文。</p>
    {error && <p role="alert" className="ai-error">{error}</p>}{notice && <p role="status" className="ai-notice">{notice}</p>}
  </section>;
}

export function ExtractionReview({ extraction, editedFields }: { extraction: ReviewedExtraction; editedFields: string[] }) {
  return <section id="extraction-evidence" className="extraction-review"><h3>需求提取与原文证据 <span>{extraction.language.toUpperCase()} · 选型前请复核</span></h3><p>空白表示未知。修改后的值请以需求表单为准；这里保留原始提取值及原文依据。</p>
    {extraction.warnings.map((warning) => <p className="ai-error" key={warning}>{errorZh(warning)}</p>)}
    <div className="extraction-table" tabIndex={0} aria-label="提取值及原文依据">{Object.entries(extraction.requirements).map(([field, value]) => <div key={field}><div><strong>{fieldZh(field)}</strong>{editedFields.includes(field) ? <span className="manual-tag">已人工修改</span> : value === null || (Array.isArray(value) && value.length === 0) ? <span className="unknown-tag">未知／客户未提供</span> : <span className="evidence-tag">有原文依据</span>}</div><p>{valueZh(field,value)}</p>{extraction.evidence.filter((evidence) => evidence.field === field).map((evidence, i) => <blockquote key={i}>{evidence.quote}</blockquote>)}</div>)}</div>
    <div className="missing-questions"><strong>仍需向客户确认</strong><p>{extraction.requirements.loadVA === null && extraction.requirements.powerFactor === null && "负载 VA 或实测功率因数；"}{extraction.requirements.inputVoltageV === null && "输入电压；"}{extraction.requirements.outputVoltageV === null && "输出电压；"}{extraction.requirements.phases === null && "输入／输出相数；"}{extraction.requirements.frequencyHz === null && "频率；"}{extraction.requirements.mounting === null && "塔式／机架及尺寸；"}{extraction.requirements.budget === null && "预算及币种；"}请确认采购数量、交货地点、每台负载分配及其他约束。</p></div>
  </section>;
}
