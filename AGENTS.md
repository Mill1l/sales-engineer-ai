# Development instructions

- Read GOALS.md and PLAN.md before changing scope. Phase 3 is complete. The user authorized Phase 4B DeepSeek adapter, compatibility tests and a 15-case evaluation preparation. Stop after preparation; default Mock/dry-run, no paid API calls or public deployment.
- Use Next.js App Router, TypeScript strict mode, Tailwind CSS and Zod. Keep deterministic selection logic independent from UI/AI in Phase 2.
- Product facts belong in src/data/products.json. Never silently add guessed values or unverified alternative SKUs.
- A verified field needs an official source, verification date and locator. Missing or unclear values remain null/pending_manual_verification.
- A product page is not proof of availability, stock, price or a complete technical match. Keep commercial status separate.
- Do not extrapolate runtime from battery energy. Do not use product-family selector links as SKU facts.
- All external/manual/AI requirements must pass requirementsSchema and the selectProducts boundary. Empty fields stay unknown; unknown unsupported fields must not be silently dropped.
- Keep advisory margin separate from rated capacity and explicit hard-margin policy. Keep customer questions separate from manufacturer verification questions.
- Synthetic complete-evidence products belong only in tests, clearly labeled; demos use fictional inquiries against the unchanged real catalog.
- Keep secrets server-side, ignored by Git; only placeholders in .env.example. Do not log inquiries or secrets.
- Use server-only provider adapters. OpenAI uses strict Structured Outputs; DeepSeek uses official JSON Output plus strict local Zod and evidence/fact validation. Extraction quotes must occur in the source; unknown/uncertain fields stay null. Review-stage nullable DTOs must pass requirementsSchema before selection or email.
- Recompute email facts from the server catalog with selectProducts; do not accept client statuses or arbitrary generated claims. Mock mode must remain visibly distinct from Live AI.
- Preserve the exact six demo inquiries and Chile Distributor Inquiry entry. Multi-unit load is not divided or assumed per unit without customer confirmation.
- Do not add agent delegation by default. Do not add unrelated features or publish this local phase without scope justification.
- After each phase run pnpm test, pnpm run lint, pnpm run typecheck and pnpm run build; document actual results and limits in PLAN.md/README.md.
