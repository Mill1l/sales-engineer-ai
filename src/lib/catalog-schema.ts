import { z } from "zod";

const officialUrl = z.url().refine((url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "se.com" || parsed.hostname.endsWith(".se.com"));
  } catch { return false; }
}, "An HTTPS Schneider Electric official source is required");

export function evidence<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion("status", [
    z.object({
      status: z.literal("verified_official"),
      value: valueSchema,
      sourceId: z.string().min(1),
      locator: z.string().min(1),
      note: z.string().min(1),
    }).strict(),
    z.object({
      status: z.literal("pending_manual_verification"),
      value: z.null(),
      sourceId: z.null(),
      locator: z.null(),
      note: z.string().min(1),
    }).strict(),
  ]);
}

const positive = z.number().positive().finite();
export const productSchema = z.object({
  sku: z.enum(["SMT1500I", "SRT2200XLI", "SRT3000XLI"]),
  name: z.string().min(1),
  recordStatus: z.literal("partially_verified"),
  market: z.literal("CL"),
  verifiedOn: z.iso.date(),
  sourceUrl: officialUrl,
  sources: z.array(z.object({
    id: z.string().min(1),
    url: officialUrl,
    title: z.string().min(1),
    verifiedOn: z.iso.date(),
    access: z.literal("official_page_text_read"),
    limitation: z.string().min(1),
  }).strict()).min(1),
  specifications: z.object({
    ratedW: evidence(positive),
    ratedVA: evidence(positive),
    topology: evidence(z.enum(["line_interactive", "double_conversion_online"])),
    nominalVoltageV: evidence(positive),
    inputVoltageRangeV: evidence(z.object({ min: positive, max: positive }).strict().refine((range) => range.min <= range.max, "Input voltage minimum must not exceed maximum")),
    outputVoltagesV: evidence(z.array(positive).min(1)),
    inputPhases: evidence(z.union([z.literal(1), z.literal(3)])),
    outputPhases: evidence(z.union([z.literal(1), z.literal(3)])),
    frequencyHz: evidence(z.array(positive).min(1)),
    mounting: evidence(z.array(z.enum(["tower", "rack_with_optional_kit"])).min(1)),
    rackKitIncluded: evidence(z.boolean()),
    outputConnectors: evidence(z.string().min(1)),
    redundancy: evidence(z.string().min(1)),
    runtimeCurve: evidence(z.object({
      batteryConfiguration: z.string().min(1),
      conditions: z.string().min(1),
      points: z.array(z.object({ loadW: positive, minutes: positive }).strict()).min(1).refine((points) => new Set(points.map((point) => point.loadW)).size === points.length, "Duplicate runtime loads are ambiguous"),
    }).strict()),
  }).strict(),
  commercial: z.object({
    lifecycleChile: evidence(z.enum(["active", "discontinued", "end_of_service"])),
    stock: evidence(z.number().int().nonnegative()),
    price: evidence(z.object({ amount: positive, currency: z.string().length(3) }).strict()),
  }).strict(),
}).strict().superRefine((product, context) => {
  const ids = new Set<string>();
  for (const [index, source] of product.sources.entries()) {
    if (ids.has(source.id)) context.addIssue({ code: "custom", message: "Duplicate source ID", path: ["sources", index, "id"] });
    ids.add(source.id);
    if (source.verifiedOn !== product.verifiedOn) context.addIssue({ code: "custom", message: "Source date must match this record revision", path: ["sources", index, "verifiedOn"] });
  }
  if (!product.sources.some((source) => source.url === product.sourceUrl)) context.addIssue({ code: "custom", message: "Primary source URL must be in sources", path: ["sourceUrl"] });
  for (const group of ["specifications", "commercial"] as const) {
    for (const [field, fact] of Object.entries(product[group])) {
      if (fact.status === "verified_official" && !ids.has(fact.sourceId)) {
        context.addIssue({ code: "custom", message: "Unknown source reference", path: [group, field, "sourceId"] });
      }
    }
  }
});

export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  checkedOn: z.iso.date(),
  disclaimer: z.string().min(1),
  products: z.array(productSchema).length(3),
}).strict().superRefine((catalog, context) => {
  if (new Set(catalog.products.map((product) => product.sku)).size !== 3) {
    context.addIssue({ code: "custom", message: "Each of the three scoped SKUs must appear exactly once", path: ["products"] });
  }
  for (const [index, product] of catalog.products.entries()) {
    if (product.verifiedOn !== catalog.checkedOn) context.addIssue({ code: "custom", message: "Catalog revision date mismatch", path: ["products", index, "verifiedOn"] });
  }
});

export type Product = z.infer<typeof productSchema>;
export type ProductFact = Product["specifications"][keyof Product["specifications"]];
