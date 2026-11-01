import { blankExtractedValues, type Extraction, type ExtractedValues } from "./contracts";

type Seed = { field: keyof ExtractedValues; value: unknown; quote: string };
function demo(id: string, title: string, language: Extraction["language"], inquiry: string, seeds: Seed[]) {
  const requirements = blankExtractedValues();
  for (const seed of seeds) (requirements as Record<string, unknown>)[seed.field] = seed.value;
  return { id, title, inquiry, extraction: { language, requirements, evidence: seeds.map(({ field, quote }) => ({ field, quote, certainty: "known" as const })) } };
}
export const inquiryDemos = [
  demo("chile-distributor", "Chile Distributor Inquiry", "es", "Hola, somos una empresa distribuidora de equipos industriales en Santiago de Chile. Buscamos un sistema UPS online para proteger nuestros equipos críticos. La carga estimada es de 1800 W y necesitamos al menos 15 minutos de autonomía. Preferimos una solución compacta y confiable. ¿Podrían recomendarnos un modelo adecuado y enviarnos una cotización para 5 unidades?", [
    { field: "country", value: "CL", quote: "Santiago de Chile" }, { field: "destination", value: "Santiago de Chile", quote: "Santiago de Chile" },
    { field: "application", value: "proteger nuestros equipos críticos", quote: "proteger nuestros equipos críticos" },
    { field: "loadW", value: 1800, quote: "La carga estimada es de 1800 W" }, { field: "runtimeMinutes", value: 15, quote: "al menos 15 minutos de autonomía" },
    { field: "topology", value: "double_conversion_online", quote: "un sistema UPS online" }, { field: "quantity", value: 5, quote: "5 unidades" },
    { field: "otherConstraints", value: ["compacta y confiable"], quote: "compacta y confiable" },
  ]),
  demo("english-kw", "English · kW & PF", "en", "We are in Chile. We need an online UPS for our server room. The load is 1.6 kW, PF 0.8, with 15 minutes backup. Please quote 2 units delivered to Santiago.", [
    { field: "country", value: "CL", quote: "Chile" }, { field: "application", value: "server room", quote: "server room" }, { field: "loadW", value: 1600, quote: "1.6 kW" }, { field: "powerFactor", value: 0.8, quote: "PF 0.8" }, { field: "runtimeMinutes", value: 15, quote: "15 minutes" }, { field: "topology", value: "double_conversion_online", quote: "online UPS" }, { field: "quantity", value: 2, quote: "2 units" }, { field: "destination", value: "Santiago", quote: "Santiago" },
  ]),
  demo("chinese-va", "中文 · VA 独立超限", "zh", "客户位于智利，需要保护网络设备，负载900 W，视在功率1800 VA，后备15分钟，安装采用塔式。", [
    { field: "country", value: "CL", quote: "智利" }, { field: "application", value: "网络设备", quote: "网络设备" }, { field: "loadW", value: 900, quote: "900 W" }, { field: "loadVA", value: 1800, quote: "1800 VA" }, { field: "runtimeMinutes", value: 15, quote: "15分钟" }, { field: "mounting", value: "tower", quote: "塔式" },
  ]),
  demo("spanish-overload", "Español · 3 kW overload", "es", "Somos de Chile. Buscamos UPS online para servidores, carga de 3 kW y 3,3 kVA. Necesitamos 15 minutos y 3 unidades.", [
    { field: "country", value: "CL", quote: "Chile" }, { field: "application", value: "servidores", quote: "servidores" }, { field: "loadW", value: 3000, quote: "3 kW" }, { field: "loadVA", value: 3300, quote: "3,3 kVA" }, { field: "topology", value: "double_conversion_online", quote: "UPS online" }, { field: "runtimeMinutes", value: 15, quote: "15 minutos" }, { field: "quantity", value: 3, quote: "3 unidades" },
  ]),
  demo("rack-frequency", "English · rack & frequency", "en", "Chile: protect lab computers with an online UPS. Load 800 W and 1000 VA. Input 230 V, output 230 V, single phase, 50 Hz, rack mounting and 15 minutes runtime. We need 1 unit.", [
    { field: "country", value: "CL", quote: "Chile" }, { field: "application", value: "lab computers", quote: "lab computers" }, { field: "loadW", value: 800, quote: "800 W" }, { field: "loadVA", value: 1000, quote: "1000 VA" }, { field: "inputVoltageV", value: 230, quote: "Input 230 V" }, { field: "outputVoltageV", value: 230, quote: "output 230 V" }, { field: "phases", value: 1, quote: "single phase" }, { field: "frequencyHz", value: 50, quote: "50 Hz" }, { field: "mounting", value: "rack", quote: "rack mounting" }, { field: "runtimeMinutes", value: 15, quote: "15 minutes" }, { field: "topology", value: "double_conversion_online", quote: "online UPS" }, { field: "quantity", value: 1, quote: "1 unit" },
  ]),
  demo("missing-va", "English · missing VA / PF", "en", "We are in Chile and need a UPS for network equipment. Load 800 W and backup 15 minutes. Can you help?", [
    { field: "country", value: "CL", quote: "Chile" }, { field: "application", value: "network equipment", quote: "network equipment" }, { field: "loadW", value: 800, quote: "800 W" }, { field: "runtimeMinutes", value: 15, quote: "15 minutes" },
  ]),
];
