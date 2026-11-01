import { describe, expect, it } from "vitest";
import data from "../src/data/products.json";
import { catalogSchema, productSchema, type Product } from "../src/lib/catalog-schema";
import { selectProducts, type SelectionResult } from "../src/lib/selection/engine";
import { requirementsSchema } from "../src/lib/selection/requirements";
import { draftToInput, emptyDraft } from "../src/lib/selection/form";
import { selectionDemos } from "../src/lib/selection/demos";

const products = catalogSchema.parse(data).products;
const request = {
  country: "CL", application: "Server room", loadW: 800, loadVA: 1000, inputVoltageV: 230,
  outputVoltageV: 230, phases: 1, topology: "any", runtimeMinutes: 15, mounting: "tower",
  budget: { kind: "unconstrained" }, redundancy: "not_required",
};
function run(input: unknown = request, catalog: unknown = products) {
  const report = selectProducts(catalog, input);
  if (!report.ok) throw new Error(JSON.stringify(report.issues));
  return report;
}
const check = (result: SelectionResult, id: string) => result.checks.find((c) => c.id === id)!;
const bySku = (sku: string, input: unknown = request) => run(input).results.find((r) => r.product.sku === sku)!;

/** SYNTHETIC TEST FIXTURE ONLY. No new facts are written to the product library. */
function completeFixture(): Product {
  const copy = structuredClone(products[1]);
  const proof = <T,>(value: T) => ({ status: "verified_official" as const, value, sourceId: copy.sources[0].id, locator: "SYNTHETIC TEST DATA — not official evidence", note: "Synthetic unit-test fact, never displayed in the real catalog." });
  copy.specifications.inputVoltageRangeV = proof({ min: 220, max: 240 });
  copy.specifications.outputVoltagesV = proof([220, 230, 240]);
  copy.specifications.inputPhases = proof(1);
  copy.specifications.outputPhases = proof(1);
  copy.specifications.runtimeCurve = proof({ batteryConfiguration: "TEST internal battery", conditions: "TEST controlled conditions", points: [{ loadW: 800, minutes: 20 }] });
  copy.commercial.lifecycleChile = proof("active" as const);
  return productSchema.parse(copy);
}
const completeRequest = { ...request, batteryConfiguration: "TEST internal battery", runtimeConditions: "TEST controlled conditions" };

describe("selection rules against the real partially verified catalog", () => {
  it("passes W and VA capacity without incorrectly confirming the whole solution", () => {
    const result = bySku("SMT1500I");
    expect(check(result, "capacity_w").outcome).toBe("passed");
    expect(check(result, "capacity_va").outcome).toBe("passed");
    expect(result.status).toBe("pending_verification");
  });
  it("excludes a confirmed W overload despite unrelated missing facts", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 1100, loadVA: 1400 });
    expect(check(result, "capacity_w").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
    expect(check(result, "runtime").outcome).toBe("pending");
  });
  it("does not confuse W capacity with VA capacity", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 900, loadVA: 1800 });
    expect(check(result, "capacity_w").outcome).toBe("passed");
    expect(check(result, "capacity_va").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("excludes line interactive when online double conversion is required", () => {
    const result = bySku("SMT1500I", { ...request, topology: "double_conversion_online" });
    expect(check(result, "topology").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("keeps VA unknown when both VA and PF are missing", () => {
    const report = run({ ...request, loadVA: null, powerFactor: null });
    expect(report.requirements.effectiveVA).toBeNull();
    expect(report.requirements.vaOrigin).toBe("unknown");
    for (const result of report.results) {
      expect(check(result, "capacity_va").outcome).toBe("pending");
      expect(result.nextQuestions.some((q) => q.audience === "customer" && q.text.includes("VA"))).toBe(true);
    }
  });
  it("derives missing VA only from explicit W and PF", () => {
    const report = run({ ...request, loadW: 1600, loadVA: null, powerFactor: 0.8 });
    expect(report.requirements.effectiveVA).toBe(2000);
    expect(report.requirements.vaOrigin).toBe("derived");
    expect(report.requirements.derivation).toContain("1600 / 0.8 = 2000");
  });
  it("does not need to invent PF when load VA is supplied", () => {
    const report = run(request);
    expect(report.requirements.powerFactor).toBeNull();
    expect(report.requirements.vaOrigin).toBe("provided");
    expect(report.results.every((r) => check(r, "capacity_va").outcome === "passed")).toBe(true);
  });
  it("keeps a 15-minute runtime target pending without manufacturer data", () => {
    const result = bySku("SRT3000XLI");
    expect(check(result, "runtime").outcome).toBe("pending");
    expect(check(result, "runtime").reason).toContain("15 minutes");
  });
  it("does not use nominal 230 V to prove input/output compatibility or phases", () => {
    const result = bySku("SMT1500I");
    for (const id of ["input_voltage", "output_voltage", "inputPhases", "outputPhases"]) expect(check(result, id).outcome).toBe("pending");
    expect(result.product.specifications.nominalVoltageV.value).toBe(230);
  });
  it("does not infer supply voltage from country", () => {
    const result = bySku("SMT1500I", { ...request, inputVoltageV: null });
    expect(check(result, "input_voltage").question?.audience).toBe("customer");
  });
  it("keeps unknown budget and Chile sale status pending", () => {
    const result = bySku("SRT2200XLI", { ...request, budget: null });
    expect(check(result, "budget").outcome).toBe("pending");
    expect(check(result, "market").outcome).toBe("pending");
    expect(check(result, "stock").outcome).toBe("pending");
  });
  it("does not claim a product meets a supplied budget without a quote", () => {
    const result = bySku("SMT1500I", { ...request, budget: { kind: "limit", amount: 1000000, currency: "CLP" } });
    expect(check(result, "budget").outcome).toBe("pending");
  });
  it("does not treat Chile evidence as local availability for another country", () => {
    const result = bySku("SRT3000XLI", { ...request, country: "US" });
    expect(check(result, "market").outcome).toBe("pending");
  });
  it("uses margin as advisory by default instead of rejecting rated-capacity fits", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 900, loadVA: 1000 });
    expect(check(result, "capacity_w").outcome).toBe("passed");
    expect(check(result, "margin").outcome).toBe("advisory");
    expect(result.status).toBe("pending_verification");
  });
  it("enforces an explicitly hard 20% capacity policy", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 900, loadVA: 1000, marginMode: "hard", marginPercent: 20 });
    expect(check(result, "margin").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("allows a 0% margin while still checking rated limits", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 1000, loadVA: 1500, marginPercent: 0 });
    expect(check(result, "capacity_w").outcome).toBe("passed");
    expect(check(result, "capacity_va").outcome).toBe("passed");
    expect(check(result, "margin").outcome).toBe("not_required");
  });
  it("handles floating-point boundary calculations without false rejection", () => {
    const result = bySku("SMT1500I", { ...request, loadW: 1000 / 1.2, loadVA: 1000, marginPercent: 20, marginMode: "hard" });
    expect(check(result, "margin").outcome).toBe("passed");
  });
  it("never declares an unknown topology or mounting requirement satisfied", () => {
    const result = bySku("SMT1500I", { ...request, topology: null, mounting: null });
    expect(check(result, "topology").outcome).toBe("pending");
    expect(check(result, "mounting").outcome).toBe("pending");
  });
  it("keeps rack compatibility pending when only tower is documented", () => {
    const result = bySku("SMT1500I", { ...request, mounting: "rack" });
    expect(check(result, "mounting").outcome).toBe("pending");
  });
  it("requires kit acceptance and installation fit verification for SRT racks", () => {
    expect(check(bySku("SRT2200XLI", { ...request, mounting: "rack" }), "mounting").outcome).toBe("pending");
    expect(check(bySku("SRT2200XLI", { ...request, mounting: "rack", rackKitAccepted: true }), "mounting").outcome).toBe("pending");
    expect(bySku("SRT2200XLI", { ...request, mounting: "rack", rackKitAccepted: false }).status).toBe("excluded");
  });
  it("keeps redundancy requests pending for architecture review", () => {
    expect(check(bySku("SRT3000XLI", { ...request, redundancy: "n_plus_one" }), "redundancy").outcome).toBe("pending");
  });
  it("sorts viable candidates before excluded products with a stable smallest-fit tie break", () => {
    const report = run({ ...request, topology: "double_conversion_online" });
    expect(report.results.map((r) => r.product.sku)).toEqual(["SRT2200XLI", "SRT3000XLI", "SMT1500I"]);
    expect(run({ ...request, topology: "double_conversion_online" }, [...products].reverse()).results.map((r) => r.product.sku)).toEqual(report.results.map((r) => r.product.sku));
  });
  it("prioritizes margin-compliant candidates over advisory undersizing", () => {
    expect(run({ ...request, loadW: 900, loadVA: 1000 }).results[0].product.sku).toBe("SRT2200XLI");
  });
  it("retains product evidence status, attaches source citations and never mutates the catalog", () => {
    const before = JSON.stringify(products);
    const result = bySku("SMT1500I");
    expect(result.product.recordStatus).toBe("partially_verified");
    expect(check(result, "capacity_w").evidence[0]).toMatchObject({ field: "ratedW", verifiedOn: "2026-10-31", url: products[0].sourceUrl });
    expect(JSON.stringify(products)).toBe(before);
  });
});

describe("explicitly synthetic verified-conditions tests", () => {
  it("returns Matched only when every necessary condition has evidence or an explicit waiver", () => {
    const result = run(completeRequest, [completeFixture()]).results[0];
    expect(result.status).toBe("confirmed_match");
    expect(result.checks.filter((c) => c.required && c.outcome === "pending")).toEqual([]);
    expect(check(result, "stock").outcome).toBe("pending"); // Separate, non-required caveat stays visible.
  });
  it.each(["inputPhases", "outputPhases"] as const)("excludes known incompatible %s", (field) => {
    const product = completeFixture();
    if (product.specifications[field].status === "verified_official") product.specifications[field].value = 3;
    expect(run(completeRequest, [product]).results[0].status).toBe("excluded");
  });
  it("excludes known incompatible input voltage", () => {
    const result = run({ ...completeRequest, inputVoltageV: 120 }, [completeFixture()]).results[0];
    expect(check(result, "input_voltage").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("excludes known incompatible output voltage", () => {
    const result = run({ ...completeRequest, outputVoltageV: 120 }, [completeFixture()]).results[0];
    expect(check(result, "output_voltage").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("requires exact runtime load, battery configuration and applicable conditions", () => {
    const product = completeFixture();
    for (const changed of [{ loadW: 801 }, { batteryConfiguration: "another battery" }, { runtimeConditions: null }]) {
      const result = run({ ...completeRequest, ...changed }, [product]).results[0];
      expect(check(result, "runtime").outcome).toBe("pending");
      expect(result.status).toBe("pending_verification");
    }
  });
  it("uses manufacturer runtime at actual load, not the margin-adjusted capacity", () => {
    const result = run(completeRequest, [completeFixture()]).results[0];
    expect(check(result, "runtime").outcome).toBe("passed");
    expect(check(result, "runtime").reason).toContain("800 W");
  });
  it("excludes an insufficient documented runtime", () => {
    const result = run({ ...completeRequest, runtimeMinutes: 30 }, [completeFixture()]).results[0];
    expect(check(result, "runtime").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("lets the customer explicitly waive a minimum runtime without claiming endurance", () => {
    expect(check(bySku("SMT1500I", { ...request, runtimeMinutes: 0 }), "runtime").outcome).toBe("not_required");
  });
  it("treats unknown immediate stock as a blocking condition", () => {
    const result = run({ ...completeRequest, requireInStock: true }, [completeFixture()]).results[0];
    expect(result.status).toBe("pending_verification");
  });
  it("excludes a known discontinued product", () => {
    const product = completeFixture();
    if (product.commercial.lifecycleChile.status === "verified_official") product.commercial.lifecycleChile.value = "discontinued";
    expect(run(completeRequest, [product]).results[0].status).toBe("excluded");
  });
  it("excludes insufficient verified stock when immediate stock is required", () => {
    const product = completeFixture();
    product.commercial.stock = { status: "verified_official", value: 0, sourceId: product.sources[0].id, locator: "SYNTHETIC TEST ONLY", note: "Synthetic test stock." };
    expect(run({ ...completeRequest, requireInStock: true }, [product]).results[0].status).toBe("excluded");
  });
  it("excludes a confirmed redundancy conflict", () => {
    const product = completeFixture();
    product.specifications.redundancy = { status: "verified_official", value: "No", sourceId: product.sources[0].id, locator: "SYNTHETIC TEST ONLY", note: "Synthetic test redundancy." };
    const result = run({ ...completeRequest, redundancy: "n_plus_one" }, [product]).results[0];
    expect(check(result, "redundancy").outcome).toBe("failed");
    expect(result.status).toBe("excluded");
  });
  it("excludes an over-budget documented base price but does not invent an inclusive quote", () => {
    const product = completeFixture();
    product.commercial.price = { status: "verified_official", value: { amount: 2000, currency: "USD" }, sourceId: product.sources[0].id, locator: "SYNTHETIC TEST ONLY", note: "Synthetic test price." };
    const under = run({ ...completeRequest, budget: { kind: "limit", amount: 1000, currency: "USD" } }, [product]).results[0];
    expect(check(under, "budget").outcome).toBe("failed");
    expect(under.status).toBe("excluded");
    const within = run({ ...completeRequest, budget: { kind: "limit", amount: 3000, currency: "USD" } }, [product]).results[0];
    expect(check(within, "budget").outcome).toBe("pending");
    const otherCurrency = run({ ...completeRequest, budget: { kind: "limit", amount: 3000, currency: "CLP" } }, [product]).results[0];
    expect(check(otherCurrency, "budget").outcome).toBe("pending");
  });
  it("ranks Matched before Pending Verification", () => {
    const report = run(completeRequest, [products[0], completeFixture()]);
    expect(report.results.map((r) => r.status)).toEqual(["confirmed_match", "pending_verification"]);
  });
});

describe("invalid inputs and manual input boundary", () => {
  it.each([
    { loadW: -1 }, { loadW: 0 }, { loadW: NaN }, { loadW: Infinity }, { loadW: null },
    { loadVA: -1 }, { loadVA: 500 }, { powerFactor: 0 }, { powerFactor: 1.1 },
    { runtimeMinutes: -1 }, { inputVoltageV: 0 }, { outputVoltageV: -230 }, { phases: 2 },
    { marginPercent: -1 }, { marginPercent: 101 }, { application: " " }, { country: "" },
    { budget: { kind: "limit", amount: -1, currency: "CLP" } },
  ])("rejects illegal or missing values: %j", (changed) => {
    expect(selectProducts(products, { ...request, ...changed }).ok).toBe(false);
  });
  it("rejects missing required fields instead of producing matches", () => {
    expect(selectProducts(products, {}).ok).toBe(false);
    expect(selectProducts(products, null).ok).toBe(false);
  });
  it("rejects inconsistent W/VA/PF measurements", () => {
    expect(selectProducts(products, { ...request, powerFactor: 0.5 }).ok).toBe(false);
  });
  it("rejects unrecognized constraints rather than silently ignoring them", () => {
    expect(selectProducts(products, { ...request, unsupportedHardConstraint: "must be certified" }).ok).toBe(false);
  });
  it("preserves empty optional numbers as null", () => {
    const input = draftToInput({ ...emptyDraft, country: "CL", application: "Network", loadW: "800" });
    expect(input.loadVA).toBeNull();
    expect(input.runtimeMinutes).toBeNull();
    expect(input.powerFactor).toBeNull();
    expect(requirementsSchema.parse(input).loadW).toBe(800);
  });
  it("keeps malformed input invalid and flags empty hard fields", () => {
    expect(selectProducts(products, draftToInput({ ...emptyDraft, loadW: "hello" })).ok).toBe(false);
    expect(selectProducts(products, draftToInput(emptyDraft)).ok).toBe(false);
  });
  it("requires an explicit currency when a budget ceiling is entered", () => {
    const draft = { ...selectionDemos[0].draft, budgetMode: "limit", budgetAmount: "1000000", budgetCurrency: "" };
    expect(selectProducts(products, draftToInput(draft)).ok).toBe(false);
    expect(selectProducts(products, draftToInput({ ...draft, budgetCurrency: "CLP" })).ok).toBe(true);
  });
  it("rejects broken product evidence at the engine boundary", () => {
    const broken = structuredClone(products);
    broken[0].specifications.ratedW.sourceId = "missing";
    expect(selectProducts(broken, request).ok).toBe(false);
  });
  it("rejects malformed URLs without throwing outside validation", () => {
    const broken = structuredClone(products);
    broken[0].sources[0].url = "not a URL";
    expect(selectProducts(broken, request).ok).toBe(false);
  });
  it("rejects inverted voltage ranges and ambiguous duplicate runtime points", () => {
    const inverted = completeFixture();
    if (inverted.specifications.inputVoltageRangeV.status === "verified_official") inverted.specifications.inputVoltageRangeV.value = { min: 250, max: 220 };
    expect(selectProducts([inverted], completeRequest).ok).toBe(false);
    const duplicate = completeFixture();
    if (duplicate.specifications.runtimeCurve.status === "verified_official") duplicate.specifications.runtimeCurve.value.points.push({ loadW: 800, minutes: 1 });
    expect(selectProducts([duplicate], completeRequest).ok).toBe(false);
  });
  it("all demo inquiries use real partial product records and produce the documented outcomes", () => {
    for (const demo of selectionDemos) {
      const report = run(draftToInput(demo.draft));
      expect(report.results.every((r) => r.product.recordStatus === "partially_verified")).toBe(true);
      expect(report.results.some((r) => r.status === "confirmed_match")).toBe(false);
      if (demo.id === "overload") expect(report.results.every((r) => r.status === "excluded")).toBe(true);
      if (["online", "va-limit", "hard-margin"].includes(demo.id)) expect(report.results.find((r) => r.product.sku === "SMT1500I")?.status).toBe("excluded");
    }
  });
});
