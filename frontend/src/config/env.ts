const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

const rawWsUrl = process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws");
export const WS_URL = rawWsUrl.replace(/\/+$/, "");

const rawAiUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8080";
export const AI_SERVICE_URL = rawAiUrl.replace(/\/+$/, "");
