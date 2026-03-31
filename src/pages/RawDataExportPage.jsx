// src/pages/RawDataExportPage.jsx
import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function kstTodayYmd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  return new Date().toISOString().slice(0, 10);
}

export default function RawDataExportPage() {
  const defaultDate = useMemo(() => kstTodayYmd(), []);
  const [date, setDate] = useState(defaultDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    const d = (date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setError("날짜 형식은 YYYY-MM-DD 입니다.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const url = `${API_BASE}/products/export/raw?date=${encodeURIComponent(d)}`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = `요청 실패 (${res.status})`;
        try {
          const j = await res.json();
          if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `products_raw_${d}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e?.message || "다운로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-slate-500">데이터 추출</div>
        <h1 className="text-2xl font-semibold text-slate-900">
          DB 원본 엑셀 (날짜 지정)
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          한국 시간(KST) 기준으로 하루(00:00~24:00)에 저장된{" "}
          <code className="rounded bg-slate-100 px-1">products</code> 행 전체를
          그대로 엑셀로 받습니다. 시각 필터는{" "}
          <code className="rounded bg-slate-100 px-1">
            COALESCE(snapshot_at, created_at)
          </code>
          과 동일합니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">기준 일자 (KST)</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          />
        </label>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "생성 중…" : "엑셀 다운로드"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
