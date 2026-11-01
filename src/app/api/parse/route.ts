import { handleAiRequest, serverConfig } from "@/lib/ai/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export function POST(request: Request) { return handleAiRequest(request, "parse"); }
export function GET() {
  let mockAvailable = false;
  try { serverConfig("mock"); mockAvailable = true; } catch { /* Shared safety limits must be valid too. */ }
  try {
    const config = serverConfig();
    return Response.json({ liveAvailable: config.enabled && Boolean(config.apiKey), mockAvailable, model: config.model, provider: config.providerName, defaultMode: "mock", maxInquiryChars: 6000 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ liveAvailable: false, mockAvailable, configurationError: "configuration_error", model: null, defaultMode: "mock", maxInquiryChars: 6000 }, { headers: { "Cache-Control": "no-store" } }); }
}
