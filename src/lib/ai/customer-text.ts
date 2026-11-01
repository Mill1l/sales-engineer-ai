import type { Requirements } from "../selection/requirements";
import type { EmailLanguage } from "./mail";

/** Display boundary only. Never mutate customer originals or treat these as product facts.
 * Every customer value occupies ONE source-marked physical line. All Unicode control,
 * format and line/paragraph separators become visible code points; quotes/list markers
 * cannot end the attribution or create a new sales paragraph. No truncation of requirements.
 */
export function customerTextLine(value: string, field: "application" | "destination" | "constraint", language: EmailLanguage): string {
  const text = value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, char => `[U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}]`);
  const labels = language === "es" ? { application: "aplicación", destination: "destino", constraint: "requisito adicional" } : { application: "application", destination: "destination", constraint: "additional requirement" };
  return language === "es" ? `> [Texto del cliente — ${labels[field]}; sin verificar] ${text}` : `> [Customer text — ${labels[field]}; unverified] ${text}`;
}

export function customerContext(req: Pick<Requirements, "application" | "country" | "destination" | "quantity">, language: EmailLanguage): string {
  const es = language === "es";
  return [es ? "Datos indicados por el cliente; no son prestaciones confirmadas:" : "Customer-provided details; not confirmed product capabilities:",
    customerTextLine(req.application, "application", language),
    req.destination === null ? (es ? "Destino: por confirmar." : "Destination: to confirm.") : customerTextLine(req.destination, "destination", language),
    es ? `País: ${req.country}. Cantidad solicitada: ${req.quantity ?? "por confirmar"}.` : `Country: ${req.country}; quantity: ${req.quantity ?? "to confirm"}.`,
  ].join("\n");
}
