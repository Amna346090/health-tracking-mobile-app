const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  database: string;
}

export async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<HealthCheckResponse>;
}
