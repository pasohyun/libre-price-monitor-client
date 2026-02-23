// src/config/api.ts
// CRA(react-scripts): REACT_APP_API_BASE_URL
// Next.js: NEXT_PUBLIC_API_BASE_URL
// (둘 다 없으면 로컬 기본값)
const fromCra =
  (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE_URL) || "";
const fromNext =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "";

export const API_BASE_URL = (
  fromCra ||
  fromNext ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");
