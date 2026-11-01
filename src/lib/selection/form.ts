export const emptyDraft = {
  country: "", application: "", loadW: "", loadVA: "", powerFactor: "",
  inputVoltageV: "", outputVoltageV: "", phases: "", topology: "", runtimeMinutes: "",
  mounting: "", rackKitAccepted: "", budgetMode: "", budgetAmount: "", budgetCurrency: "",
  redundancy: "", requireInStock: false, marginPercent: "20", marginMode: "advisory",
  batteryConfiguration: "", runtimeConditions: "",
  frequencyHz: "", quantity: "", destination: "", otherConstraints: "",
  loadPerUnitConfirmed: false,
};
export type RequirementDraft = typeof emptyDraft;
const numeric = (text: string) => text.trim() === "" ? null : Number(text);

/** Explicit boundary adapter. Empty optional numeric fields stay null, never zero. */
export function draftToInput(draft: RequirementDraft) {
  return {
    country: draft.country, application: draft.application,
    loadW: numeric(draft.loadW), loadVA: numeric(draft.loadVA), powerFactor: numeric(draft.powerFactor),
    inputVoltageV: numeric(draft.inputVoltageV), outputVoltageV: numeric(draft.outputVoltageV),
    phases: numeric(draft.phases), topology: draft.topology || null,
    runtimeMinutes: numeric(draft.runtimeMinutes), mounting: draft.mounting || null,
    rackKitAccepted: draft.rackKitAccepted === "" ? null : draft.rackKitAccepted === "yes",
    budget: draft.budgetMode === "unconstrained" ? { kind: "unconstrained" } : draft.budgetMode === "limit" ? { kind: "limit", amount: numeric(draft.budgetAmount), currency: draft.budgetCurrency } : null,
    redundancy: draft.redundancy || null, requireInStock: draft.requireInStock,
    marginPercent: numeric(draft.marginPercent), marginMode: draft.marginMode,
    batteryConfiguration: draft.batteryConfiguration.trim() || null, runtimeConditions: draft.runtimeConditions.trim() || null,
    frequencyHz: numeric(draft.frequencyHz), quantity: numeric(draft.quantity), destination: draft.destination.trim() || null,
    otherConstraints: draft.otherConstraints.split("\n").map((line) => line.trim()).filter(Boolean),
    loadPerUnitConfirmed: draft.loadPerUnitConfirmed,
  };
}
