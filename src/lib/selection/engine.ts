import { z } from "zod";
import { productSchema, type Product } from "../catalog-schema";
import { normalizeRequirements, requirementsSchema, type NormalizedRequirements } from "./requirements";

export type MatchStatus = "confirmed_match" | "pending_verification" | "excluded";
export const statusLabels: Record<MatchStatus, string> = {
  confirmed_match: "Matched", pending_verification: "Pending Verification", excluded: "Not Matched",
};
export type EvidenceReference = { field: string; url: string; verifiedOn: string; locator: string };
export type RuleCheck = {
  id: string;
  label: string;
  outcome: "passed" | "failed" | "pending" | "advisory" | "not_required";
  required: boolean;
  reason: string;
  evidence: EvidenceReference[];
  question?: { audience: "customer" | "manufacturer"; text: string };
};
export type SelectionResult = {
  product: Product;
  status: MatchStatus;
  checks: RuleCheck[];
  nextQuestions: NonNullable<RuleCheck["question"]>[];
  marginSatisfied: boolean;
};
export type SelectionReport =
  | { ok: false; issues: { field: string; message: string }[] }
  | { ok: true; requirements: NormalizedRequirements; results: SelectionResult[] };

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-10;
const atLeast = (available: number, required: number) => available >= required || near(available, required);
const display = (n: number) => Number(n.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 3 });

function evaluate(product: Product, req: NormalizedRequirements): SelectionResult {
  const checks: RuleCheck[] = [];
  const spec = product.specifications;
  const loadBasisKnown = req.quantity === null || req.quantity <= 1 || req.loadPerUnitConfirmed;
  type Field = keyof Product["specifications"] | keyof Product["commercial"];
  const fact = (field: Field) => field in spec ? spec[field as keyof typeof spec] : product.commercial[field as keyof Product["commercial"]];
  const evidence = (fields: Field[]): EvidenceReference[] => fields.flatMap((field) => {
    const value = fact(field);
    if (value.status !== "verified_official") return [];
    const source = product.sources.find((s) => s.id === value.sourceId)!;
    return [{ field, url: source.url, verifiedOn: source.verifiedOn, locator: value.locator }];
  });
  const add = (id: string, label: string, outcome: RuleCheck["outcome"], reason: string, fields: Field[] = [], question?: RuleCheck["question"], required = true) => {
    checks.push({ id, label, outcome, required, reason, evidence: evidence(fields), ...(question ? { question } : {}) });
  };
  const pending = (id: string, label: string, reason: string, text: string, audience: "customer" | "manufacturer" = "manufacturer", fields: Field[] = [], required = true) => add(id, label, "pending", reason, fields, { audience, text }, required);
  const compare = (id: string, label: string, pass: boolean, reason: string, fields: Field[]) => add(id, label, pass ? "passed" : "failed", reason, fields);

  if (!loadBasisKnown) pending("capacity_w", "Active power (W)", "Multiple units requested; per-UPS load is not confirmed. No automatic load allocation.", "Is the stated W/VA load per UPS or the total project load? Confirm the per-UPS load before sizing.", "customer");
  else if (spec.ratedW.value === null) pending("capacity_w", "Active power (W)", "Verified rated W is missing.", "Please provide the official rated W for this exact SKU.");
  else compare("capacity_w", "Active power (W)", atLeast(spec.ratedW.value, req.loadW), `${display(req.loadW)} W load vs ${display(spec.ratedW.value)} W rated.`, ["ratedW"]);
  if (!loadBasisKnown) pending("capacity_va", "Apparent power (VA)", "Per-UPS load allocation is unconfirmed; VA is not allocated automatically.", "Is the stated W/VA load per UPS or the total project load? Confirm the per-UPS load before sizing.", "customer");
  else if (req.effectiveVA === null) pending("capacity_va", "Apparent power (VA)", "VA is unknown; W alone cannot establish apparent-power capacity.", "What is the total load in VA, or the measured load power factor?", "customer");
  else if (spec.ratedVA.value === null) pending("capacity_va", "Apparent power (VA)", "Verified rated VA is missing.", "Please provide the official rated VA for this exact SKU.");
  else compare("capacity_va", "Apparent power (VA)", atLeast(spec.ratedVA.value, req.effectiveVA), `${display(req.effectiveVA)} VA ${req.vaOrigin === "derived" ? "derived from W / PF" : "provided"} vs ${display(spec.ratedVA.value)} VA rated.`, ["ratedVA"]);

  const multiplier = 1 + req.marginPercent / 100;
  const targetW = req.loadW * multiplier;
  const targetVA = req.effectiveVA === null ? null : req.effectiveVA * multiplier;
  const marginKnown = loadBasisKnown && spec.ratedW.value !== null && spec.ratedVA.value !== null && targetVA !== null;
  const marginSatisfied = marginKnown && atLeast(spec.ratedW.value!, targetW) && atLeast(spec.ratedVA.value!, targetVA!);
  if (req.marginPercent === 0) add("margin", "Capacity margin", "not_required", "0% additional capacity selected; rated W and VA checks still apply.", [], undefined, false);
  else if (!marginKnown) pending("margin", "Capacity margin", `${req.marginPercent}% policy cannot be fully checked without both W and VA ratings and load values.`, "Confirm load VA/PF and the official W/VA ratings before checking the margin.", req.effectiveVA === null ? "customer" : "manufacturer", ["ratedW", "ratedVA"], req.marginMode === "hard");
  else add("margin", "Capacity margin", marginSatisfied ? "passed" : req.marginMode === "hard" ? "failed" : "advisory", `${req.marginPercent}% ${req.marginMode} policy: required capacity ≥ ${display(targetW)} W and ${display(targetVA!)} VA. ${marginSatisfied ? "Target met." : "Target not met."} This configurable policy is not a universal industry requirement.`, ["ratedW", "ratedVA"], undefined, req.marginMode === "hard");

  if (req.topology === null) pending("topology", "Topology", "Customer topology requirement is unknown.", "Is online double conversion required, or is either topology acceptable?", "customer");
  else if (req.topology === "any") add("topology", "Topology", "not_required", "Customer explicitly allows either topology.", [], undefined, false);
  else if (spec.topology.value === null) pending("topology", "Topology", "Product topology is not verified.", "Please confirm this SKU's topology from official documentation.");
  else compare("topology", "Topology", spec.topology.value === req.topology, `Required ${req.topology}; documented ${spec.topology.value}.`, ["topology"]);

  if (req.inputVoltageV === null) pending("input_voltage", "Input voltage", "Customer input voltage is unknown; country is not used to infer it.", "What voltage is available at the UPS supply point?", "customer");
  else if (spec.inputVoltageRangeV.value === null) pending("input_voltage", "Input voltage", `Customer requires ${req.inputVoltageV} V. The model's nominal voltage does not establish its input operating range.`, "Please provide the official input operating range and relevant load/derating conditions.");
  else {
    const range = spec.inputVoltageRangeV.value;
    compare("input_voltage", "Input voltage", atLeast(req.inputVoltageV, range.min) && atLeast(range.max, req.inputVoltageV), `${req.inputVoltageV} V requested; verified range ${range.min}–${range.max} V. Installation/load-specific derating still needs review.`, ["inputVoltageRangeV"]);
  }
  if (req.outputVoltageV === null) pending("output_voltage", "Output voltage", "Customer output voltage is unknown.", "What output voltage does the protected equipment require?", "customer");
  else if (spec.outputVoltagesV.value === null) pending("output_voltage", "Output voltage", `${req.outputVoltageV} V requested; no verified configurable output voltage list.`, "Please provide this SKU's official configurable output voltages.");
  else compare("output_voltage", "Output voltage", spec.outputVoltagesV.value.includes(req.outputVoltageV), `${req.outputVoltageV} V requested; verified outputs: ${spec.outputVoltagesV.value.join(", ")} V.`, ["outputVoltagesV"]);
  for (const field of ["inputPhases", "outputPhases"] as const) {
    const label = field === "inputPhases" ? "Input phases" : "Output phases";
    if (req.phases === null) pending(field, label, "Customer phase requirement is unknown.", "Confirm the input and output phase configuration; this form uses the same phase count for both.", "customer");
    else if (spec[field].value === null) pending(field, label, `${req.phases}-phase requested; ${label.toLowerCase()} not verified.`, `Please provide the official ${label.toLowerCase()} for this exact SKU.`);
    else compare(field, label, spec[field].value === req.phases, `${req.phases}-phase requested; ${spec[field].value}-phase documented.`, [field]);
  }

  if (req.frequencyHz !== null) {
    if (spec.frequencyHz.value === null) pending("frequency", "Frequency", `${req.frequencyHz} Hz requested; manufacturer frequency specification is unverified.`, "Please verify input/output frequency and compatibility for this exact SKU.");
    else compare("frequency", "Frequency", spec.frequencyHz.value.includes(req.frequencyHz), `${req.frequencyHz} Hz requested; verified values: ${spec.frequencyHz.value.join(", ")} Hz.`, ["frequencyHz"]);
  }
  req.otherConstraints.forEach((constraint, index) => pending(`other_${index}`, "Additional requirement", `Unresolved customer requirement: ${constraint}`, `Please clarify and verify the additional requirement: ${constraint}`, "customer"));

  if (req.mounting === null) pending("mounting", "Installation", "Customer installation requirement is unknown.", "Will the UPS be installed as a tower or in a rack?", "customer");
  else if (spec.mounting.value === null) pending("mounting", "Installation", "Product installation modes are not verified.", "Please verify the installation modes and accessories for this SKU.");
  else if (req.mounting === "tower") compare("mounting", "Installation", spec.mounting.value.includes("tower"), `Tower requested; documented modes: ${spec.mounting.value.join(", ")}.`, ["mounting"]);
  else if (!spec.mounting.value.includes("rack_with_optional_kit")) {
    // An explicit tower listing alone does not prove rack incompatibility.
    pending("mounting", "Installation", "Rack compatibility is not established by the documented tower mode.", "Please confirm rack compatibility for this exact SKU; do not substitute a rack variant.", "manufacturer", ["mounting"]);
  } else if (req.rackKitAccepted === false) compare("mounting", "Installation", false, "Rack requested but customer does not accept the required separate conversion kit.", ["mounting", "rackKitIncluded"]);
  else pending("mounting", "Installation", `Rack conversion is documented. ${req.rackKitAccepted === true ? "Separate kit accepted, but exact kit/cabinet fit and accessory quote remain unverified." : "Customer acceptance of the separate kit and its installation fit are unknown."}`, req.rackKitAccepted === true ? "Please verify the rail kit, cabinet dimensions and complete accessory quotation." : "Can the solution include the separately purchased rack conversion kit, subject to fit verification?", req.rackKitAccepted === true ? "manufacturer" : "customer", ["mounting", "rackKitIncluded"]);

  if (req.runtimeMinutes === 0) add("runtime", "Battery runtime", "not_required", "Customer explicitly specified no minimum runtime target; no runtime claim is made.", [], undefined, false);
  else if (!loadBasisKnown) pending("runtime", "Battery runtime", "Per-UPS load must be confirmed before checking manufacturer runtime data.", "Confirm the actual load on each UPS and the required battery configuration.", "customer");
  else if (req.runtimeMinutes === null) pending("runtime", "Battery runtime", "Minimum runtime is unknown.", "How many minutes of backup are required at the stated load?", "customer");
  else if (spec.runtimeCurve.value === null) pending("runtime", "Battery runtime", `${req.runtimeMinutes} minutes requested at ${req.loadW} W; official runtime data is missing. No runtime inferred from rating or battery capacity.`, `Please provide manufacturer runtime data at ${req.loadW} W, with battery configuration and test conditions.`);
  else {
    const curve = spec.runtimeCurve.value;
    if (req.batteryConfiguration !== curve.batteryConfiguration || req.runtimeConditions !== curve.conditions) pending("runtime", "Battery runtime", "Manufacturer data exists, but its battery configuration/test conditions have not been confirmed applicable.", "Confirm the exact battery configuration and applicability of the manufacturer's runtime test conditions.", "manufacturer", ["runtimeCurve"]);
    else {
      const point = curve.points.find((p) => near(p.loadW, req.loadW));
      if (!point) pending("runtime", "Battery runtime", "No manufacturer runtime point at this load. This engine does not interpolate or extrapolate.", `Please obtain a manufacturer runtime point at ${req.loadW} W.`, "manufacturer", ["runtimeCurve"]);
      else compare("runtime", "Battery runtime", atLeast(point.minutes, req.runtimeMinutes), `${point.minutes} minutes documented at ${point.loadW} W for ${curve.batteryConfiguration}; ${req.runtimeMinutes} minutes required. Conditions: ${curve.conditions}.`, ["runtimeCurve"]);
    }
  }

  if (req.redundancy === "not_required") add("redundancy", "Redundancy", "not_required", "Customer explicitly has no redundancy requirement.", [], undefined, false);
  else if (req.redundancy !== null && spec.redundancy.value !== null && ["no", "none", "not_supported"].includes(spec.redundancy.value.trim().toLowerCase())) compare("redundancy", "Redundancy", false, `Requested ${req.redundancy}; documented redundancy: ${spec.redundancy.value}. A multi-UPS architecture is outside single-product matching.`, ["redundancy"]);
  else pending("redundancy", "Redundancy", req.redundancy === null ? "Redundancy requirement is unknown." : `Requested ${req.redundancy}; a system architecture review is required. No redundancy capability is inferred.`, req.redundancy === null ? "Is N+1 or dual-path redundancy required, or is a single UPS acceptable?" : "Please validate the proposed redundancy architecture and all required components.", req.redundancy === null ? "customer" : "manufacturer");

  if (req.country !== product.market) pending("market", "Market availability", `Requested country ${req.country}; this catalog has only Chile evidence.`, `Please confirm local lifecycle, certification and availability in ${req.country}.`);
  else if (product.commercial.lifecycleChile.value === null) pending("market", "Market availability", "Chile sales lifecycle is unknown. An official page is not proof of current sale.", "Please confirm whether this exact SKU is currently offered for sale in Chile.");
  else compare("market", "Market availability", product.commercial.lifecycleChile.value === "active", `Chile lifecycle: ${product.commercial.lifecycleChile.value}.`, ["lifecycleChile"]);

  if (req.budget === null) pending("budget", "Budget", "Budget is unspecified, so affordability is not confirmed.", "Is there a budget ceiling and currency, or explicitly no budget constraint?", "customer");
  else if (req.budget.kind === "unconstrained") add("budget", "Budget", "not_required", "Customer explicitly stated no budget ceiling. Price remains unverified; no affordability claim is made.", [], undefined, false);
  else if (req.mounting === "rack") pending("budget", "Budget", "A rack solution needs an inclusive accessory quote; a base-UPS price alone would not establish budget fit.", "Please obtain a complete UPS and rack-kit quotation in the customer's budget currency.");
  else if (product.commercial.price.value === null || product.commercial.price.value.currency !== req.budget.currency) pending("budget", "Budget", `Ceiling ${req.budget.amount} ${req.budget.currency}; no verified comparable price. No exchange rate or quote is inferred.`, `Please obtain a current quote in ${req.budget.currency} with agreed tax, delivery and scope terms.`);
  else if (!atLeast(req.budget.amount, product.commercial.price.value.amount)) compare("budget", "Budget", false, `Budget ${req.budget.amount} ${req.budget.currency} is below the documented base-UPS amount ${product.commercial.price.value.amount} ${product.commercial.price.value.currency}.`, ["price"]);
  else pending("budget", "Budget", `Documented base-UPS amount ${product.commercial.price.value.amount} ${product.commercial.price.value.currency} is within the ceiling, but taxes, delivery and complete quote scope are not established.`, "Please confirm a current complete-scope quotation including agreed taxes, delivery and accessories.", "manufacturer", ["price"]);

  if (product.commercial.stock.value === null) pending("stock", "Stock", `Stock is unknown.${req.requireInStock ? " Immediate stock is required." : " No immediate-stock requirement selected; this is a separate commercial caveat."}`, "Please confirm stock and delivery lead time with an authorized local channel.", "manufacturer", [], req.requireInStock);
  else if (req.requireInStock && product.commercial.stock.value > 0 && req.quantity === null) pending("stock", "Stock", `Documented stock: ${product.commercial.stock.value}; requested order quantity is unknown, so stock adequacy is not confirmed.`, "How many UPS units must be available immediately?", "customer", ["stock"]);
  else if (req.requireInStock) compare("stock", "Stock", product.commercial.stock.value > 0 && req.quantity !== null && product.commercial.stock.value >= req.quantity, `Documented stock: ${product.commercial.stock.value}; requested quantity: ${req.quantity ?? "unknown"}. Immediate stock is required. Reconfirm before ordering.`, ["stock"]);
  else add("stock", "Stock", "not_required", `Documented stock: ${product.commercial.stock.value}; no immediate-stock requirement selected. Reconfirm before ordering.`, ["stock"], undefined, false);

  const status: MatchStatus = checks.some((c) => c.required && c.outcome === "failed") ? "excluded" : checks.some((c) => c.required && c.outcome === "pending") ? "pending_verification" : "confirmed_match";
  const questions = checks.filter((c) => c.question).map((c) => c.question!);
  const nextQuestions = questions.filter((q, i) => questions.findIndex((p) => p.audience === q.audience && p.text === q.text) === i).sort((a, b) => Number(a.audience === "manufacturer") - Number(b.audience === "manufacturer"));
  return { product, status, checks, nextQuestions, marginSatisfied };
}

/** Pure, deterministic public entry point; no network, UI state or AI dependency. */
export function selectProducts(products: unknown, input: unknown): SelectionReport {
  const request = requirementsSchema.safeParse(input);
  if (!request.success) return { ok: false, issues: request.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) };
  const catalog = z.array(productSchema).safeParse(products);
  if (!catalog.success) return { ok: false, issues: catalog.error.issues.map((issue) => ({ field: `products.${issue.path.join(".")}`, message: issue.message })) };
  const requirements = normalizeRequirements(request.data);
  if (requirements.effectiveVA !== null && !Number.isFinite(requirements.effectiveVA * (1 + requirements.marginPercent / 100))) return { ok: false, issues: [{ field: "powerFactor", message: "Derived capacity target is outside the supported numeric range." }] };
  const results = catalog.data.map((product) => evaluate(product, requirements));
  const order: Record<MatchStatus, number> = { confirmed_match: 0, pending_verification: 1, excluded: 2 };
  const unresolved = (r: SelectionResult) => r.checks.filter((c) => c.required && (c.outcome === "failed" || c.outcome === "pending")).length;
  results.sort((a, b) => order[a.status] - order[b.status] || unresolved(a) - unresolved(b) || Number(b.marginSatisfied) - Number(a.marginSatisfied) || (a.product.specifications.ratedW.value ?? Infinity) - (b.product.specifications.ratedW.value ?? Infinity) || (a.product.specifications.ratedVA.value ?? Infinity) - (b.product.specifications.ratedVA.value ?? Infinity) || a.product.sku.localeCompare(b.product.sku));
  return { ok: true, requirements, results };
}
