import { mailFacts, type EmailLanguage, type GoodReport } from "./mail";
import { customerContext, customerTextLine } from "./customer-text";

/** A deterministic customer-facing projection. No LLM call, new product facts or changed statuses. */
export function renderCustomerMail(report: GoodReport, language: EmailLanguage) {
  const es = language === "es";
  const req = report.requirements;
  const facts = mailFacts(report, language);
  const fact = (id: string) => facts.find((f) => f.id === id)?.text;
  const sections: string[] = [es ? "Estimado equipo:" : "Dear team,", es ? "Gracias por su consulta. Compartimos nuestra evaluación preliminar:" : "Thank you for your inquiry. Here is our preliminary assessment:"];
  sections.push(fact("understanding")!);
  sections.push(customerContext(req, language));
  const matched = report.results.filter((r) => r.status === "confirmed_match");
  const pending = report.results.filter((r) => r.status === "pending_verification");
  const excluded = report.results.filter((r) => r.status === "excluded");
  if (matched.length) sections.push(es ? `Cumplen las condiciones evaluadas: ${matched.map((r) => r.product.sku).join(" / ")}; sujetos a revisión final y condiciones comerciales.` : `Meet the evaluated conditions: ${matched.map((r) => r.product.sku).join(" / ")}; subject to final review and commercial conditions.`);
  else sections.push(es ? "No hay una coincidencia completamente confirmada; no podemos recomendar un modelo definitivo ni emitir una cotización firme todavía." : "There is no confirmed match; we cannot yet recommend a definitive model or provide a firm quotation.");
  if (pending.length) sections.push(es ? `Para continuar evaluando: ${pending.map((r) => r.product.sku).join(" / ")}, pendientes de verificación técnica.` : `For further evaluation: ${pending.map((r) => r.product.sku).join(" / ")}, pending technical verification.`);
  // Preserve every known hard conflict, without repeating rated specs or the full evidence audit.
  if (excluded.length) sections.push(excluded.map((r) => fact(`${r.product.sku}:conflicts`)!).join(" "));
  if (report.results.every((r) => r.status === "excluded")) sections.push(es ? "Ningún modelo del catálogo cumple los requisitos duros conocidos; debemos revisar los conflictos o ampliar el catálogo." : "No catalog model meets the known hard requirements; review the conflicts or expand the catalog.");
  const questions: string[] = [];
  const load: string[] = [];
  if (fact("load_allocation")) load.push(es ? `¿Los ${req.loadW} W corresponden a cada UPS o al conjunto de ${req.quantity} unidades?` : `Is ${req.loadW} W per UPS or the total across ${req.quantity} units?`);
  if (fact("question:capacity_va")) load.push(es ? "¿Cuál es la carga en VA o el factor de potencia medido?" : "What is the load in VA or the measured power factor?");
  if (fact("question:runtime")) load.push(es ? "¿Cuántos minutos de autonomía necesitan?" : "How many minutes of runtime are required?");
  if (load.length) questions.push(load.join(" "));
  if (fact("question:electrical")) questions.push(es ? "¿Qué tensiones de entrada/salida, fases y frecuencia necesitan?" : "What input/output voltages, phases and frequency are required?");
  const site: string[] = [];
  if (fact("question:installation")) site.push(es ? "instalación y dimensiones/criterios de los requisitos adicionales" : "installation and dimensions/criteria for additional requirements");
  if (fact("question:redundancy")) site.push(es ? "necesidad de redundancia" : "redundancy requirements");
  if (fact("question:budget")) site.push(es ? "presupuesto y moneda" : "budget and currency");
  if (fact("question:delivery")) site.push(es ? "cantidad y destino pendientes" : "missing quantity and destination");
  if (site.length) questions.push(es ? `Por favor, confirmen ${site.join("; ")}.` : `Please confirm ${site.join("; ")}.`);
  if (questions.length) sections.push((es ? "Para avanzar, por favor confirmen:" : "To proceed, please confirm:") + "\n" + questions.map((q) => `• ${q}`).join("\n"));
  if (req.otherConstraints.length) sections.push((es ? "Requisitos adicionales indicados (sin confirmar cumplimiento):\n" : "Additional stated requirements (compliance unconfirmed):\n") + req.otherConstraints.map(c => customerTextLine(c, "constraint", language)).join("\n"));
  // Summarize ALL required pending checks; advisory margin is not misrepresented as a hard condition.
  const ids = [...new Set(report.results.filter((r) => r.status !== "excluded").flatMap((r) => r.checks.filter((c) => c.required && c.outcome === "pending").map((c) => c.id)))];
  const groups = [
    { ids: ["capacity_w", "capacity_va"], en: "per-UPS load and capacity", es: "carga por UPS y capacidad" },
    { ids: ["input_voltage", "output_voltage", "inputPhases", "outputPhases", "frequency", "topology"], en: "electrical compatibility", es: "compatibilidad eléctrica" },
    { ids: ["mounting"], en: "installation and accessories", es: "instalación y accesorios" },
    { ids: ["runtime"], en: "runtime at the applicable load and battery configuration", es: "autonomía con la carga y baterías aplicables" },
    { ids: ["redundancy"], en: "redundancy architecture", es: "arquitectura redundante" },
    { ids: ["market", "budget", "stock"], en: "local sale, quotation and supply conditions", es: "comercialización, cotización y suministro" },
    { ids: ["margin"], en: "required capacity margin", es: "margen de capacidad exigido" },
  ];
  const labels = groups.filter((g) => g.ids.some((id) => ids.includes(id))).map((g) => es ? g.es : g.en);
  if (ids.some((id) => id.startsWith("other_"))) labels.push(es ? "requisitos adicionales" : "additional requirements");
  const covered = new Set(groups.flatMap((g) => g.ids));
  // Future rules must not disappear from the summary if a new required ID is introduced.
  for (const id of ids.filter((id) => !covered.has(id) && !id.startsWith("other_"))) {
    const check = report.results.flatMap((r) => r.checks).find((c) => c.id === id)!;
    labels.push(check.label);
  }
  if (labels.length) sections.push((es ? "Verificaremos: " : "We will verify: ") + labels.join("; ") + ".");
  sections.push(fact("commercial_caveat")!);
  sections.push(es ? "Con sus confirmaciones revisaremos los datos del fabricante y solicitaremos una cotización completa con el canal autorizado.\nSaludos cordiales,\nEquipo de ventas técnicas" : "With your confirmation, we will review manufacturer data and request a complete quotation from an authorized channel.\nKind regards,\nTechnical sales team");
  sections.push(es ? "Demostración independiente; no es una herramienta oficial de Schneider Electric." : "Independent demo; not an official Schneider Electric tool.");
  return { subject: es ? "Su consulta de UPS — evaluación preliminar y próximos pasos" : "Your UPS inquiry — preliminary assessment and next steps", body: sections.join("\n\n") };
}
