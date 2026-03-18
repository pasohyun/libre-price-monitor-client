// src/pages/RangeReportPage.tsx
import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getRangeReport } from "../api/reports";
import { API_BASE_URL } from "../config/api";

type ReportData = any;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const thirtyDaysAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtMoney = (v: any) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n.toLocaleString("ko-KR")}원`;
};

const fmtTime = (v: any) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #d1d5db",
};

const sectionCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

export default function RangeReportPage() {
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [thresholdPrice, setThresholdPrice] = useState(85000);
  const [channel, setChannel] = useState<"naver" | "coupang" | "all">("naver");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [modalData, setModalData] = useState<{ html: string; link?: string } | null>(null);


  const onFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRangeReport({
        start_date: startDate,
        end_date: endDate,
        threshold_price: thresholdPrice,
        channel,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || {};
  const belowList: any[] = Array.isArray(data?.below_threshold_list)
    ? data.below_threshold_list
    : [];
  const sellerCards: any[] = Array.isArray(data?.seller_cards)
    ? data.seller_cards
    : [];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 16 }}>기간별 리포트</h2>

      {/* 입력 폼 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
          alignItems: "end",
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={{ fontSize: 12 }}>시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>기준가</label>
          <input
            type="number"
            value={thresholdPrice}
            onChange={(e) => setThresholdPrice(Number(e.target.value))}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12 }}>채널</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as any)}
            style={inputStyle}
          >
            <option value="naver">naver</option>
            <option value="coupang">coupang</option>
            <option value="all">all (naver + coupang)</option>
          </select>
        </div>

        <div>
          <button
            onClick={onFetch}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "불러오는 중..." : "리포트 조회"}
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

      {!data && !loading && (
        <div style={{ opacity: 0.7 }}>
          리포트 조회를 눌러 데이터를 불러오세요.
        </div>
      )}

      {data && (
        <div>
          <div>
            {/* ① Summary */}
            <div style={sectionCard}>
              <h3 style={{ marginTop: 0 }}>① 요약 (Summary)</h3>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    기준가 이하 셀러 수:{" "}
                    <b>{summary?.below_threshold_seller_count ?? 0}곳</b>
                  </li>
                  <li>
                    최저 단가:{" "}
                    <b>{fmtMoney(summary?.global_min_price)}</b>
                    {summary?.global_min_seller && (
                      <> ({summary.global_min_seller})</>
                    )}
                    {summary?.global_min_time && (
                      <> / {fmtTime(summary.global_min_time)}</>
                    )}
                  </li>
                </ul>

                {Array.isArray(summary?.top5_lowest) &&
                  summary.top5_lowest.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        최저가격 상위 5개 거래처
                      </div>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr>
                            {["거래처명", "최저 단가", "플랫폼"].map((h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: "left",
                                  fontSize: 12,
                                  padding: "6px 6px",
                                  borderBottom: "1px solid #e5e7eb",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {summary.top5_lowest.map((item: any, i: number) => (
                            <tr key={i}>
                              <td
                                style={{
                                  padding: "6px",
                                  borderBottom: "1px solid #f3f4f6",
                                }}
                              >
                                {item?.seller_name ?? item?.seller ?? "-"}
                              </td>
                              <td
                                style={{
                                  padding: "6px",
                                  borderBottom: "1px solid #f3f4f6",
                                }}
                              >
                                {fmtMoney(
                                  item?.min_unit_price ?? item?.min_price,
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "6px",
                                  borderBottom: "1px solid #f3f4f6",
                                }}
                              >
                                {item?.platform ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </div>

            {/* ② 기준가 이하 리스트 */}
            <div style={sectionCard}>
              <h3 style={{ marginTop: 0 }}>② 기준가 이하 리스트</h3>
              {belowList.length === 0 ? (
                <div>(기준가 이하 셀러 없음)</div>
              ) : (
                <div style={{ overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["판매처", "채널", "최저 단가", "총 금액", "수량", "카드"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              fontSize: 12,
                              padding: "8px 6px",
                              borderBottom: "1px solid #e5e7eb",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {belowList.map((r: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", fontWeight: 600 }}>
                            {r?.seller_name ?? "-"}
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6" }}>
                            {r?.platform ?? "-"}
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                            {fmtMoney(r?.unit_price)}
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                            {fmtMoney(r?.total_price)}
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6" }}>
                            {r?.quantity ?? "-"}
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6" }}>
                            {r?.card_html ? (
                              <div
                                onClick={() => setModalData({ html: r.card_html, link: r.link })}
                                style={{
                                  width: 80,
                                  height: 60,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 6,
                                  overflow: "hidden",
                                  cursor: "pointer",
                                  position: "relative",
                                }}
                              >
                                <iframe
                                  srcDoc={r.card_html}
                                  style={{
                                    width: "500%",
                                    height: 500,
                                    border: "none",
                                    pointerEvents: "none",
                                    transform: "scale(0.16)",
                                    transformOrigin: "top left",
                                  }}
                                  sandbox="allow-same-origin"
                                  title={`evidence-thumb-${i}`}
                                />
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(255,255,255,0.5)",
                                    fontSize: 10,
                                    color: "#374151",
                                    opacity: 0,
                                    transition: "opacity 0.15s",
                                  }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                                >
                                  크게 보기
                                </div>
                              </div>
                            ) : r?.link ? (
                              <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                                링크
                              </a>
                            ) : r?.card_image_path ? (
                              <a href={`${API_BASE_URL}/${r.card_image_path}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                                캡쳐본
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ③ 셀러별 상세 카드 */}
            <div style={sectionCard}>
              <h3 style={{ marginTop: 0 }}>③ 셀러별 상세 카드</h3>
              {sellerCards.length === 0 ? (
                <div>(셀러 카드 없음)</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sellerCards.map((c: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 15 }}>
                          {c?.seller_name ?? `seller ${i + 1}`}{" "}
                          <span style={{ fontWeight: 500, opacity: 0.7 }}>
                            ({c?.platform ?? "-"})
                          </span>
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.8 }}>
                          최저 {fmtMoney(c?.min_unit_price)}
                          {c?.min_time && <> / {fmtTime(c.min_time)}</>}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 8,
                          fontSize: 13,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          금액: <b>{fmtMoney(c?.total_price)}</b>
                        </div>
                        <div>
                          수량: <b>{c?.quantity ?? "-"}</b>
                        </div>
                        <div>
                          {c?.link ? (
                            <a
                              href={c.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              상품 링크
                            </a>
                          ) : c?.card_image_path ? (
                            <a
                              href={`${API_BASE_URL}/${c.card_image_path}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              캡쳐본
                            </a>
                          ) : (
                            <span style={{ opacity: 0.5 }}>링크 없음</span>
                          )}
                        </div>
                      </div>

                      {/* 일별 최저가 차트 */}
                      {Array.isArray(c?.chart_data) &&
                        c.chart_data.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                marginBottom: 8,
                              }}
                            >
                              일별 최저가 추이
                            </div>
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart
                                data={c.chart_data.map((p: any, idx: number) => ({
                                  ...p,
                                  _index: idx,
                                  _label: p.time ? `${p.date} ${p.time}` : p.date,
                                }))}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#e5e7eb"
                                />
                                <XAxis
                                  dataKey="_index"
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(idx: number) => {
                                    const point = c.chart_data[idx];
                                    if (!point) return "";
                                    // 각 날짜의 첫 포인트에만 날짜 라벨 표시
                                    const prev = idx > 0 ? c.chart_data[idx - 1] : null;
                                    if (!prev || prev.date !== point.date) return point.date.replace(/^\d{2}/, "");
                                    return "";
                                  }}
                                  interval={0}
                                />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(v: number) =>
                                    `${(v / 1000).toFixed(0)}k`
                                  }
                                  domain={["dataMin - 1000", "dataMax + 1000"]}
                                />
                                <Tooltip
                                  labelFormatter={(idx: number) => {
                                    const point = c.chart_data[idx];
                                    return point ? (point.time ? `${point.date} ${point.time}` : point.date) : "";
                                  }}
                                  formatter={(v: number) => [
                                    fmtMoney(v),
                                    "최저 단가",
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="min_price"
                                  stroke="#2563eb"
                                  strokeWidth={2}
                                  dot={{ r: 2 }}
                                  activeDot={{ r: 4 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>

                            {/* 기준가 라인 표시 */}
                            <div
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                textAlign: "right",
                                marginTop: 4,
                              }}
                            >
                              기준가: {fmtMoney(thresholdPrice)}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      {/* Evidence 카드 모달 */}
      {modalData && (
        <div
          onClick={() => setModalData(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: 16,
            overflowY: "scroll",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "fit-content",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "white",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                gap: 16,
              }}
            >
              <div style={{ fontWeight: 700 }}>Evidence 카드</div>
              <div style={{ display: "flex", gap: 8 }}>
                {modalData.link && (
                  <a
                    href={modalData.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: "1px solid #111827",
                      borderRadius: 8,
                      padding: "4px 12px",
                      fontSize: 13,
                      background: "#111827",
                      color: "white",
                      textDecoration: "none",
                    }}
                  >
                    원문 바로가기
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setModalData(null)}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "4px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: "white",
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: modalData.html }}
              style={{
                borderRadius: 8,
                overflow: "auto",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
