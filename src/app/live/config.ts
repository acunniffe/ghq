const isServerProduction = process.env.NODE_ENV === "production";
const isClientProduction =
  typeof window !== "undefined" && window.location.hostname === "playghq.com";

const isProduction = isServerProduction || isClientProduction;

export const API_URL = isProduction
  ? "https://ghq-611639590301.us-central1.run.app"
  : "http://localhost:8000";
