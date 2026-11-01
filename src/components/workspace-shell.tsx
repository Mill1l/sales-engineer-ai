import Link from "next/link";
import { BookOpen, Layers3, ListChecks, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";

export function WorkspaceShell({ page, children }: { page: "catalog" | "selection"; children: React.ReactNode }) {
  const selection = page === "selection";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Sales Engineer AI home"><span className="brand-icon"><Zap size={21} fill="currentColor" /></span><span>Sales Engineer<span className="brand-ai">AI</span></span></Link>
      <div className="workspace-label">售前工作台</div>
      <nav aria-label="工作台导航">
        <Link title="产品资料库" className={`nav-link ${!selection ? "active" : ""}`} href="/" aria-current={!selection ? "page" : undefined}><Layers3 size={18} />产品资料库<span className="nav-count">3</span></Link>
        <Link title="询盘与选型" className={`nav-link ${selection ? "active" : ""}`} href="/selection" aria-current={selection ? "page" : undefined}><SlidersHorizontal size={18} />询盘与选型</Link>
        <Link className="nav-link" href="/#evidence"><ShieldCheck size={18} />来源与证据</Link>
        <Link className="nav-link" href="/#roadmap"><ListChecks size={18} />开发进度</Link>
      </nav>
      <div className="sidebar-divider" /><div className="workspace-label">当前产品范围</div>
      <div className="market-row"><span className="chile-flag" aria-hidden="true">★</span><div>智利<span>APC UPS · 3 个型号</span></div><span className="live-dot" /></div>
      <div className="sidebar-bottom"><div className="learning-tag"><BookOpen size={16} />独立学习演示项目</div><p>证据优先。<br />让销售沟通更有依据。</p><div className="profile"><div className="avatar">SE</div><div>技术售前<span>本地工作台 · 中文界面</span></div></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs">工作台 <span>/</span><strong>{selection ? "询盘与选型" : "产品资料库"}</strong></div><div className="topbar-right"><Link className="workspace-switch" href={selection ? "/" : "/selection"}>{selection ? "产品资料库" : "询盘与选型"}</Link><span className="phase-pill">中文界面</span></div></header>{children}</div>
  </div>;
}
