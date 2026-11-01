/** Opt-in local Live extraction smoke test. Never imported by the app or automatic checks. */
export const inquiry = "Hola, somos una empresa distribuidora de equipos industriales en Santiago de Chile. Buscamos un sistema UPS online para proteger nuestros equipos críticos. La carga estimada es de 1800 W y necesitamos al menos 15 minutos de autonomía. Preferimos una solución compacta y confiable. ¿Podrían recomendarnos un modelo adecuado y enviarnos una cotización para 5 unidades?";
const args = process.argv.slice(2);
async function main() {
  if (args.some((arg) => !["--dry-run", "--execute-paid"].includes(arg)) || args.length > 1) throw new Error("invalid_arguments");
  if (!args.includes("--execute-paid")) {
    console.log("DRY RUN: no HTTP or provider calls. Optional execution requires --execute-paid AND ALLOW_PAID_SMOKE_TEST=yes. One extraction POST maximum; no retries, no automatic confirmation, no email sending.");
    return;
  }
  if (process.env.ALLOW_PAID_SMOKE_TEST !== "yes") throw new Error("paid_execution_not_authorized");
  const target = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000");
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("loopback_target_required");
  const fetchJson = async (path, body) => {
    const response = await fetch(new URL(path, target), { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(30000), headers: body ? { "Content-Type": "application/json", Origin: target.origin } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error("local_endpoint_failed");
    return response.json();
  };
  const config = await fetchJson("/api/parse");
  if (config.provider !== (process.env.SMOKE_PROVIDER || "deepseek")) throw new Error("unexpected_provider");
  if (config.liveAvailable !== true) throw new Error("live_not_configured");
  const output = await fetchJson("/api/parse", { inquiry, mode: "live", dataPolicy: "synthetic_or_anonymized" });
  const r = output.extraction?.requirements;
  const evidence = output.extraction?.evidence;
  if (!["openai", "deepseek"].includes(output.provider) || output.extraction?.language !== "es" || r?.loadW !== 1800 || r?.quantity !== 5 || r?.country !== "CL" || r?.runtimeMinutes !== 15 || r?.topology !== "double_conversion_online" || [r?.loadVA, r?.powerFactor, r?.inputVoltageV, r?.outputVoltageV, r?.phases].some((v) => v !== null) || !Array.isArray(evidence) || !evidence.every((e) => typeof e.quote === "string" && inquiry.includes(e.quote))) throw new Error("smoke_expectations_failed");
  // Only aggregate counters; never print source text, response payload, model errors or secrets.
  const u = output.usage;
  const usage = u && [u.inputTokens, u.outputTokens].every((v) => Number.isInteger(v) && v >= 0) ? u : null;
  console.log(JSON.stringify({ check: "live_extraction", passed: true, paidPosts: 1, usage, telemetry: output.telemetry ?? null, humanConfirmationRequired: true, emailTested: false }));
}
main().catch(() => { console.error("Smoke test stopped. Check authorization, loopback server/configuration, provider account and extraction expectations manually. Sensitive error details suppressed; do not retry automatically."); process.exitCode = 1; });
