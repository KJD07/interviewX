// Fetch wrapper for the Django API. Built out in Phase 5 (auth + dashboard
// wiring). Left as a placeholder in Phase 0 so the file exists at the path
// the spec expects (Section 3): frontend/src/lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export { API_URL };
