import { inquiryDemos } from "./demos";
import type { AiProvider } from "./provider";
import { AiFailure } from "./provider";

export const mockProvider: AiProvider = {
  name: "mock",
  async extract(inquiry) {
    const demo = inquiryDemos.find((demo) => demo.inquiry.trim() === inquiry.trim());
    if (!demo) throw new AiFailure("mock_scenario_only");
    return { data: structuredClone(demo.extraction) };
  },
  async compose(facts) { return { data: { opening: "thank_you", closing: "confirm_details", factIds: facts.map((fact) => fact.id) } }; },
};
