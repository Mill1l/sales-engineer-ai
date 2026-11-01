import { emptyDraft, type RequirementDraft } from "./form";

// Fictional customer inquiries only. All evaluations still use the real Phase 1 catalog.
const base: RequirementDraft = {
  ...emptyDraft, country: "CL", application: "Small server room in Santiago", loadW: "800", loadVA: "1000",
  inputVoltageV: "230", outputVoltageV: "230", phases: "1", topology: "any", runtimeMinutes: "15",
  mounting: "tower", budgetMode: "unconstrained", redundancy: "not_required",
};
export const selectionDemos = [
  { id: "server-room", title: "800 W server room", detail: "Three pending candidates; electrical, runtime and market evidence needed.", draft: base },
  { id: "online", title: "Online required", detail: "1,600 W, PF 0.8 → 2,000 VA. SMT excluded; SRT models pending.", draft: { ...base, loadW: "1600", loadVA: "", powerFactor: "0.8", topology: "double_conversion_online" } },
  { id: "va-limit", title: "W fits, VA does not", detail: "900 W / 1,800 VA. SMT excluded on VA; SRT models remain pending.", draft: { ...base, loadW: "900", loadVA: "1800" } },
  { id: "missing-va", title: "Missing VA / PF", detail: "800 W only. No apparent-power assumption; ask the customer.", draft: { ...base, loadVA: "", powerFactor: "" } },
  { id: "overload", title: "3,000 W overload", detail: "All three products excluded on rated active power.", draft: { ...base, loadW: "3000", loadVA: "3300" } },
  { id: "hard-margin", title: "20% margin as a hard limit", detail: "900 W / 1,000 VA → 1,080 W / 1,200 VA target. SMT excluded.", draft: { ...base, loadW: "900", loadVA: "1000", marginMode: "hard" } },
];
