// src/pages/MonthlyReportPage.tsx
import React, { useMemo, useState } from "react";
import { getMonthlyReport } from "../api/reports";

type ReportData = any; // 백엔드 스키마 그대로 쓰려면 any로 시작하는 게 편함

const nowYYYYMM = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export default function MonthlyReportPage() {
  const [month, setMonth] = useState(nowYYYYMM());
  const [thresholdPrice, setThresholdPrice] = useState(85000);
  const [channel, setChannel] = useState("naver");
  const [crawlSchedule, setCrawlSchedule] = useState("00/12");
  const [topCards, setTopCards] = useState(10);
  const [useLlm, setUseLlm] = useState(true);
  const [store, setStore] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  const prettyJson = useMemo(
    () => (data ? JSON.stringify(data, null, 2) : ""),
    [data],
  );

  const onFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMonthlyReport({
        month,
        threshold_price: thresholdPrice,
        channel,
        crawl_schedule: crawlSchedule,
        top_cards: topCards,
        use_llm: useLlm,
        store,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 16 }}>월간 리포트</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          alignItems: "end",
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: 12 }}>month (YYYY-MM)</label>
          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-02"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>threshold_price</label>
          <input
            type="number"
            value={thresholdPrice}
            onChange={(e) => setThresholdPrice(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>channel</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          >
            <option value="naver">naver</option>
            <option value="coupang">coupang</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12 }}>crawl_schedule</label>
          <input
            value={crawlSchedule}
            onChange={(e) => setCrawlSchedule(e.target.value)}
            placeholder="00/12"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>top_cards</label>
          <input
            type="number"
            value={topCards}
            onChange={(e) => setTopCards(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <div
          style={{
            gridColumn: "span 6",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
            />
            use_llm
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={store}
              onChange={(e) => setStore(e.target.checked)}
            />
            store
          </label>

          <button
            onClick={onFetch}
            disabled={loading}
            style={{
              marginLeft: "auto",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "불러오는 중..." : "리포트 생성/조회"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 16,
          }}
        >
          {/* 왼쪽: 핵심 섹션 */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3 style={{ marginTop: 0 }}>요약</h3>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {data?.llm?.summary ?? data?.summary ?? "(요약 없음)"}
            </pre>

            <hr style={{ margin: "16px 0" }} />

            <h3 style={{ marginTop: 0 }}>패턴</h3>
            {Array.isArray(data?.patterns) && data.patterns.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.patterns.map((p: any, i: number) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <b>{p?.title ?? `pattern ${i + 1}`}</b>
                    <div style={{ marginTop: 4 }}>{p?.description ?? ""}</div>
                    {Array.isArray(p?.evidence_sellers) &&
                      p.evidence_sellers.length > 0 && (
                        <div
                          style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}
                        >
                          evidence_sellers: {p.evidence_sellers.join(", ")}
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <div>(패턴 없음)</div>
            )}

            <hr style={{ margin: "16px 0" }} />

            <h3 style={{ marginTop: 0 }}>셀러 카드</h3>
            {Array.isArray(data?.seller_cards) &&
            data.seller_cards.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {data.seller_cards.map((c: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {c?.seller ?? c?.name ?? `seller ${i + 1}`}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      min_price: {c?.min_price ?? "-"} / max_price:{" "}
                      {c?.max_price ?? "-"}
                    </div>
                    {c?.recommendation && (
                      <div style={{ marginTop: 8 }}>{c.recommendation}</div>
                    )}
                    {c?.link && (
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-block", marginTop: 8 }}
                      >
                        링크
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>(셀러 카드 없음)</div>
            )}
          </div>

          {/* 오른쪽: 원본 JSON */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <h3 style={{ marginTop: 0 }}>원본 JSON</h3>
            <pre
              style={{
                fontSize: 12,
                overflow: "auto",
                maxHeight: 700,
                margin: 0,
                background: "#0b1020",
                color: "#d1d5db",
                padding: 12,
                borderRadius: 12,
              }}
            >
              {prettyJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
