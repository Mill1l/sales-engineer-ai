import { describe, expect, it } from "vitest";
import data from "../src/data/products.json";
import { catalogSchema } from "../src/lib/catalog-schema";

describe("evidence catalog integrity", () => {
  it("loads exactly the three scoped real SKUs", () => {
    const catalog = catalogSchema.parse(data);
    expect(catalog.products.map((product) => product.sku).sort()).toEqual(["SMT1500I", "SRT2200XLI", "SRT3000XLI"]);
  });

  it("rejects duplicate SKUs even when there are still three records", () => {
    const changed = structuredClone(data);
    changed.products[1] = changed.products[0];
    expect(catalogSchema.safeParse(changed).success).toBe(false);
  });

  it("rejects verified facts with dangling source references", () => {
    const changed = structuredClone(data);
    changed.products[0].specifications.ratedW.sourceId = "missing-source";
    expect(catalogSchema.safeParse(changed).success).toBe(false);
  });

  it("rejects an unverified value disguised as a pending field", () => {
    const changed = structuredClone(data) as unknown as { products: { commercial: { stock: { value: unknown } } }[] };
    changed.products[0].commercial.stock.value = 42;
    expect(catalogSchema.safeParse(changed).success).toBe(false);
  });

  it("requires a verified value and a nonempty evidence locator", () => {
    const changed = structuredClone(data);
    changed.products[0].specifications.ratedW.locator = "";
    expect(catalogSchema.safeParse(changed).success).toBe(false);
    const missing = structuredClone(data) as unknown as { products: { specifications: { ratedW: { value: unknown } } }[] };
    missing.products[0].specifications.ratedW.value = null;
    expect(catalogSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects third-party and deceptive lookalike source URLs", () => {
    for (const url of ["https://se.com.attacker.example/product", "http://www.se.com/cl/es/product/SMT1500I/"]) {
      const changed = structuredClone(data);
      changed.products[0].sources[0].url = url;
      expect(catalogSchema.safeParse(changed).success).toBe(false);
    }
  });

  it("requires consistent source and record verification dates", () => {
    const changed = structuredClone(data);
    changed.products[0].sources[0].verifiedOn = "2020-01-01";
    expect(catalogSchema.safeParse(changed).success).toBe(false);
  });

  it("does not silently replace missing engineering and commercial evidence", () => {
    const catalog = catalogSchema.parse(data);
    for (const product of catalog.products) {
      for (const key of ["runtimeCurve", "inputPhases", "outputPhases", "inputVoltageRangeV", "outputVoltagesV", "redundancy"] as const) {
        expect(product.specifications[key].value).toBeNull();
        expect(product.specifications[key].status).toBe("pending_manual_verification");
      }
      expect(product.recordStatus).toBe("partially_verified");
      expect(product.commercial.stock.value).toBeNull();
      expect(product.commercial.price.value).toBeNull();
      expect(product.commercial.lifecycleChile.value).toBeNull();
    }
  });

  it("does not claim that SRT rack conversion kits are included", () => {
    const catalog = catalogSchema.parse(data);
    for (const product of catalog.products.filter((p) => p.sku.startsWith("SRT"))) {
      expect(product.specifications.rackKitIncluded.value).toBe(false);
      expect(product.specifications.mounting.value).toContain("rack_with_optional_kit");
    }
  });

  it("rejects zero and negative power ratings", () => {
    for (const invalid of [0, -100]) {
      const changed = structuredClone(data);
      changed.products[0].specifications.ratedW.value = invalid;
      expect(catalogSchema.safeParse(changed).success).toBe(false);
    }
  });
});
