"use client";

import { useState } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Box, Check, ChevronDown, CircleHelp, ExternalLink, FileCheck2, Search, ShieldCheck, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { WorkspaceShell } from "./workspace-shell";
import type { Product } from "@/lib/catalog-schema";

type Catalog = { checkedOn: string; disclaimer: string; products: Product[] };
type Fact = { status: string; value: unknown; sourceId: string | null; locator: string | null; note: string };
const labels: Record<string, string> = {
  ratedW: "额定有功功率", ratedVA: "额定视在功率", topology: "UPS 拓扑", 标称电压VoltageV: "型号标称电压", inputVoltageRangeV: "输入工作电压范围", outputVoltagesV: "可配置输出电压", input相数: "输入相数", output相数: "输出相数", frequencyHz: "频率", mounting: "安装方式", rackKitIncluded: "是否包含机架套件", outputConnectors: "输出接口", redundancy: "冗余能力", runtimeCurve: "电池续航曲线", lifecycle智利: "智利当前在售状态", stock: "当地库存", price: "当地价格",
};
function formatValue(fact: Fact, key: string) {
  if (fact.value === null) return "尚未核验";
  if (typeof fact.value === "boolean") return fact.value ? "是" : "不包含，需另购";
  if (key === "topology") return fact.value === "line_interactive" ? "在线互动式" : "在线双变换式";
  if (key === "mounting") return (fact.value as string[]).map((v) => v === "tower" ? "塔式" : "机架式（需选配套件）").join(" / ");
  return String(fact.value) + (key === "ratedW" ? " W" : key === "ratedVA" ? " VA" : key === "标称电压VoltageV" ? " V" : "");
}
function UpsIllustration({ online }: { online: boolean }) {
  return <div className={`ups-scene ${online ? "online" : ""}`} aria-hidden="true"><div className="ups-shadow" /><div className="ups-side" /><div className="ups-front"><span className="ups-brand">UPS</span><div className="ups-display"><span>230<span className="screen-v">V</span></span><i /><i /><i /></div><div className="ups-power" /><div className="ups-vents">{Array.from({ length: online ? 14 : 9 }, (_, i) => <i key={i} />)}</div><span className="ups-mark">{online ? "SRT" : "SMT"}</span></div><span className="schematic-label">外形示意图</span></div>;
}

export function CatalogWorkspace({ catalog }: { catalog: Catalog }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(catalog.products[0].sku);
  const product = catalog.products.find((p) => p.sku === selected)!;
  const visible = catalog.products.filter((p) => p.sku.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "all" || p.specifications.topology.value === filter));
  const verifiedCount = catalog.products.reduce((n, p) => n + Object.values(p.specifications).filter((f) => f.status === "verified_official").length, 0);
  const fields = Object.entries(product.specifications);
  const checkedDate = new Intl.DateTimeFormat("zh-CN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${catalog.checkedOn}T00:00:00Z`));
  const pendingCount = fields.filter(([, f]) => f.value === null).length + Object.values(product.commercial).filter((f) => f.value === null).length;

  return <WorkspaceShell page="catalog">
      <main id="catalog">
        <div className="page-heading"><div><div className="eyebrow"><span />智利市场 · APC UPS</div><h1>产品资料库</h1><p>基于可信证据进行产品初筛。</p></div><a className="secondary-button" href="#evidence"><FileCheck2 size={16} />查看核验记录<ArrowUpRight size={15} /></a></div>
        <div className="disclaimer"><ShieldCheck size={18} /><div><strong>独立学习演示项目，非 Schneider Electric 官方工具。</strong><span>{catalog.disclaimer}。 技术资料可查不代表当地在售或有货。</span></div></div>

        <section className="stats-grid" aria-label="产品库概览">
          <div className="stat"><div className="stat-top">产品范围<Box size={18} /></div><div className="stat-number">03<span>APC Smart-UPS</span></div><div className="stat-foot">范围清晰、来源可追溯的产品库</div></div>
          <div className="stat"><div className="stat-top">官方资料页面<ShieldCheck size={18} /></div><div className="stat-number">03<span className="green-text">智利官网</span></div><div className="stat-foot">{verifiedCount} 个参数字段有官方证据支持</div></div>
          <div className="stat"><div className="stat-top">最近来源核验<Activity size={18} /></div><div className="stat-date">{checkedDate}<span>记录日期 {catalog.checkedOn}</span></div><div className="stat-foot">按日期记录核验 · 非实时库存数据</div></div>
        </section>

        <section className="library-section" aria-labelledby="library-title"><div className="section-heading"><div><h2 id="library-title">浏览产品库 <span>3</span></h2><p>展示已核验事实及证据缺口，不猜测参数。</p></div><span className="catalog-type"><span />基于官方来源的产品库</span></div>
          <div className="toolbar"><div className="filter-tabs" aria-label="按拓扑筛选">{[["all", "所有型号"], ["line_interactive", "在线互动式"], ["double_conversion_online", "在线双变换式"]].map(([value, text]) => <button key={value} aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{text}</button>)}</div><label className="search"><Search size={16} /><input aria-label="按型号搜索" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入产品型号…" /></label></div>
          <div className="product-grid">{visible.map((p) => {
            const online = p.specifications.topology.value === "double_conversion_online";
            return <article className={`product-card ${selected === p.sku ? "is-selected" : ""}`} key={p.sku}>
              <div className="product-image"><span className="product-family">{online ? "SMART-UPS SRT" : "SMART-UPS"}</span><UpsIllustration online={online} /><span className="image-number">0{catalog.products.indexOf(p) + 1}</span></div>
              <div className="product-content"><div className="card-eyebrow">APC BY SCHNEIDER ELECTRIC</div><h3>{p.sku}</h3><p className="product-description">{online ? "在线双变换式" : "在线互动式保护"}</p><div className="power-row"><div><strong>{p.specifications.ratedW.value?.toLocaleString("en-US")}</strong><span>有功功率 W</span></div><span className="power-divider" /><div><strong>{p.specifications.ratedVA.value?.toLocaleString("en-US")}</strong><span>视在功率 VA</span></div><span className="voltage">230 V<small>标称电压</small></span></div>
                <div className="card-facts"><span><Box size={14} />{online ? "塔式／机架式（需套件）" : "塔式安装"}</span><span><ShieldCheck size={14} />智利官方页面</span></div><div className="partial-status"><span />部分参数已核验<CircleHelp size={13} /></div><button className="review-button" aria-pressed={selected === p.sku} onClick={() => { setSelected(p.sku); document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>查看参数与来源证据<ArrowRight size={16} /></button></div>
            </article>;
          })}</div>
          {visible.length === 0 && <div className="empty-state"><Search size={24} /><h3>没有找到对应型号</h3><p>请换一个型号，或清除拓扑筛选。</p><button className="secondary-button" onClick={() => { setQuery(""); setFilter("all"); }}>重置筛选</button></div>}
          <div className="library-note"><CircleHelp size={15} /><span>官网有产品页面 ≠ 已确认匹配。续航、电气兼容性和供货条件仍需分别核验。</span></div>
        </section>

        <section className="evidence-section" id="evidence" aria-labelledby="evidence-title"><div className="section-heading"><div><div className="eyebrow">每个参数均可追溯</div><h2 id="evidence-title">每个产品参数，都要有来源。</h2><p>选择型号，查看已知事实及待核验信息。</p></div><label className="select-product"><span className="sr-only">选择要核验的产品</span><select value={selected} onChange={(e) => setSelected(e.target.value as Product["sku"])}>{catalog.products.map((p) => <option key={p.sku}>{p.sku}</option>)}</select><ChevronDown size={15} /></label></div>
          <div className="evidence-layout"><div className="facts-panel"><div className="panel-heading"><h3>{product.sku} <span>产品技术参数</span></h3><span className="pending-badge">{pendingCount} 项待核验</span></div><div className="fact-table">{fields.map(([key, fact]) => <details className="fact-row" key={`${selected}-${key}`}><summary><span className="fact-label">{labels[key]}</span><span className={`fact-value ${fact.value === null ? "unknown" : ""}`}>{formatValue(fact, key)}</span><span className={fact.value === null ? "fact-icon pending" : "fact-icon verified"}>{fact.value === null ? <CircleHelp size={15} /> : <Check size={15} />}</span><ChevronDown size={14} /></summary><div className="fact-detail"><p><strong>原始核验备注：</strong>{fact.note}</p>{fact.status === "verified_official" ? <><p><strong>证据位置：</strong> {fact.locator} · 核验于 {product.verifiedOn}</p><a href={product.sources.find((s) => s.id === fact.sourceId)?.url} target="_blank" rel="noreferrer">打开官方来源<ExternalLink size={12} /></a></> : <p className="unknown">待人工核验 · 未保存任何已确认值</p>}</div></details>)}</div></div>
            <aside className="source-panel"><div className="source-icon"><FileCheck2 size={24} /></div><h3>官方来源记录</h3><p>Schneider Electric 智利官网</p><a className="source-link" href={product.sourceUrl} target="_blank" rel="noreferrer">{product.sku} 产品页面<ArrowUpRight size={15} /></a><dl><div><dt>来源地区</dt><dd>智利 · 西班牙语</dd></div><div><dt>核验日期</dt><dd>{product.verifiedOn}</dd></div><div><dt>证据状态</dt><dd>部分参数已核验</dd></div></dl><div className="source-limit"><CircleHelp size={16} /><p>已获取官方页面正文；动态电气参数表和续航曲线仍未取得。</p></div><div className="commercial-heading">商业条件核验</div>{Object.entries(product.commercial).map(([key, fact]) => <details className="commercial-row" key={key}><summary><span>{labels[key]}</span><span>未知<ChevronDown size={12} /></span></summary><p><strong>原始核验备注：</strong>{fact.note}</p></details>)}<p className="source-caption">来源核验仅确认资料中明确记录的事实，不代表完整技术方案已通过。</p></aside></div>
        </section>

        <section className="roadmap" id="roadmap"><div className="roadmap-intro"><span className="roadmap-icon"><Sparkles size={20} /></span><div><h2>分阶段开发，逐步核验。</h2><p>已支持自然语言询盘、人工复核、确定性选型及事实锁定回复。</p></div></div><div className="roadmap-grid">{[["01", "项目基础与真实资料", "已完成", Box], ["02", "规则引擎与手动选型", "已完成", SlidersHorizontal], ["03", "AI 解析与销售回复", "已实现", Sparkles], ["04", "后续扩展", "尚未开始", BookOpen]].map(([n, title, status, Icon]) => {
          const StageIcon = Icon as typeof Box;
          return <div className={`roadmap-step ${n === "03" ? "current" : ""}`} key={String(n)}><div><span>{String(n)}</span><StageIcon size={17} /></div><h3>{String(title)}</h3><p>{String(status)}{n === "03" && <ArrowDown size={12} />}</p></div>;
        })}</div><p className="roadmap-note">模拟演示无需密钥；真实 AI 需配置服务端密钥与付费开关。中文界面不改变产品事实或规则结论。</p></section>
        <footer><a className="footer-brand" href="#catalog"><Zap size={15} />Sales Engineer AI</a><span>独立学习演示项目 · 非 Schneider Electric 官方工具</span><span>依据证据，不靠猜测。</span></footer>
      </main>
  </WorkspaceShell>;
}
