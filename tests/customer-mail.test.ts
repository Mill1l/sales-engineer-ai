import { describe, expect, it, vi } from "vitest";
import data from "../src/data/products.json";
import { catalogSchema } from "../src/lib/catalog-schema";
import { renderCustomerMail } from "../src/lib/ai/customer-mail";
import { generateEmail } from "../src/lib/ai/service";
import { mockProvider } from "../src/lib/ai/mock-provider";
import { inquiryDemos } from "../src/lib/ai/demos";
import { inputFromExtraction, validateExtraction } from "../src/lib/ai/contracts";
import { selectProducts } from "../src/lib/selection/engine";
import { requirementsSchema } from "../src/lib/selection/requirements";
const products = catalogSchema.parse(data).products;
const req = () => requirementsSchema.parse(inputFromExtraction(validateExtraction(inquiryDemos[0].inquiry, inquiryDemos[0].extraction).requirements));
function report(input = req()) { const result = selectProducts(products, input); if (!result.ok) throw new Error("invalid fixture"); return result; }

describe("customer-facing concise email, same deterministic evidence", () => {
 it.each(["en", "es"] as const)("retains requirements, candidate states, load allocation and commercial caveats in %s", (language) => {
  const brief = renderCustomerMail(report(), language);
  expect(brief.body).toContain("1800 W"); expect(brief.body).toContain("15"); expect(brief.body).toContain("5");
  expect(brief.body).toContain("SRT2200XLI / SRT3000XLI"); expect(brief.body).toContain("SMT1500I");
  expect(brief.body).toMatch(/No hay una coincidencia completamente confirmada|There is no confirmed match/);
  expect(brief.body).toMatch(/cada UPS o al conjunto|per UPS or the total/);
  expect(brief.body).toMatch(/NO están confirmados|NOT confirmed/);
  expect(brief.body).toContain("compacta y confiable");
  expect(brief.body).toMatch(/presupuesto y moneda|budget and currency/);
  expect(brief.body).not.toMatch(/tenemos 5 unidades|guaranteed runtime|confirmed stock/);
 });
 it("keeps the Chile Spanish email within 400 words with three focused question bullets", () => {
  const mail = renderCustomerMail(report(), "es");
  expect(mail.body.split(/\s+/).length).toBeLessThanOrEqual(400);
  expect(mail.body.split("\n").filter((line) => line.startsWith("• "))).toHaveLength(3);
 });
 it.each(inquiryDemos)("keeps $title auditable in detailed and concise versions, using one composition call", async (demo) => {
  const requirements = requirementsSchema.parse(inputFromExtraction(validateExtraction(demo.inquiry, demo.extraction).requirements));
  const compose = vi.fn(mockProvider.compose);
  const mail = await generateEmail({ requirements, language: demo.extraction.language === "es" ? "es" : "en", confirmed: true, mode: "mock" }, products, { ...mockProvider, compose });
  expect(compose).toHaveBeenCalledTimes(1);
  expect(mail.customerEmail).toBeDefined(); expect(mail.customerEmail.body.length).toBeLessThan(mail.body.length);
  for (const fact of mail.facts) expect(mail.body).toContain(fact.text);
  for (const product of products) expect(mail.body).toContain(product.sourceUrl);
 });
 it("does not force a recommendation when all products are excluded", () => {
  const input = { ...req(), quantity: 1, loadW: 4000, loadVA: 5000 };
  const mail = renderCustomerMail(report(input), "en");
  expect(mail.body).toContain("No catalog model meets the known hard requirements");
  expect(mail.body).not.toContain("For further evaluation:");
  expect(mail.body).toContain("4000 W"); expect(mail.body).not.toContain("1800 W");
 });
 it("updates load, quantity, runtime and language from confirmed edits", () => {
  const input = { ...req(), quantity: 1, loadW: 800, loadVA: 1000, runtimeMinutes: 30 };
  const mail = renderCustomerMail(report(input), "en");
  expect(mail.body).toContain("800 W"); expect(mail.body).toContain("30 minutes"); expect(mail.body).toContain("quantity: 1");
  expect(mail.body).not.toContain("1800 W"); expect(mail.body).not.toContain("across 5 units");
 });
 it("keeps advisory margin out of mandatory verification while retaining explicit hard margin", () => {
  const advisory = renderCustomerMail(report(), "en").body;
  expect(advisory).not.toContain("required capacity margin");
  const hard = renderCustomerMail(report({ ...req(), marginMode: "hard" }), "en").body;
  expect(hard).toContain("required capacity margin");
 });
 it("retains every extra requirement rather than truncating customer constraints", () => {
  const input = { ...req(), otherConstraints: ["IEC certificate required", "tropical installation", "custom connector"] };
  const mail = renderCustomerMail(report(input), "en");
  for (const text of input.otherConstraints) expect(mail.body).toContain(text);
  expect(mail.body).toContain("compliance unconfirmed");
 });
 it("does not silently hide future required pending rules", () => {
  const input = report();
  input.results[0].checks.push({ id: "future_safety", label: "New safety verification", outcome: "pending", required: true, reason: "Unknown", evidence: [] });
  expect(renderCustomerMail(input, "en").body).toContain("New safety verification");
 });
});
