import { z } from "zod";
import type { SelectionReport } from "../selection/engine";
import { customerContext, customerTextLine } from "./customer-text";

export type GoodReport = Extract<SelectionReport, { ok: true }>;
export type EmailLanguage = "en" | "es";
export type MailFact = { id: string; text: string; kind: "requirements" | "result" | "verification" | "question" | "source" | "next" };
export const mailPlanSchema = z.object({ opening: z.enum(["thank_you", "technical_review"]), closing: z.enum(["confirm_details", "joint_review"]), factIds: z.array(z.string()).min(1) }).strict();
export type MailPlan = z.infer<typeof mailPlanSchema>;

const esLabels: Record<string, string> = {
  capacity_w: "potencia activa W", capacity_va: "potencia aparente VA o factor de potencia", margin: "margen de capacidad configurado",
  topology: "topología UPS", input_voltage: "tensión de entrada y rango admitido", output_voltage: "tensión de salida",
  inputPhases: "fases de entrada", outputPhases: "fases de salida", mounting: "instalación y accesorios de rack",
  runtime: "autonomía con la carga, configuración de baterías y condiciones aplicables", redundancy: "arquitectura de redundancia",
  market: "comercialización actual en el país de destino", budget: "presupuesto, moneda y alcance completo de la cotización",
  stock: "existencias y plazo de entrega", frequency: "frecuencia de entrada/salida",
};
export function mailFacts(report: GoodReport, language: EmailLanguage): MailFact[] {
  const es = language === "es";
  const req = report.requirements;
  const facts: MailFact[] = [];
  const add = (id: string, kind: MailFact["kind"], text: string) => facts.push({ id, kind, text });
  add("understanding", "requirements", es ? `Entendemos que la solicitud indica ${req.loadW} W${req.effectiveVA === null ? "; VA y/o factor de potencia pendientes" : ` y ${Number(req.effectiveVA.toFixed(3))} VA (${req.vaOrigin === "derived" ? "calculados como W/PF" : "indicados"})`}${req.runtimeMinutes === null ? "; autonomía solicitada pendiente" : `; autonomía solicitada: ${req.runtimeMinutes} minutos`}. Estos son requisitos, no prestaciones confirmadas del producto.` : `We understand the request specifies ${req.loadW} W${req.effectiveVA === null ? "; VA and/or power factor still to confirm" : ` and ${Number(req.effectiveVA.toFixed(3))} VA (${req.vaOrigin})`}${req.runtimeMinutes === null ? "; requested runtime remains unknown" : `; requested runtime: ${req.runtimeMinutes} minutes`}. These are requirements, not confirmed product performance.`);
  add("context", "requirements", customerContext(req, language));
  req.otherConstraints.forEach((constraint, index) => add(`constraint:${index}`, "verification", (es ? "Requisito del cliente; su cumplimiento requiere verificación independiente:\n" : "Customer requirement; compliance requires separate verification:\n") + customerTextLine(constraint, "constraint", language)));
  const matched = report.results.some((r) => r.status === "confirmed_match");
  const viable = report.results.some((r) => r.status !== "excluded");
  add("overall_status", "result", es ? matched ? "Hay candidatos que cumplen las condiciones evaluadas; quedan sujetos a las salvedades comerciales y a la revisión final de la instalación." : viable ? "No hay una coincidencia completamente confirmada. Los candidatos pendientes se presentan únicamente para continuar la evaluación técnica; todavía no podemos emitir una recomendación definitiva ni una cotización firme." : "Ningún modelo del catálogo cumple los requisitos duros conocidos. Es necesario revisar los conflictos o ampliar el catálogo sin relajar los requisitos automáticamente." : matched ? "Some candidates satisfy the evaluated necessary conditions, subject to separate commercial caveats and final installation review." : viable ? "There is no confirmed match. Pending candidates are only for further technical evaluation; we cannot yet provide a definitive recommendation or firm quotation." : "No catalog model satisfies the known hard constraints. Review the conflicts or expand the catalog without automatically relaxing the requirements.");
  for (const result of report.results) {
    const sku = result.product.sku;
    const status = es ? ({ excluded: "No compatible", pending_verification: "Pendiente de verificación", confirmed_match: "Compatible dentro del alcance evaluado" }[result.status]) : ({ excluded: "Not Matched", pending_verification: "Pending Verification", confirmed_match: "Matched within evaluated scope" }[result.status]);
    add(`${sku}:status`, "result", `${sku}: ${status}. ${es ? "Potencia nominal documentada" : "Documented rated capacity"}: ${result.product.specifications.ratedW.value ?? "Unknown"} W / ${result.product.specifications.ratedVA.value ?? "Unknown"} VA. ${es ? "Registro de producto parcialmente verificado" : "Product record partially verified"}.`);
    const conflicts = result.checks.filter((c) => c.required && c.outcome === "failed");
    if (conflicts.length) add(`${sku}:conflicts`, "result", es ? `${sku}: no cumple ${conflicts.map((c) => esLabels[c.id] ?? c.label).join(", ")}.` : `${sku}: confirmed conflicts in ${conflicts.map((c) => c.label).join(", ")}.`);
    add(`${sku}:source`, "source", `${es ? "Fuente oficial" : "Official source"} ${sku} (${result.product.verifiedOn}): ${result.product.sourceUrl}`);
  }
  const candidates = report.results.filter((result) => result.status !== "excluded");
  const pendingChecks = candidates.flatMap((result) => result.checks.filter((check) => check.outcome === "pending"));
  const uniquePending = pendingChecks.filter((check, i) => pendingChecks.findIndex((other) => other.id === check.id) === i);
  if (uniquePending.length) add("shared_verification", "verification", es ? `Para continuar evaluando ${candidates.map((result) => result.product.sku).join(" / ")}, falta verificar: ${uniquePending.map((check) => esLabels[check.id] ?? "requisito adicional").join("; ")}. Esta lista no confirma ninguna de esas condiciones.` : `Further evaluation of ${candidates.map((result) => result.product.sku).join(" / ")} requires verification of: ${uniquePending.map((check) => check.label).join("; ")}. None of these conditions is represented as confirmed.`);
  const customerIds = new Set(report.results.flatMap((result) => result.checks.filter((check) => check.question?.audience === "customer").map((check) => check.id)));
  if (req.effectiveVA === null) add("question:capacity_va", "question", es ? "¿Cuál es la carga en VA o el factor de potencia medido de los equipos? No podemos convertir W en VA sin ese dato." : "What is the load in VA or the measured load power factor? W cannot be treated as VA without this information.");
  if (["input_voltage", "output_voltage", "inputPhases", "outputPhases"].some((id) => customerIds.has(id)) || req.frequencyHz === null) add("question:electrical", "question", es ? "¿Podrían confirmar las tensiones de entrada/salida, fases y frecuencia requeridas, completando los datos aún no indicados?" : "Please complete any missing input/output voltage, phase and frequency requirements.");
  if (customerIds.has("mounting") || req.otherConstraints.length > 0) add("question:installation", "question", es ? "¿Prefieren torre o rack, y qué dimensiones o criterios medibles se aplican a los requisitos adicionales indicados?" : "Do you need tower or rack installation, and what dimensions or measurable criteria define any compactness or additional requirements?");
  if (req.runtimeMinutes === null) add("question:runtime", "question", es ? "¿Cuántos minutos de autonomía necesitan con la carga especificada?" : "How many minutes of backup are required at the specified load?");
  if (customerIds.has("redundancy")) add("question:redundancy", "question", es ? "¿Es suficiente un UPS individual o necesitan una arquitectura redundante N+1 o de doble alimentación?" : "Is a single UPS acceptable, or is N+1 or dual-path redundancy required?");
  if (customerIds.has("budget")) add("question:budget", "question", es ? "¿Tienen un presupuesto máximo y una moneda preferida para preparar la cotización completa?" : "Is there a budget ceiling and preferred currency for the complete quotation?");
  if (req.quantity === null || req.destination === null) add("question:delivery", "question", es ? "Por favor, completen la cantidad y el destino de entrega que aún no se hayan indicado." : "Please complete any missing requested quantity and delivery destination.");
  if (req.quantity !== null && req.quantity > 1 && !req.loadPerUnitConfirmed) add("load_allocation", "question", es ? `¿La carga de ${req.loadW} W corresponde a cada UPS o al conjunto de ${req.quantity} unidades? Debemos validar la distribución de cargas antes de diseñar la solución.` : `Is ${req.loadW} W the load per UPS or the total across ${req.quantity} units? Load allocation must be confirmed before solution design.`);
  add("commercial_caveat", "verification", es ? "La autonomía, la comercialización local, el precio, las existencias y el plazo de entrega NO están confirmados por la mera existencia de una página oficial. Verificaremos estos puntos con el fabricante o canal autorizado; no se ofrece un compromiso de suministro." : "Runtime, local sale status, price, stock and lead time are NOT confirmed by the existence of an official page. We will verify these with the manufacturer or authorized channel; this is not a supply commitment.");
  add("next_action", "next", es ? "Con los datos confirmados revisaremos las curvas oficiales de autonomía, la compatibilidad eléctrica y los accesorios, y solicitaremos una cotización completa para la cantidad requerida, con moneda, impuestos, transporte y destino acordados." : "After confirmation, we will review official runtime curves, electrical compatibility and accessories, then request a complete quote for the requested quantity with agreed currency, taxes, delivery and destination.");
  return facts;
}

export function validateMailPlan(raw: unknown, facts: MailFact[]): MailPlan {
  const plan = mailPlanSchema.parse(raw);
  const expected = new Set(facts.map((fact) => fact.id));
  if (plan.factIds.length !== expected.size || new Set(plan.factIds).size !== expected.size || plan.factIds.some((id) => !expected.has(id))) throw new Error("mail_fact_mismatch");
  return plan;
}
export function renderMail(plan: MailPlan, facts: MailFact[], language: EmailLanguage) {
  validateMailPlan(plan, facts);
  const es = language === "es";
  const opening = es ? plan.opening === "thank_you" ? "Gracias por compartir sus requisitos. A continuación presentamos nuestra revisión preliminar." : "Hemos preparado una revisión técnica preliminar de su solicitud." : plan.opening === "thank_you" ? "Thank you for sharing your requirements. Please find our preliminary review below." : "We have prepared a preliminary technical review of your request.";
  const closing = es ? plan.closing === "confirm_details" ? "Quedamos atentos a sus confirmaciones para avanzar de forma responsable.\nSaludos cordiales,\nEquipo de ventas técnicas" : "Proponemos revisar conjuntamente los datos pendientes antes de definir el suministro.\nSaludos cordiales,\nEquipo de ventas técnicas" : plan.closing === "confirm_details" ? "We look forward to your confirmation so we can proceed responsibly.\nKind regards,\nTechnical sales team" : "We suggest reviewing the outstanding details together before defining the supply.\nKind regards,\nTechnical sales team";
  const byId = new Map(facts.map((fact) => [fact.id, fact.text]));
  const body = [es ? "Estimado equipo:" : "Dear team,", opening, ...plan.factIds.map((id) => byId.get(id)!), closing, es ? "Proyecto independiente de aprendizaje y demostración; no es una herramienta oficial de Schneider Electric." : "Independent learning demo; not an official Schneider Electric tool."].join("\n\n");
  return { subject: es ? "Revisión preliminar de su solicitud de UPS — datos por confirmar" : "Preliminary UPS review — details to confirm", body };
}
