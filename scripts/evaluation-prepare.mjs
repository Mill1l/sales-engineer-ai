import { readFile } from "node:fs/promises";
// Preparation ONLY. There is no fetch, SDK, credential access or paid execution branch.
const suite = JSON.parse(await readFile(new URL("../tests/fixtures/phase-4b-evaluation.json", import.meta.url), "utf8"));
if (suite.cases.length !== 15) throw new Error("evaluation_manifest_must_have_15_cases");
console.log(JSON.stringify({ mode: "dry-run", provider: "deepseek", model: "deepseek-flash", notice: suite.notice, cases: suite.cases.map(({ id, language }) => ({ id, language, liveStatus: "not_run" })), paidCalls: 0 }, null, 2));
