import { handleAiRequest } from "@/lib/ai/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export function POST(request: Request) { return handleAiRequest(request, "email"); }
