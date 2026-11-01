import { z } from "zod";

const positive = z.number({ error: "Enter a valid number." }).finite().positive({ error: "Enter a value greater than zero." });
const optionalPositive = positive.nullable().default(null);
export const requirementsSchema = z.object({
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Enter a two-letter country code (for example CL)."),
  application: z.string().trim().min(1, "Describe the application.").max(500),
  loadW: positive,
  loadVA: optionalPositive,
  powerFactor: positive.max(1).nullable().default(null),
  inputVoltageV: optionalPositive,
  outputVoltageV: optionalPositive,
  phases: z.union([z.literal(1), z.literal(3)]).nullable().default(null),
  topology: z.enum(["any", "line_interactive", "double_conversion_online"]).nullable().default(null),
  runtimeMinutes: z.number().finite().nonnegative().nullable().default(null),
  mounting: z.enum(["tower", "rack"]).nullable().default(null),
  rackKitAccepted: z.boolean().nullable().default(null),
  budget: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("unconstrained") }).strict(),
    z.object({ kind: z.literal("limit"), amount: positive, currency: z.enum(["CLP", "USD", "EUR", "CNY"]) }).strict(),
  ]).nullable().default(null),
  redundancy: z.enum(["not_required", "n_plus_one", "dual_path"]).nullable().default(null),
  requireInStock: z.boolean().default(false),
  marginPercent: z.number().finite().min(0).max(100).default(20),
  marginMode: z.enum(["advisory", "hard"]).default("advisory"),
  batteryConfiguration: z.string().trim().min(1).max(300).nullable().default(null),
  runtimeConditions: z.string().trim().min(1).max(500).nullable().default(null),
  frequencyHz: positive.nullable().default(null),
  quantity: z.number().int().positive().max(10000).nullable().default(null),
  destination: z.string().trim().min(1).max(300).nullable().default(null),
  otherConstraints: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  loadPerUnitConfirmed: z.boolean().default(false),
}).strict().superRefine((req, context) => {
  if (req.loadVA !== null && req.loadW > req.loadVA + 1e-9) {
    context.addIssue({ code: "custom", path: ["loadVA"], message: "VA cannot be lower than W for the same load." });
  }
  if (req.loadVA !== null && req.powerFactor !== null) {
    const impliedW = req.loadVA * req.powerFactor;
    if (Math.abs(impliedW - req.loadW) > req.loadW * 0.02) {
      context.addIssue({ code: "custom", path: ["powerFactor"], message: "W, VA and power factor disagree by more than 2%; confirm the measurements." });
    }
  }
  if (req.loadVA === null && req.powerFactor !== null && !Number.isFinite(req.loadW / req.powerFactor)) {
    context.addIssue({ code: "custom", path: ["powerFactor"], message: "Derived VA is outside the supported numeric range." });
  }
  if (!Number.isFinite(req.loadW * (1 + req.marginPercent / 100)) || (req.loadVA !== null && !Number.isFinite(req.loadVA * (1 + req.marginPercent / 100)))) {
    context.addIssue({ code: "custom", path: ["marginPercent"], message: "Capacity target is outside the supported numeric range." });
  }
});

export type Requirements = z.infer<typeof requirementsSchema>;
export function normalizeRequirements(req: Requirements) {
  const derivedVA = req.loadVA === null && req.powerFactor !== null;
  return {
    ...req,
    effectiveVA: req.loadVA ?? (req.powerFactor !== null ? req.loadW / req.powerFactor : null),
    vaOrigin: derivedVA ? "derived" as const : req.loadVA !== null ? "provided" as const : "unknown" as const,
    derivation: derivedVA ? `VA = W / PF = ${req.loadW} / ${req.powerFactor} = ${req.loadW / req.powerFactor!} VA` : null,
  };
}
export type NormalizedRequirements = ReturnType<typeof normalizeRequirements>;
