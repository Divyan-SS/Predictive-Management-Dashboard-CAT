import { API_URL, AI_SERVICE_URL } from "@/config/env";

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

export async function predictMachineHealth(machineId: string) {
  const url = `${AI_SERVICE_URL}/api/predict/health/${machineId}`;
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`AI Prediction failed with status ${response.status}`);
  }
  return response.json();
}
