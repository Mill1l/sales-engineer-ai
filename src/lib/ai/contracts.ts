import { z } from "zod";
import { requirementsSchema, type Requirements } from "../selection/requirements";
import { emptyDraft, type RequirementDraft } from "../selection/form";

export const MAX_INQUIRY_CHARS = 6000;
const n = z.number().nullable();
const s = z.string().nullable();
export const extractedValuesSchema = z.object({
  country: s, application: s, loadW: n, loadVA: n, powerFactor: n, inputVoltageV: n, outputVoltageV: n,
  phases: z.union([z.literal(1), z.literal(3)]).nullable(), frequencyHz: n,
  topology: z.enum(["any", "line_interactive", "double_conversion_online"]).nullable(),
  runtimeMinutes: n, mounting: z.enum(["tower", "rack"]).nullable(), rackKitAccepted: z.boolean().nullable(),
  budget: z.union([z.object({ kind: z.literal("unconstrained") }).strict(), z.object({ kind: z.literal("limit"), amount: z.number(), currency: z.enum(["CLP", "USD", "EUR", "CNY"]) }).strict()]).nullable(),
  redundancy: z.enum(["not_required", "n_plus_one", "dual_path"]).nullable(), requireInStock: z.boolean().nullable(),
  batteryConfiguration: s, runtimeConditions: s, quantity: n, destination: s,
  otherConstraints: z.array(z.string()),
}).strict();
export type ExtractedValues = z.infer<typeof extractedValuesSchema>;
export const extractionFields = Object.keys(extractedValuesSchema.shape) as [keyof ExtractedValues, ...(keyof ExtractedValues)[]];
export const extractionSchema = z.object({
  language: z.enum(["en", "es", "zh", "unknown"]),
  requirements: extractedValuesSchema,
  evidence: z.array(z.object({ field: z.enum(extractionFields), quote: z.string(), certainty: z.enum(["known", "uncertain"]) }).strict()),
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type ReviewedExtraction = Extraction & { warnings: string[]; missingFields: string[]; validForSelection: boolean };
const dataPolicy = z.literal("synthetic_or_anonymized").optional();
export const parseRequestSchema = z.object({ inquiry: z.string().trim().min(10).max(MAX_INQUIRY_CHARS), mode: z.enum(["mock", "live"]), dataPolicy }).strict();
export const emailRequestSchema = z.object({ requirements: requirementsSchema, confirmed: z.literal(true), language: z.enum(["en", "es"]), mode: z.enum(["mock", "live"]), dataPolicy }).strict();

export const blankExtractedValues = (): ExtractedValues => ({
  country: null, application: null, loadW: null, loadVA: null, powerFactor: null, inputVoltageV: null, outputVoltageV: null,
  phases: null, frequencyHz: null, topology: null, runtimeMinutes: null, mounting: null, rackKitAccepted: null,
  budget: null, redundancy: null, requireInStock: null, batteryConfiguration: null, runtimeConditions: null,
  quantity: null, destination: null, otherConstraints: [],
});

export function extractionToDraft(values: ExtractedValues): RequirementDraft {
  const draft = { ...emptyDraft };
  for (const [field, value] of Object.entries(values)) {
    if (field === "budget" || field === "otherConstraints" || field === "rackKitAccepted" || field === "requireInStock") continue;
    if (field in draft) (draft as Record<string, string | boolean>)[field] = value === null ? "" : String(value);
  }
  draft.rackKitAccepted = values.rackKitAccepted === null ? "" : values.rackKitAccepted ? "yes" : "no";
  draft.requireInStock = values.requireInStock ?? false;
  draft.otherConstraints = values.otherConstraints.join("\n");
  if (values.budget) {
    draft.budgetMode = values.budget.kind;
    if (values.budget.kind === "limit") { draft.budgetAmount = String(values.budget.amount); draft.budgetCurrency = values.budget.currency; }
  }
  return draft;
}

const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Unit checking is independent of the model: no W→VA or assumed PF conversion. */
export function numericEvidence(field: string, quote: string, value: number) {
  const text = normalized(quote);
  if (field === "inputVoltageV" || field === "outputVoltageV") {
    // Bind a voltage to its own direction, not any number in a shared quote.
    const label = field === "inputVoltageV" ? "input|entrada|输入" : "output|salida|输出";
    const pattern = new RegExp(`(?:${label})(?: voltage| tension|电压)?\\s*(?:is|de|为|[:=])?\\s*(-?\\d+(?:[.,]\\d+)?)\\s*(kv|v|伏)(?![a-z])`, "gi");
    const values = [...text.matchAll(pattern)].map((m) => Number(m[1].replace(",", ".")) * (m[2] === "kv" ? 1000 : 1));
    return new Set(values).size === 1 && values[0] === value;
  }
  const patterns: Record<string, RegExp> = {
    loadW: /(-?\d+(?:[.,]\d+)?)\s*(kw|w|千瓦|瓦)(?![a-z])/gi,
    loadVA: /(-?\d+(?:[.,]\d+)?)\s*(kva|va|千伏安|伏安)(?![a-z])/gi,
    inputVoltageV: /(\d+(?:[.,]\d+)?)\s*(kv|v|伏)(?![a-z])/gi,
    outputVoltageV: /(\d+(?:[.,]\d+)?)\s*(kv|v|伏)(?![a-z])/gi,
    frequencyHz: /(-?\d+(?:[.,]\d+)?)\s*(hz|赫兹)/gi,
    runtimeMinutes: /(-?\d+(?:[.,]\d+)?)\s*(minutes?|mins?|minutos?|h(?:ours?)?|horas?|小时|分钟)/gi,
    quantity: /(-?\d+)\s*(units?|unidad(?:es)?|台)/gi,
    powerFactor: /(?:pf|power factor|factor de potencia|功率因数)\s*(?:is|de|为|[:=])?\s*(-?\d+(?:[.,]\d+)?)\s*(%)?/gi,
  };
  if (field === "inputVoltageV" && !/input|entrada|输入/.test(text)) return false;
  if (field === "outputVoltageV" && !/output|salida|输出/.test(text)) return false;
  const pattern = patterns[field];
  if (!pattern) return false;
  const values = [...text.matchAll(pattern)].map((match) => {
    let number = Number(match[1].replace(",", "."));
    const unit = match[2] ?? "";
    if (/^k|^千/.test(unit)) number *= 1000;
    if (field === "runtimeMinutes" && /^h|^小时/.test(unit)) number *= 60;
    if (field === "powerFactor" && unit === "%") number /= 100;
    return number;
  });
  // Several different values in the supplied quote are unresolved, not permission to choose one.
  return new Set(values).size === 1 && Math.abs(values[0] - value) < 1e-8;
}

function supportedValue(field: keyof ExtractedValues, value: unknown, quote: string): boolean {
  // Deliberately conservative: negated or alternative categorical evidence needs human review.
  if (["topology", "mounting", "phases", "inputVoltageV", "outputVoltageV", "loadW", "loadVA", "frequencyHz", "runtimeMinutes"].includes(field)
    && /\b(?:not|no|never|without|sin|instead|or|don['’]t|doesn['’]t)\b|不要|不接受|不是|并非|或者|而非/.test(normalized(quote))) return false;
  if (typeof value === "number") {
    if (field === "phases") return value === 1 ? /single.phase|monofasic|单相|1\s*(?:phase|fase|相)/.test(normalized(quote)) : /three.phase|trifasic|三相|3\s*(?:phase|fase|相)/.test(normalized(quote));
    return numericEvidence(field, quote, value);
  }
  if (field === "country") return typeof value === "string" && /^[A-Z]{2}$/.test(value) && (new RegExp(`\\b${value}\\b`, "i").test(quote) || ({ CL: /chile|智利/i, CN: /china|中国/i, US: /united states|美国|estados unidos/i, ES: /spain|espana|españa|西班牙/i }[value]?.test(quote) ?? false));
  if (field === "topology") return value === "double_conversion_online" ? /online|on-line|double.conversion|doble.conversion|在线|双变换/.test(normalized(quote)) : value === "line_interactive" ? /line.interactive|linea.interactiva|互动|交互/.test(normalized(quote)) : /either topology|cualquier topologia|任意拓扑/.test(normalized(quote));
  if (field === "mounting") return value === "rack" ? /rack|机架/.test(quote.toLowerCase()) : /tower|torre|塔式/.test(quote.toLowerCase());
  const text = normalized(quote);
  if (field === "budget" && typeof value === "object" && value) {
    const budget = value as ExtractedValues["budget"];
    if (budget?.kind === "unconstrained") return /no budget (?:limit|ceiling)|sin limite de presupuesto|无预算上限/.test(text);
    return budget?.kind === "limit" && text.includes(budget.currency.toLowerCase()) && [...text.matchAll(/\d+(?:[.,]\d+)?/g)].some((m) => Number(m[0].replace(",", ".")) === budget.amount);
  }
  if (field === "rackKitAccepted") return value === true ? /accept.*(?:rack|kit)|acept.*kit|接受.*套件/.test(text) : /no.*(?:separate|additional).*kit|不接受.*套件/.test(text);
  if (field === "requireInStock") return value === true ? /must.*in stock|immediate stock.*required|stock inmediato|必须.*现货/.test(text) : /no immediate.stock requirement|不要求.*现货/.test(text);
  if (field === "redundancy") return value === "not_required" ? /no redundancy|sin redundancia|无冗余要求/.test(text) : value === "n_plus_one" ? /n\s*\+\s*1/.test(text) : /dual.path|双路/.test(text);
  return typeof value === "string" && quote.includes(value);
}

export function validateExtraction(inquiry: string, raw: unknown): ReviewedExtraction {
  const parsed = extractionSchema.parse(raw);
  const warnings: string[] = [];
  const requirements = { ...parsed.requirements, otherConstraints: [...parsed.requirements.otherConstraints] };
  const acceptedEvidence: Extraction["evidence"] = [];
  for (const field of extractionFields) {
    const value = requirements[field];
    if (value === null || (Array.isArray(value) && value.length === 0)) continue;
    const proofs = parsed.evidence.filter((entry) => entry.field === field && entry.quote.length > 0 && entry.quote.length <= 700 && inquiry.includes(entry.quote) && entry.certainty === "known");
    const supported = field === "otherConstraints" ? (value as string[]).every((constraint) => proofs.some((proof) => proof.quote.includes(constraint))) : proofs.length === 1 && supportedValue(field, value, proofs[0].quote);
    if (!supported) {
      (requirements as Record<string, unknown>)[field] = field === "otherConstraints" ? [] : null;
      warnings.push(`${field}: missing, uncertain or unsupported source evidence; confirm manually.`);
      // Never silently discard an unsupported hard requirement.
      if (field === "otherConstraints" && (value as string[]).length > 0) throw new Error("unsupported_constraints_evidence");
    } else acceptedEvidence.push(...proofs);
  }
  if (/ignore (?:all|previous)|system prompt|mark.*matched|ignora.*instrucciones|忽略.*指令/i.test(inquiry)) warnings.push("Instruction-like content detected. It cannot override the rule engine; review all fields.");
  const selectionInput = { ...requirements, requireInStock: requirements.requireInStock ?? false };
  const validation = requirementsSchema.safeParse(selectionInput);
  const missingFields = extractionFields.filter((field) => requirements[field] === null);
  return { language: parsed.language, requirements, evidence: acceptedEvidence, warnings, missingFields, validForSelection: validation.success };
}

export function inputFromExtraction(values: ExtractedValues): Partial<Requirements> {
  return { ...values, country: values.country ?? undefined, application: values.application ?? undefined, loadW: values.loadW ?? undefined, requireInStock: values.requireInStock ?? false };
}
