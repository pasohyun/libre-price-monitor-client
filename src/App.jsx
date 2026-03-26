import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import Report from "./Report.jsx";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import MonthlyReportPage from "./pages/MonthlyReportPage";
import RangeReportPage from "./pages/RangeReportPage";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

/**
 * Libre2 온라인 모니터링 대시보드 (프론트 MVP)
 * - 메인(대시보드) -> 채널별 주요 셀러 -> 판매처 세부
 * - 기준가 이하 리스트 + 증빙(캡처) 타임라인
 * - 일별 / 월별 토글
 *
 * 사용: 이 파일을 src/App.jsx (또는 App.tsx에 맞게 변환)로 붙여넣기
 * 필요 패키지: recharts
 *   npm i recharts
 */

// -----------------------------
// API 호출 함수
// -----------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const MEDICAL_DEVICE_BASE_URL = "https://2d.daewoong.co.kr/frame/index.do";

async function fetchLatestProducts(channel) {
  try {
    const qs = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    let response = await fetch(`${API_BASE}/products/latest${qs}`);
    if (response.status === 404) {
      // Backward compatibility for older backend deployments
      response = await fetch(`${API_BASE}/products/today${qs}`);
    }
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch latest products:", error);
    return { snapshot_time: null, count: 0, data: [] };
  }
}

async function fetchConfig() {
  try {
    const response = await fetch(`${API_BASE}/products/config`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch config:", error);
    return { target_price: 90000, tracked_malls: [], search_keyword: "" };
  }
}

async function fetchTrackedMallsSummary(channel) {
  try {
    const qs = channel ? `?channel=${encodeURIComponent(channel)}` : "";
    const response = await fetch(`${API_BASE}/products/tracked-malls/summary${qs}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch tracked malls summary:", error);
    return { target_price: 90000, tracked_malls: [], data: [] };
  }
}

async function fetchTrackedMallsTrends(days = 7, channel) {
  try {
    const params = new URLSearchParams({ days: String(days) });
    if (channel) params.set("channel", channel);
    const response = await fetch(
      `${API_BASE}/products/tracked-malls/trends?${params.toString()}`,
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch tracked malls trends:", error);
    return { days: days, malls: [], data: [] };
  }
}

async function fetchMallsTop(limit = 10) {
  try {
    const response = await fetch(
      `${API_BASE}/products/malls/top?limit=${limit}`,
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch malls top:", error);
    return { count: 0, data: [] };
  }
}

async function runCrawlNow() {
  try {
    const response = await fetch(`${API_BASE}/products/crawl/run`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to run crawl now:", error);
    return { started: false, status: "error", message: String(error) };
  }
}

async function fetchCrawlStatus() {
  try {
    const response = await fetch(`${API_BASE}/products/crawl/status`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch crawl status:", error);
    return {
      running: false,
      last_started_at: null,
      last_finished_at: null,
      last_error: String(error),
      timezone: "Asia/Seoul",
    };
  }
}

async function fetchMallTimeline(mallName, days = 30, channel) {
  try {
    const params = new URLSearchParams({
      mall_name: mallName,
      days: String(days),
    });
    if (channel) params.set("channel", channel);
    const response = await fetch(
      `${API_BASE}/products/mall/timeline?${params.toString()}`,
    );
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch mall timeline:", error);
    return { mall_name: mallName, days, count: 0, data: [] };
  }
}

async function generateCardImageOnDemand(productId) {
  try {
    const response = await fetch(
      `${API_BASE}/products/card/generate?product_id=${encodeURIComponent(productId)}`,
      { method: "POST" },
    );
    if (!response.ok) {
      let detail = `API error: ${response.status}`;
      try {
        const err = await response.json();
        if (err?.detail) detail = String(err.detail);
      } catch {
        // ignore json parse failure
      }
      throw new Error(detail);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to generate card image:", error);
    return { created: false, card_image_path: null, message: String(error) };
  }
}

async function confirmManualQuantity(productId, quantity) {
  try {
    const response = await fetch(
      `${API_BASE}/products/manual-confirm?product_id=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity)}`,
      { method: "POST" },
    );
    if (!response.ok) {
      let detail = `API error: ${response.status}`;
      try {
        const err = await response.json();
        if (err?.detail) detail = String(err.detail);
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to confirm manual quantity:", error);
    return { updated: false, message: String(error) };
  }
}

// -----------------------------
// Mock Data (일별/월별 데이터는 백엔드에 없으므로 유지)
// -----------------------------

const CHANNELS = [
  { key: "naver", label: "네이버스토어", active: true },
  { key: "coupang", label: "쿠팡", active: true },
  { key: "others", label: "기타(G마켓/옥션)", active: true },
];

const HEADER_LABELS = {
  naver: "네이버\n스토어",
  coupang: "쿠팡",
  others: "기타(G마켓/\n옥션)",
};

const MARKET_BY_CHANNEL = {
  naver: ["스마트스토어"],
  coupang: ["로켓배송", "마켓플레이스"],
  others: ["G마켓", "옥션"],
};

// 수집시간(하루 1회) 기준 예시
const SAMPLE_DAILY_POINTS = [
  { x: "11/01", naver: 90500, coupang: 89000, others: 86000 },
  { x: "11/02", naver: 91500, coupang: 90000, others: 85500 },
  { x: "11/03", naver: 91000, coupang: 90500, others: 84500 },
  { x: "11/04", naver: 93000, coupang: 89500, others: 85000 },
  { x: "11/05", naver: 92000, coupang: 88500, others: 86500 },
  { x: "11/06", naver: 94000, coupang: 88000, others: 84000 },
];

// 월별(예: 월 최저가 또는 월 평균가)
const SAMPLE_MONTHLY_POINTS = [
  { x: "6월", naver: 91000, coupang: 89500, others: 87000 },
  { x: "9월", naver: 92500, coupang: 90500, others: 86000 },
  { x: "10월", naver: 92000, coupang: 89000, others: 85500 },
  { x: "11월", naver: 94000, coupang: 88500, others: 84000 },
];

// 판매처별 일별 데이터
const SAMPLE_SELLER_DAILY_DATA = {
  naver: {
    레디투힐: [
      { x: "11/01", price: 85000 },
      { x: "11/02", price: 84800 },
      { x: "11/03", price: 84500 },
      { x: "11/04", price: 84800 },
      { x: "11/05", price: 85000 },
      { x: "11/06", price: 85200 },
    ],
    닥다몰: [
      { x: "11/01", price: 89000 },
      { x: "11/02", price: 88800 },
      { x: "11/03", price: 88500 },
      { x: "11/04", price: 88700 },
      { x: "11/05", price: 88500 },
      { x: "11/06", price: 88300 },
    ],
    메디프라: [
      { x: "11/01", price: 90500 },
      { x: "11/02", price: 90000 },
      { x: "11/03", price: 90200 },
      { x: "11/04", price: 90000 },
      { x: "11/05", price: 89800 },
      { x: "11/06", price: 90000 },
    ],
    글루코핏: [
      { x: "11/01", price: 87500 },
      { x: "11/02", price: 87200 },
      { x: "11/03", price: 87000 },
      { x: "11/04", price: 87200 },
      { x: "11/05", price: 87400 },
      { x: "11/06", price: 87200 },
    ],
  },
  coupang: {
    "쿠팡(로켓배송)": [
      { x: "11/01", price: 86000 },
      { x: "11/02", price: 85800 },
      { x: "11/03", price: 85500 },
      { x: "11/04", price: 85800 },
      { x: "11/05", price: 86000 },
      { x: "11/06", price: 86200 },
    ],
    랜식: [
      { x: "11/01", price: 87000 },
      { x: "11/02", price: 86800 },
      { x: "11/03", price: 86500 },
      { x: "11/04", price: 86700 },
      { x: "11/05", price: 86500 },
      { x: "11/06", price: 86300 },
    ],
    닥터다이어리: [
      { x: "11/01", price: 85500 },
      { x: "11/02", price: 85200 },
      { x: "11/03", price: 85000 },
      { x: "11/04", price: 85100 },
      { x: "11/05", price: 85000 },
      { x: "11/06", price: 84800 },
    ],
    필라이즈: [
      { x: "11/01", price: 88500 },
      { x: "11/02", price: 88200 },
      { x: "11/03", price: 88000 },
      { x: "11/04", price: 88100 },
      { x: "11/05", price: 88000 },
      { x: "11/06", price: 87800 },
    ],
  },
  others: {
    G마켓: [
      { x: "11/01", price: 85000 },
      { x: "11/02", price: 84800 },
      { x: "11/03", price: 84500 },
      { x: "11/04", price: 84600 },
      { x: "11/05", price: 84500 },
      { x: "11/06", price: 84300 },
    ],
    옥션: [
      { x: "11/01", price: 86500 },
      { x: "11/02", price: 86200 },
      { x: "11/03", price: 86000 },
      { x: "11/04", price: 86100 },
      { x: "11/05", price: 86000 },
      { x: "11/06", price: 85800 },
    ],
  },
};

// 판매처별 월별 데이터
const SAMPLE_SELLER_MONTHLY_DATA = {
  naver: {
    레디투힐: [
      { x: "6월", price: 85500 },
      { x: "9월", price: 85000 },
      { x: "10월", price: 84800 },
      { x: "11월", price: 84900 },
    ],
    닥다몰: [
      { x: "6월", price: 89000 },
      { x: "9월", price: 88800 },
      { x: "10월", price: 88600 },
      { x: "11월", price: 88500 },
    ],
    메디프라: [
      { x: "6월", price: 90500 },
      { x: "9월", price: 90200 },
      { x: "10월", price: 90000 },
      { x: "11월", price: 90100 },
    ],
    글루코핏: [
      { x: "6월", price: 87500 },
      { x: "9월", price: 87300 },
      { x: "10월", price: 87200 },
      { x: "11월", price: 87200 },
    ],
  },
  coupang: {
    "쿠팡(로켓배송)": [
      { x: "6월", price: 86000 },
      { x: "9월", price: 85800 },
      { x: "10월", price: 85700 },
      { x: "11월", price: 85800 },
    ],
    랜식: [
      { x: "6월", price: 87000 },
      { x: "9월", price: 86800 },
      { x: "10월", price: 86600 },
      { x: "11월", price: 86500 },
    ],
    닥터다이어리: [
      { x: "6월", price: 85500 },
      { x: "9월", price: 85200 },
      { x: "10월", price: 85000 },
      { x: "11월", price: 85100 },
    ],
    필라이즈: [
      { x: "6월", price: 88500 },
      { x: "9월", price: 88200 },
      { x: "10월", price: 88000 },
      { x: "11월", price: 88100 },
    ],
  },
  others: {
    G마켓: [
      { x: "6월", price: 85000 },
      { x: "9월", price: 84800 },
      { x: "10월", price: 84600 },
      { x: "11월", price: 84500 },
    ],
    옥션: [
      { x: "6월", price: 86500 },
      { x: "9월", price: 86300 },
      { x: "10월", price: 86100 },
      { x: "11월", price: 86000 },
    ],
  },
};

// 기준가 이하 판매처(테이블) 예시
const SAMPLE_OFFERS = [
  {
    id: "o1",
    channel: "naver",
    market: "스마트스토어",
    seller: "메디프라",
    productName: "프리스타일 리브레2 (1개)",
    pack: 1,
    price: 84300,
    unitPrice: 84300,
    url: "https://smartstore.naver.com/medipra/products/8496885294?nl-query=%ED%94%84%EB%A6%AC%EC%8A%A4%ED%83%80%EC%9D%BC%20%EB%A6%AC%EB%B8%8C%EB%A0%882&nl-au=1a9a2c37d1394869b9199b15586f7e64&NaPm=ci%3D1a9a2c37d1394869b9199b15586f7e64%7Cct%3Dmj8lnkij%7Ctr%3Dnslctg%7Csn%3D6382484%7Chk%3D229a93eb83134dc0984b6ff55cf344751d59e5da",
    capturedAt: "2025-01-09 00:00",
    captureThumb: "/o1.png",
  },
  {
    id: "o2",
    channel: "naver",
    market: "스마트스토어",
    seller: "레디투힐",
    productName: "프리스타일 리브레2 (7개 묶음)",
    pack: 7,
    price: 589500,
    unitPrice: 84214,
    url: "https://smartstore.naver.com/ready2heal/products/8746547584?nl-query=%ED%94%84%EB%A6%AC%EC%8A%A4%ED%83%80%EC%9D%BC%20%EB%A6%AC%EB%B8%8C%EB%A0%882%20%EB%A0%88%EB%94%94%ED%88%AC%ED%9E%90&nl-au=07fa608f227b4683980d1dda6f9bb3df&NaPm=ci%3D07fa608f227b4683980d1dda6f9bb3df%7Cct%3Dmj8l31rc%7Ctr%3Dnslsl%7Csn%3D6135054%7Chk%3Dfd1f7ffe057cb449b95b5c59cf074829aab3ad04",
    capturedAt: "2025-01-09 00:00",
    captureThumb: "/o2.png",
  },
  {
    id: "o3",
    channel: "coupang",
    market: "로켓배송",
    seller: "글루코핏",
    productName: "프리스타일 리브레2 (1개)",
    pack: 1,
    price: 81000,
    unitPrice: 81000,
    url: "https://www.coupang.com/vp/products/8375950876?itemId=26278170774&searchId=be1ce9c27c1b486b9d1c9cd978105b3c&sourceType=brandstore_sdp_atf-best_products&storeId=187186&subSourceType=brandstore_sdp_atf-best_products&vendorId=A00955925&vendorItemId=91720465581",
    capturedAt: "2025-01-09 00:00",
    captureThumb: "/o3.png",
  },
];

// 채널별 셀러 목록(주요 셀러) 예시
const SAMPLE_SELLERS = {
  naver: [
    {
      seller: "레디투힐",
      currentConsideredUnitPrice: 84800,
      last7dRange: 5200,
      belowCount: 3,
    },
    {
      seller: "무화당",
      currentConsideredUnitPrice: 88500,
      last7dRange: 3800,
      belowCount: 1,
    },
    {
      seller: "메디프라",
      currentConsideredUnitPrice: 90000,
      last7dRange: 6100,
      belowCount: 0,
    },
    {
      seller: "글루어트",
      currentConsideredUnitPrice: 87200,
      last7dRange: 4400,
      belowCount: 2,
    },
  ],
  coupang: [
    {
      seller: "쿠팡(로켓배송)",
      currentConsideredUnitPrice: 85800,
      last7dRange: 3000,
      belowCount: 2,
    },
    {
      seller: "랜식",
      currentConsideredUnitPrice: 86500,
      last7dRange: 7100,
      belowCount: 1,
    },
    {
      seller: "닥터다이어리",
      currentConsideredUnitPrice: 85000,
      last7dRange: 2500,
      belowCount: 2,
    },
    {
      seller: "필라이즈",
      currentConsideredUnitPrice: 88000,
      last7dRange: 6900,
      belowCount: 0,
    },
  ],
  others: [
    {
      seller: "G마켓",
      currentConsideredUnitPrice: 84500,
      last7dRange: 5400,
      belowCount: 1,
    },
    {
      seller: "옥션",
      currentConsideredUnitPrice: 86000,
      last7dRange: 4200,
      belowCount: 1,
    },
  ],
};

// 특정 셀러 상세(타임라인) 예시 (메인과 동일 UI 구성)
const SAMPLE_SELLER_TIMELINE = {
  "naver::레디투힐": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 85000,
      unitPrice: 85000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 84800,
      unitPrice: 84800,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 84500,
      unitPrice: 84500,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 84800,
      unitPrice: 84800,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 85000,
      unitPrice: 85000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 85200,
      unitPrice: 85200,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "naver::무화당": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 89000,
      unitPrice: 89000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 88800,
      unitPrice: 88800,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 88500,
      unitPrice: 88500,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 88700,
      unitPrice: 88700,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 88500,
      unitPrice: 88500,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 88300,
      unitPrice: 88300,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "naver::메디프라": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 90500,
      unitPrice: 90500,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 90000,
      unitPrice: 90000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 90200,
      unitPrice: 90200,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 90000,
      unitPrice: 90000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 89800,
      unitPrice: 89800,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 90000,
      unitPrice: 90000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "naver::글루어트": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 87500,
      unitPrice: 87500,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 87200,
      unitPrice: 87200,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 87000,
      unitPrice: 87000,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 87200,
      unitPrice: 87200,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 87400,
      unitPrice: 87400,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 87200,
      unitPrice: 87200,
      url: "https://smartstore.naver.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "coupang::쿠팡(로켓배송)": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 86000,
      unitPrice: 86000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 85800,
      unitPrice: 85800,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 85500,
      unitPrice: 85500,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 85800,
      unitPrice: 85800,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 86000,
      unitPrice: 86000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 86200,
      unitPrice: 86200,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "coupang::랜식": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 87000,
      unitPrice: 87000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 86800,
      unitPrice: 86800,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 86500,
      unitPrice: 86500,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 86700,
      unitPrice: 86700,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 86500,
      unitPrice: 86500,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 86300,
      unitPrice: 86300,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "coupang::닥터다이어리": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 85500,
      unitPrice: 85500,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 85200,
      unitPrice: 85200,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 85000,
      unitPrice: 85000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 85100,
      unitPrice: 85100,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 85000,
      unitPrice: 85000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 84800,
      unitPrice: 84800,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "coupang::필라이즈": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 88500,
      unitPrice: 88500,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 88200,
      unitPrice: 88200,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 88000,
      unitPrice: 88000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 88100,
      unitPrice: 88100,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 88000,
      unitPrice: 88000,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 87800,
      unitPrice: 87800,
      url: "https://www.coupang.com/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "others::G마켓": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 85000,
      unitPrice: 85000,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 84800,
      unitPrice: 84800,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 84500,
      unitPrice: 84500,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 84600,
      unitPrice: 84600,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 84500,
      unitPrice: 84500,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 84300,
      unitPrice: 84300,
      url: "https://www.gmarket.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
  "others::옥션": [
    {
      capturedAt: "2025-11-01 00:00",
      pack: 1,
      price: 86500,
      unitPrice: 86500,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-02 00:00",
      pack: 1,
      price: 86200,
      unitPrice: 86200,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-03 00:00",
      pack: 1,
      price: 86000,
      unitPrice: 86000,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-04 00:00",
      pack: 1,
      price: 86100,
      unitPrice: 86100,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-05 00:00",
      pack: 1,
      price: 86000,
      unitPrice: 86000,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
    {
      capturedAt: "2025-11-06 00:00",
      pack: 1,
      price: 85800,
      unitPrice: 85800,
      url: "https://www.auction.co.kr/example",
      captureThumb:
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=600&auto=format&fit=crop&q=60",
    },
  ],
};

// -----------------------------
// Utils
// -----------------------------

const formatKRW = (n) => {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR") + "원";
};

const parseDateLike = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const buildContinuousMallTrendData = (rows, mallNames = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const normalized = rows
    .map((item) => {
      const x = item?.x || item?.date;
      return x ? { ...item, x } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const da = parseDateLike(a.x);
      const db = parseDateLike(b.x);
      if (da && db) return da - db;
      return String(a.x).localeCompare(String(b.x));
    });

  if (normalized.length === 0) return [];

  const malls =
    mallNames.length > 0
      ? mallNames
      : Object.keys(normalized[0] || {}).filter((k) => k !== "x" && k !== "date");

  const filled = normalized.map((row) => ({ ...row }));

  malls.forEach((mall) => {
    const values = filled.map((row) => row[mall]);
    const firstKnownIdx = values.findIndex(
      (v) => typeof v === "number" && !Number.isNaN(v),
    );
    if (firstKnownIdx < 0) return;

    const firstValue = values[firstKnownIdx];
    for (let i = 0; i < firstKnownIdx; i += 1) {
      filled[i][mall] = firstValue;
    }

    let prev = firstValue;
    for (let i = firstKnownIdx + 1; i < filled.length; i += 1) {
      const cur = filled[i][mall];
      if (typeof cur === "number" && !Number.isNaN(cur)) {
        prev = cur;
      } else {
        filled[i][mall] = prev;
      }
    }
  });

  return filled;
};

const formatDateTimeKST = (v) => {
  const d = parseDateLike(v);
  if (!d) return "-";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const clampNumber = (v, min, max) => {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
};

const channelLabel = (key) => CHANNELS.find((c) => c.key === key)?.label ?? key;
const SELLER_DISPLAY_ALIASES = {
  랜식: "랜식(글핏몰)",
  글핏몰: "랜식(글핏몰)",
  글루코핏: "랜식(글핏몰)",
  글루어트: "랜식(글핏몰)",
  닥터다이어리: "닥터다이어리(닥다몰)",
  닥다몰: "닥터다이어리(닥다몰)",
  무화당: "닥터다이어리(무화당)",
};
const SELLER_DB_ALIASES = {
  "랜식(글핏몰)": ["글루코핏", "랜식", "글핏몰", "글루어트"],
  "닥터다이어리(닥다몰)": ["닥다몰", "닥터다이어리"],
  "닥터다이어리(무화당)": ["무화당"],
};
const NAVER_FIXED_SELLER_DEFS = [
  { label: "닥터다이어리(닥다몰)", keys: ["닥다몰"] },
  { label: "랜식(글핏몰)", keys: ["랜식", "글핏몰", "글루코핏", "글루어트"] },
  { label: "레디투힐", keys: ["레디투힐"] },
  { label: "메디프라", keys: ["메디프라"] },
  { label: "필라이즈", keys: ["필라이즈"] },
];
const NAVER_FIXED_SELLER_LABELS = NAVER_FIXED_SELLER_DEFS.map((def) => def.label);
const FIXED_MAJOR_CHANNELS = new Set(["naver", "coupang"]);
const NAVER_FIXED_SELLER_DEFAULT = {
  currentConsideredUnitPrice: null,
  last7dRange: 0,
  belowCount: 0,
  min_price_7d: null,
  max_price_7d: null,
  priceDrop: 0,
};
const getSellerDisplayAlias = (name) =>
  SELLER_DISPLAY_ALIASES[String(name || "").trim()] || String(name || "").trim();
const getSellerDataKeys = (displayName) => {
  const legacy = SELLER_DB_ALIASES[displayName];
  if (Array.isArray(legacy)) {
    return Array.from(new Set([displayName, ...legacy]));
  }
  if (legacy) return [displayName, legacy];
  return [displayName];
};
const getNaverTrendValueKeys = (displayName) => {
  const fixedDef = NAVER_FIXED_SELLER_DEFS.find((def) => def.label === displayName);
  if (fixedDef) {
    return Array.from(new Set([displayName, ...fixedDef.keys, ...getSellerDataKeys(displayName)]));
  }
  return getSellerDataKeys(displayName);
};
const displaySellerName = (channel, sellerName) => {
  const name = String(sellerName || "").trim();
  if (channel === "naver" && name === "네이버") return "최저가비교";
  return getSellerDisplayAlias(name) || "알 수 없음";
};

// -----------------------------
// UI Primitives (no external UI lib)
// -----------------------------

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm border transition ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ title, right, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-900">{title}</div>
          <div>{right}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition-all ${highlight ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Table({ columns, rows, emptyText = "데이터가 없습니다.", pageSize = 0 }) {
  const [page, setPage] = useState(0);
  const isPaged = pageSize > 0 && rows.length > pageSize;
  const totalPages = isPaged ? Math.ceil(rows.length / pageSize) : 1;
  const displayRows = isPaged ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows;

  // 필터 등으로 rows가 바뀌면 첫 페이지로 리셋
  useEffect(() => { setPage(0); }, [rows.length]);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 text-left font-medium">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              displayRows.map((r) => (
                <tr key={r.__rowKey} className="border-t border-slate-100">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className="px-4 py-3 align-top text-slate-800"
                    >
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isPaged && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(0)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            «
          </button>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span className="px-3 text-sm text-slate-600">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            »
          </button>
          <span className="ml-2 text-xs text-slate-400">총 {rows.length}건</span>
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const cls =
    tone === "danger"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : tone === "ok"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        disabled
          ? "bg-slate-200 text-slate-500"
          : "bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-4 py-2 text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
    >
      {children}
    </button>
  );
}

function HeaderNavButton({ active = false, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 min-w-[112px] rounded-xl border px-3 py-2 text-sm font-semibold leading-tight transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <span className="block text-center whitespace-pre-line break-words">
        {children}
      </span>
    </button>
  );
}

// -----------------------------
// Charts
// -----------------------------

function PriceTrend({ mode, data, malls = [], height = 240 }) {
  // mode: "daily" | "monthly"
  const label = mode === "daily" ? "일별" : "월별";

  // 판매처별 색상
  const mallColors = [
    "#10b981",
    "#f59e0b",
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];

  // 판매처 목록이 있으면 사용, 없으면 기본 데이터의 키 추출
  const displayMalls =
    malls.length > 0
      ? malls
      : data.length > 0
        ? Object.keys(data[0]).filter((k) => k !== "x" && k !== "date")
        : [];

  return (
    <div className="h-[260px]">
      <div className="mb-2 text-sm text-slate-500">
        표시 기준: {label} · 값:{" "}
        {malls.length > 0 ? "판매처별 최저가" : "채널별 대표 판매가(예시)"}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[75000, 100000]}
            ticks={[75000, 80000, 85000, 90000, 95000, 100000]}
            tickFormatter={(value) => value.toLocaleString("ko-KR")}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;

              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    {label}
                  </div>
                  <div className="space-y-1">
                    {payload
                      .filter((p) => p.value != null)
                      .map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              style={{
                                width: "12px",
                                height: "2px",
                                backgroundColor: entry.color,
                              }}
                            />
                            <span className="text-slate-600">{entry.name}</span>
                          </div>
                          <span className="font-semibold text-slate-900">
                            {formatKRW(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }}
          />
          <Legend
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              return (
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        style={{
                          width: "16px",
                          height: "2px",
                          backgroundColor: entry.color,
                        }}
                      />
                      <span className="text-sm text-slate-600">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {displayMalls.map((mall, index) => (
            <Line
              key={mall}
              type="monotone"
              dataKey={mall}
              name={getSellerDisplayAlias(mall)}
              stroke={mallColors[index % mallColors.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyBars({ data, channelKey, height = 240 }) {
  return (
    <div className="h-[260px]">
      <div className="mb-2 text-sm text-slate-500">
        표시 기준: 월별 · 값: 채널({channelLabel(channelKey)}) 대표 판매가(예시)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={[75000, 100000]} />
          <Tooltip formatter={(v) => formatKRW(Number(v))} />
          <Bar dataKey={channelKey} name={channelLabel(channelKey)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 판매처별 색상 팔레트
const SELLER_COLORS = [
  "#10b981", // 초록색
  "#ef4444", // 빨간색
  "#3b82f6", // 파란색
  "#f59e0b", // 주황색
  "#8b5cf6", // 보라색
  "#ec4899", // 핑크색
  "#06b6d4", // 청록색
  "#84cc16", // 라임색
];

function SellerPriceTrend({ mode, sellers, channelKey, height = 240 }) {
  // mode: "daily" | "monthly"
  const label = mode === "daily" ? "일별" : "월별";

  // 판매처별 데이터를 하나의 데이터셋으로 통합
  const dataSource =
    mode === "daily"
      ? SAMPLE_SELLER_DAILY_DATA[channelKey] || {}
      : SAMPLE_SELLER_MONTHLY_DATA[channelKey] || {};

  // 모든 날짜/월을 수집
  const allDates = new Set();
  sellers.forEach((seller) => {
    const sellerData = dataSource[seller.seller] || [];
    sellerData.forEach((d) => allDates.add(d.x));
  });
  const sortedDates = Array.from(allDates).sort();

  // 통합 데이터 생성
  const chartData = sortedDates.map((date) => {
    const point = { x: date };
    sellers.forEach((seller) => {
      const sellerData = dataSource[seller.seller] || [];
      const dataPoint = sellerData.find((d) => d.x === date);
      point[seller.seller] = dataPoint ? dataPoint.price : null;
    });
    return point;
  });

  return (
    <div className="h-[260px]">
      <div className="mb-2 text-sm text-slate-500">
        표시 기준: {label} · 값: 판매처별 판매가(예시)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[80000, 95000]}
            ticks={[80000, 85000, 90000, 95000]}
            tickFormatter={(value) => value.toLocaleString("ko-KR")}
          />
          {/* 1,000 단위 점선 구분선 (Y축에 표시되지 않는 값들) */}
          {[
            81000, 82000, 83000, 84000, 86000, 87000, 88000, 89000, 91000,
            92000, 93000, 94000,
          ].map((y) => (
            <ReferenceLine
              key={y}
              y={y}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ))}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;

              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    {label}
                  </div>
                  <div className="space-y-1">
                    {payload
                      .filter((entry) => entry.value !== null)
                      .map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              style={{
                                width: "12px",
                                height: "2px",
                                backgroundColor: entry.color,
                              }}
                            />
                            <span className="text-slate-600">{entry.name}</span>
                          </div>
                          <span className="font-semibold text-slate-900">
                            {formatKRW(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }}
          />
          <Legend
            content={({ payload }) => {
              if (!payload || !payload.length) return null;

              return (
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {payload
                    .filter((entry) => entry.dataKey)
                    .map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          style={{
                            width: "16px",
                            height: "2px",
                            backgroundColor: entry.color,
                          }}
                        />
                        <span className="text-sm text-slate-600">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                </div>
              );
            }}
          />
          {sellers.map((seller, index) => (
            <Line
              key={seller.seller}
              type="monotone"
              dataKey={seller.seller}
              name={seller.seller}
              stroke={SELLER_COLORS[index % SELLER_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SingleSellerPriceTrend({ mode, timeline, sellerName, height = 240 }) {
  // mode: "daily" | "monthly"
  const label = mode === "daily" ? "일별" : "월별";

  // timeline 데이터를 일별/월별로 변환
  const chartData = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];

    if (mode === "daily") {
      // 크롤링 시점별 포인트 생성
      const points = timeline
        .map((item) => {
          const date = parseDateLike(item.capturedAt);
          if (!date) return null;
          const dateKey = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
          const timeKey = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const slotKey = `${dateKey}_${timeKey}`;
          return {
            _ts: date.getTime(),
            dateKey,
            timeKey,
            slotKey,
            price: item.unitPrice,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a._ts - b._ts);

      // 최근 30일분
      const uniqueDates = [...new Set(points.map((p) => p.dateKey))];
      const recent30 = new Set(uniqueDates.slice(-30));
      const filtered = points.filter((p) => recent30.has(p.dateKey));

      // 같은 크롤링 시각(날짜+시:분) 중 최저가만 남기기
      const slotBest = {};
      for (const p of filtered) {
        if (!slotBest[p.slotKey] || p.price < slotBest[p.slotKey].price) {
          slotBest[p.slotKey] = p;
        }
      }
      const bestPoints = Object.values(slotBest).sort((a, b) => a._ts - b._ts);

      return bestPoints.map((p, idx) => ({
        _index: idx,
        x: p.dateKey,
        time: p.timeKey,
        price: p.price,
      }));
    } else {
      // 월별 데이터: capturedAt을 월별로 그룹화하고 평균 계산
      const monthlyMap = {};
      timeline.forEach((item) => {
        const date = parseDateLike(item.capturedAt);
        if (!date) return;
        const monthKey = `${date.getMonth() + 1}월`;

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = [];
        }
        monthlyMap[monthKey].push(item.unitPrice);
      });

      const monthOrder = { "6월": 6, "9월": 9, "10월": 10, "11월": 11 };

      return Object.keys(monthlyMap)
        .sort((a, b) => (monthOrder[a] || 0) - (monthOrder[b] || 0))
        .map((monthKey) => ({
          x: monthKey,
          price: Math.round(
            monthlyMap[monthKey].reduce((a, b) => a + b, 0) /
              monthlyMap[monthKey].length,
          ),
        }));
    }
  }, [timeline, mode]);

  // Y축 범위를 데이터에 따라 동적으로 계산
  const yAxisConfig = useMemo(() => {
    if (chartData.length === 0) {
      return {
        domain: [80000, 90000],
        ticks: [
          80000, 81000, 82000, 83000, 84000, 85000, 86000, 87000, 88000, 89000,
          90000,
        ],
        referenceLines: [],
      };
    }

    const prices = chartData.map((d) => d.price).filter((p) => p !== null);
    if (prices.length === 0) {
      return {
        domain: [80000, 90000],
        ticks: [
          80000, 81000, 82000, 83000, 84000, 85000, 86000, 87000, 88000, 89000,
          90000,
        ],
        referenceLines: [],
      };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    // 여유분 추가 (범위의 10% 또는 최소 2000원)
    const padding = Math.max(range * 0.1, 2000);
    const yMin = Math.max(0, Math.floor((minPrice - padding) / 1000) * 1000);
    const yMax = Math.ceil((maxPrice + padding) / 1000) * 1000;

    // 1000원 단위로 ticks 생성
    const tickStep = Math.max(
      1000,
      Math.ceil((yMax - yMin) / 10 / 1000) * 1000,
    );
    const ticks = [];
    for (let i = yMin; i <= yMax; i += tickStep) {
      ticks.push(i);
    }

    // 500원 단위 점선 생성 (1000원 단위가 아닌 것들만)
    const referenceLines = [];
    for (let i = yMin + 500; i < yMax; i += 500) {
      if (i % 1000 !== 0) {
        referenceLines.push(i);
      }
    }

    return {
      domain: [yMin, yMax],
      ticks,
      referenceLines,
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-500">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-[260px]">
      <div className="mb-2 text-sm text-slate-500">
        표시 기준: {label} · 값: {sellerName} 판매가(예시)
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={mode === "daily" ? "_index" : "x"}
            tick={{ fontSize: 12 }}
            {...(mode === "daily" ? {
              interval: 0,
              tickFormatter: (idx) => {
                const point = chartData[idx];
                if (!point) return "";
                const prev = idx > 0 ? chartData[idx - 1] : null;
                if (!prev || prev.x !== point.x) return point.x;
                return "";
              },
            } : {})}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={yAxisConfig.domain}
            ticks={yAxisConfig.ticks}
            tickFormatter={(value) => value.toLocaleString("ko-KR")}
          />
          {/* 500원 단위 점선 구분선 (Y축에 표시되지 않는 값들) */}
          {yAxisConfig.referenceLines.map((y) => (
            <ReferenceLine
              key={y}
              y={y}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          ))}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    {d.x}{d.time ? ` ${d.time}` : ""}
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-600">{sellerName}</span>
                    <span className="font-semibold text-slate-900">
                      {formatKRW(Number(payload[0].value))}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            name={sellerName}
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// -----------------------------
// Settings Panel
// -----------------------------

function SettingsPanel({
  settings,
  onChange,
  crawlStatus,
  crawlActionLoading,
  onRunCrawl,
}) {
  const { minPrice, maxPrice, threshold, productName } = settings;
  const running = !!crawlStatus?.running;
  const lastStarted = formatDateTimeKST(crawlStatus?.last_started_at);
  const lastFinished = formatDateTimeKST(crawlStatus?.last_finished_at);

  return (
    <Card title="설정" className="h-full">
      <div className="space-y-4">
        <div>
          <div className="text-sm text-slate-600">설정범위</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={minPrice || ""}
              onChange={(e) => {
                const input = e.target.value;
                if (input === "" || /^\d+$/.test(input)) {
                  onChange({
                    ...settings,
                    minPrice: input === "" ? 0 : Number(input),
                  });
                }
              }}
              placeholder="80000"
            />
            <span className="text-slate-400">~</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={maxPrice || ""}
              onChange={(e) => {
                const input = e.target.value;
                if (input === "" || /^\d+$/.test(input)) {
                  onChange({
                    ...settings,
                    maxPrice: input === "" ? 0 : Number(input),
                  });
                }
              }}
              placeholder="700000"
            />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            예: 80,000 ~ 700,000
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-slate-700">기준가(이하)</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              inputMode="numeric"
              value={
                typeof threshold === "string"
                  ? threshold
                  : threshold === 0
                    ? ""
                    : String(threshold)
              }
              onChange={(e) => {
                const input = e.target.value;
                // 숫자만 허용 (빈 문자열도 허용)
                if (input === "" || /^\d+$/.test(input)) {
                  // 입력 중에는 문자열로 유지 (직접 타이핑 가능하도록)
                  onChange({ ...settings, threshold: input });
                }
              }}
              onBlur={(e) => {
                // 포커스를 잃을 때 숫자로 변환
                const input = e.target.value;
                if (input === "") {
                  onChange({ ...settings, threshold: 0 });
                } else {
                  const num = Number(input);
                  if (!isNaN(num)) {
                    onChange({ ...settings, threshold: num });
                  }
                }
              }}
              placeholder="90000"
            />
            <span className="text-sm text-slate-500 whitespace-nowrap">원</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            기준가 이하만 하단 테이블에 표시됩니다.
          </div>
        </div>

        <div>
          <div className="text-sm text-slate-600">검색제품</div>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={productName}
            onChange={(e) =>
              onChange({ ...settings, productName: e.target.value })
            }
          />
          <div className="mt-1 text-xs text-slate-500">
            예: 프리스타일 리브레 2
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="text-sm font-medium text-slate-700">크롤링 실행</div>
          <div className="mt-2">
            <PrimaryButton
              onClick={onRunCrawl}
              disabled={running || crawlActionLoading}
            >
              {running
                ? "크롤링 실행 중..."
                : crawlActionLoading
                  ? "요청 중..."
                  : "지금 크롤링 실행"}
            </PrimaryButton>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            최근 시작: {lastStarted} / 최근 종료: {lastFinished}
          </div>
          {crawlStatus?.last_error && (
            <div className="mt-1 text-xs text-red-600">
              최근 오류: {String(crawlStatus.last_error)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// -----------------------------
// Pages
// -----------------------------

function ImageModal({ open, src, onClose }) {
  if (!open || !src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt="capture enlarged"
          className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-3 -top-3 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function HtmlCardModal({
  open,
  row,
  sellerName,
  onClose,
  onGenerateImage,
  generatingImage = false,
}) {
  if (!open || !row) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">HTML 카드 보기</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[300px_1fr]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img
              src={row.captureThumb || "/placeholder.png"}
              alt="evidence"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-3">
            <div className="text-xl font-bold leading-snug text-slate-900">
              {row.productName || "-"}
            </div>
            <div className="text-sm text-slate-600">판매처: {sellerName || "-"}</div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {Number(row.unitPrice || 0).toLocaleString("ko-KR")}
              </span>
              <span className="pb-1 text-base font-semibold text-slate-500">원/개</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <div className="text-slate-500">총 가격</div>
              <div className="font-semibold text-slate-900">
                {formatKRW(row.price || 0)}
              </div>
              <div className="text-slate-500">수량</div>
              <div className="font-semibold text-slate-900">{row.pack || 0}개</div>
              <div className="text-slate-500">계산 방식</div>
              <div className="font-semibold text-slate-900">{row.calcMethod || "-"}</div>
              <div className="text-slate-500">생성 시각</div>
              <div className="font-semibold text-slate-900">{row.capturedAt || "-"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <a
                href={row.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-slate-700"
              >
                원문 바로가기
              </a>
              <button
                type="button"
                onClick={onGenerateImage}
                disabled={generatingImage || !row.productId}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingImage ? "이미지 생성 중..." : "이미지 생성"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicalSerialModal({
  open,
  serialInput,
  onChangeSerial,
  onOpenLogin,
  onClose,
  onSubmit,
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-slate-900">
          의료기기 페이지 이동
        </div>
        <div className="mt-1 text-sm text-slate-600">
          먼저 로그인 페이지를 열어 로그인한 뒤, 시리얼 페이지 열기를 눌러 주세요.
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          1) 로그인 페이지 열기  2) 시리얼 입력  3) 시리얼 페이지 열기
        </div>
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="시리얼 번호 입력"
          value={serialInput}
          onChange={(e) => onChangeSerial(e.target.value)}
          autoFocus
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <GhostButton onClick={onOpenLogin}>로그인 페이지 열기</GhostButton>
          <GhostButton onClick={onClose}>취소</GhostButton>
          <PrimaryButton onClick={onSubmit}>시리얼 페이지 열기</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function ManualQuantityModal({
  open,
  target,
  quantityInput,
  onChangeQuantity,
  onClose,
  onSubmit,
  submitting = false,
}) {
  if (!open || !target) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-slate-900">수동 수량 확인</div>
        <div className="mt-1 text-sm text-slate-600 line-clamp-2">
          {target.productName || "-"}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          현재 수량: {target.pack || 0}개 / 판매가: {formatKRW(target.price || 0)}
        </div>
        <input
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="확정 수량 입력"
          value={quantityInput}
          onChange={(e) => {
            const input = e.target.value;
            if (input === "" || /^\d+$/.test(input)) onChangeQuantity(input);
          }}
          autoFocus
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <GhostButton onClick={onClose}>취소</GhostButton>
          <PrimaryButton onClick={onSubmit} disabled={submitting || !quantityInput}>
            {submitting ? "저장 중..." : "확정 저장"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function MainDashboard({
  settings,
  safeSettings,
  onChangeSettings,
  crawlStatus,
  crawlActionLoading,
  onRunCrawl,
  onGoChannel,
  onGenerateImage,
  onManualConfirm,
  data,
  offers,
  mallsSummary,
  mallsTop,
}) {
  const [trendMode, setTrendMode] = useState("daily"); // daily/monthly
  const [previewHtmlCard, setPreviewHtmlCard] = useState(null);
  const [htmlGenerating, setHtmlGenerating] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState(null);
  const [manualQtyInput, setManualQtyInput] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all"); // all | naver | coupang | others
  const [offersPage, setOffersPage] = useState(1);
  const OFFERS_PER_PAGE = 20;

  const filteredOffers = useMemo(() => {
    const thr = Number.isFinite(safeSettings.threshold)
      ? safeSettings.threshold
      : Infinity;

    return offers
      .filter((o) => channelFilter === "all" || o.channel === channelFilter)
      .filter((o) => o.unitPrice <= thr)
      .map((o) => ({ ...o, __rowKey: o.id }));
  }, [offers, safeSettings, channelFilter]);

  const totalOffersPages = Math.max(
    1,
    Math.ceil(filteredOffers.length / OFFERS_PER_PAGE),
  );

  const pagedOffers = useMemo(() => {
    const start = (offersPage - 1) * OFFERS_PER_PAGE;
    return filteredOffers.slice(start, start + OFFERS_PER_PAGE);
  }, [filteredOffers, offersPage]);

  const pageNumbers = useMemo(() => {
    const maxVisible = 7;
    if (totalOffersPages <= maxVisible) {
      return Array.from({ length: totalOffersPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, offersPage - 3);
    let end = Math.min(totalOffersPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [offersPage, totalOffersPages]);

  useEffect(() => {
    setOffersPage(1);
  }, [channelFilter, safeSettings.threshold]);

  useEffect(() => {
    if (offersPage > totalOffersPages) {
      setOffersPage(totalOffersPages);
    }
  }, [offersPage, totalOffersPages]);

  const stats = useMemo(() => {
    const thr = Number.isFinite(safeSettings.threshold)
      ? safeSettings.threshold
      : Infinity;

    const byChannel = { naver: 0, coupang: 0, others: 0 };
    let globalMin = Infinity;

    for (const o of offers) {
      if (o.unitPrice <= thr)
        byChannel[o.channel] = (byChannel[o.channel] ?? 0) + 1;
      globalMin = Math.min(globalMin, o.unitPrice);
    }

    const lastCollectedMs = offers.reduce(
      (max, o) =>
        typeof o.capturedAtMs === "number" && o.capturedAtMs > max
          ? o.capturedAtMs
          : max,
      -1,
    );

    return {
      belowTotal: byChannel.naver + byChannel.coupang + byChannel.others,
      belowNaver: byChannel.naver,
      belowCoupang: byChannel.coupang,
      belowOthers: byChannel.others,
      minUnitPrice: globalMin === Infinity ? null : globalMin,
      lastCollected:
        lastCollectedMs > 0 ? formatDateTimeKST(lastCollectedMs) : "-",
    };
  }, [offers, safeSettings.threshold]);

  const columns = [
    {
      key: "channel",
      header: "채널",
      render: (r) => (
        <span className="font-medium">{channelLabel(r.channel)}</span>
      ),
    },
    {
      key: "seller",
      header: "판매처",
      render: (r) => displaySellerName(r.channel, r.seller),
    },
    { key: "productName", header: "상품명" },
    {
      key: "price",
      header: "판매가",
      render: (r) => (
        <div className="space-y-1">
          <div>{formatKRW(r.price)}</div>
          <div className="text-xs text-slate-500">{r.pack}개</div>
        </div>
      ),
    },
    {
      key: "unitPrice",
      header: "단가(1개)",
      render: (r) => {
        const thr = Number.isFinite(safeSettings.threshold)
          ? safeSettings.threshold
          : Infinity;
        const diff = thr - r.unitPrice;
        const needsCheck =
          r.calcMethod === "확인필요" ||
          r.calcMethod === "가격역산(보정)" ||
          r.calcMethod === "텍스트분석(범위초과)";
        return (
          <div className="space-y-1">
            <div className="font-semibold">{formatKRW(r.unitPrice)}</div>
            {needsCheck && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="warning">⚠ 수동확인</Badge>
                  <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {r.calcMethod === "가격역산(보정)"
                      ? "수량추정"
                      : r.calcMethod === "텍스트분석(범위초과)"
                        ? "범위초과"
                        : "확인필요"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualTarget(r);
                      setManualQtyInput(String(r.pack || ""));
                      setManualModalOpen(true);
                    }}
                    className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    수량확정
                  </button>
                </div>
              </div>
            )}
            {Number.isFinite(diff) && diff >= 0 ? (
              <div className="text-xs">
                <Badge tone="danger">기준가 이하</Badge>
                <span className="ml-2 text-slate-500">-{formatKRW(diff)}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">-</div>
            )}
          </div>
        );
      },
    },
    {
      key: "url",
      header: "사이트 링크",
      render: (r) => (
        <a
          className="text-slate-900 underline"
          href={r.url}
          target="_blank"
          rel="noreferrer"
        >
          링크
        </a>
      ),
    },
    { key: "capturedAt", header: "확인 시간" },
    {
      key: "captureThumb",
      header: "사이트 화면",
      render: (r) => (
        <button
          type="button"
          onClick={() => setPreviewHtmlCard(r)}
          className="inline-flex rounded-md border border-slate-200 bg-white p-1 hover:bg-slate-50"
        >
          <img
            src={r.captureThumb || "/placeholder.png"}
            alt={`${displaySellerName(r.channel, r.seller)} 썸네일`}
            className="h-12 w-16 rounded object-cover"
            loading="lazy"
          />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ManualQuantityModal
        open={manualModalOpen}
        target={manualTarget}
        quantityInput={manualQtyInput}
        onChangeQuantity={setManualQtyInput}
        submitting={manualSubmitting}
        onSubmit={async () => {
          const qty = Number(manualQtyInput);
          if (!Number.isFinite(qty) || qty <= 0) {
            window.alert("수량은 1 이상의 숫자로 입력해 주세요.");
            return;
          }
          if (!manualTarget?.productId) return;
          setManualSubmitting(true);
          const result = await onManualConfirm(manualTarget.productId, qty);
          if (!result?.updated && result?.message) {
            window.alert(`수동확인 저장 실패: ${result.message}`);
          } else {
            setManualModalOpen(false);
            setManualTarget(null);
            setManualQtyInput("");
          }
          setManualSubmitting(false);
        }}
        onClose={() => {
          if (manualSubmitting) return;
          setManualModalOpen(false);
          setManualTarget(null);
          setManualQtyInput("");
        }}
      />
      <HtmlCardModal
        open={!!previewHtmlCard}
        row={previewHtmlCard}
        sellerName={
          previewHtmlCard
            ? displaySellerName(
                previewHtmlCard.channel,
                previewHtmlCard.seller || "-",
              )
            : "-"
        }
        generatingImage={htmlGenerating}
        onGenerateImage={async () => {
          if (!previewHtmlCard?.productId) return;
          setHtmlGenerating(true);
          const res = await onGenerateImage(previewHtmlCard.productId);
          if (!res?.card_image_path && res?.message) {
            window.alert(`이미지 생성 실패: ${res.message}`);
          }
          setHtmlGenerating(false);
        }}
        onClose={() => {
          setPreviewHtmlCard(null);
          setHtmlGenerating(false);
        }}
      />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <SettingsPanel
            settings={settings}
            onChange={onChangeSettings}
            crawlStatus={crawlStatus}
            crawlActionLoading={crawlActionLoading}
            onRunCrawl={onRunCrawl}
          />
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card
            title="채널별 판매가"
            right={
              <div className="flex items-center gap-2">
                <Chip
                  active={trendMode === "daily"}
                  onClick={() => setTrendMode("daily")}
                >
                  일별
                </Chip>
                <Chip
                  active={trendMode === "monthly"}
                  onClick={() => setTrendMode("monthly")}
                >
                  월별
                </Chip>
              </div>
            }
          >
            <PriceTrend
              mode={trendMode}
              data={trendMode === "daily" ? data.daily : data.monthly}
              malls={data.malls || []}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <Chip
                  key={c.key}
                  active={false}
                  onClick={() => c.active && onGoChannel(c.key)}
                >
                  {c.label} 주요 셀러 보기
                  {!c.active && (
                    <span className="ml-1 text-xs text-slate-400">
                      (준비중)
                    </span>
                  )}
                </Chip>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div
          className="col-span-12 md:col-span-3 cursor-pointer"
          onClick={() => setChannelFilter("all")}
        >
          <Stat
            label="기준가 이하(전체)"
            value={`${stats.belowTotal}곳`}
            sub={`마지막 수집: ${stats.lastCollected}`}
            highlight={channelFilter === "all"}
          />
        </div>
        <div
          className="col-span-12 md:col-span-3 cursor-pointer"
          onClick={() => setChannelFilter("naver")}
        >
          <Stat
            label="네이버"
            value={`${stats.belowNaver}곳`}
            highlight={channelFilter === "naver"}
          />
        </div>
        <div
          className="col-span-12 md:col-span-3 cursor-pointer"
          onClick={() => setChannelFilter("coupang")}
        >
          <Stat
            label="쿠팡"
            value={`${stats.belowCoupang}곳`}
            highlight={channelFilter === "coupang"}
          />
        </div>
        <div
          className="col-span-12 md:col-span-3 cursor-pointer"
          onClick={() => setChannelFilter("others")}
        >
          <Stat
            label="기타"
            value={`${stats.belowOthers}곳`}
            highlight={channelFilter === "others"}
          />
        </div>
      </div>

      <Card
        title={`기준가 이하 판매처${channelFilter !== "all" ? ` (${channelFilter === "naver" ? "네이버" : channelFilter === "coupang" ? "쿠팡" : "기타"})` : ""}`}
        right={
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div>
              기준가:{" "}
              <span className="font-semibold text-slate-900">
                {formatKRW(safeSettings.threshold)}
              </span>
            </div>
            <div>
              페이지:{" "}
              <span className="font-semibold text-slate-900">
                {offersPage} / {totalOffersPages}
              </span>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs disabled:opacity-50"
              disabled={offersPage <= 1}
              onClick={() => setOffersPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            {pageNumbers[0] > 1 && (
              <>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => setOffersPage(1)}
                >
                  1
                </button>
                {pageNumbers[0] > 2 && <span className="text-xs">...</span>}
              </>
            )}
            {pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${
                  offersPage === pageNum
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200"
                }`}
                onClick={() => setOffersPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalOffersPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalOffersPages - 1 && (
                  <span className="text-xs">...</span>
                )}
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => setOffersPage(totalOffersPages)}
                >
                  {totalOffersPages}
                </button>
              </>
            )}
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs disabled:opacity-50"
              disabled={offersPage >= totalOffersPages}
              onClick={() => setOffersPage((p) => Math.min(totalOffersPages, p + 1))}
            >
              다음
            </button>
          </div>
        }
      >
        <Table columns={columns} rows={pagedOffers} />
      </Card>
    </div>
  );
}

function ChannelSellers({
  channelKey,
  settings,
  onBack,
  onSelectSeller,
  mallsSummary: parentMallsSummary,
  mallsTrends: parentMallsTrends,
  offers = [],
}) {
  const [mode, setMode] = useState("daily");
  const [marketFilter, setMarketFilter] = useState("all");
  const [channelSummary, setChannelSummary] = useState(null);
  const [channelTrends, setChannelTrends] = useState(null);

  // 채널별 데이터 로드 (naver는 부모에서 받은 데이터 사용, coupang은 별도 fetch)
  useEffect(() => {
    // 모든 채널은 channel 파라미터로 전용 summary/trends를 조회한다.
    // 네이버를 부모 공용 trends로 쓰면 채널 혼합/추적몰 제한 영향으로 라인이 일부만 보일 수 있다.
    async function loadChannelData() {
      const [summary, trends] = await Promise.all([
        fetchTrackedMallsSummary(channelKey),
        fetchTrackedMallsTrends(90, channelKey),
      ]);
      setChannelSummary(summary || parentMallsSummary);
      setChannelTrends(trends || parentMallsTrends);
    }
    loadChannelData();
  }, [channelKey, parentMallsSummary, parentMallsTrends]);

  const mallsSummary = channelSummary;
  const mallsTrends = channelTrends;

  // API 데이터가 있으면 사용, 없으면 offers에서 동적 추출
  const sellers = useMemo(() => {
    // 네이버: tracked-malls summary API 데이터 사용
    if (channelKey === "naver" && mallsSummary?.data?.length > 0) {
      const summarySellers = mallsSummary.data.map((mall) => ({
        seller: mall.mall_name,
        currentConsideredUnitPrice: mall.current_price,
        last7dRange: mall.change_7d || 0,
        belowCount: mall.below_target_count || 0,
        min_price_7d: mall.min_price_7d,
        max_price_7d: mall.max_price_7d,
        priceDrop: Math.max(
          0,
          (Number(mall.max_price_7d) || Number(mall.current_price) || 0) -
            (Number(mall.current_price) || 0),
        ),
      }));

      // 주요 4개 외의 네이버 셀러도 항상 보이도록 offers 기반 동적 셀러를 병합한다.
      const threshold = Number(settings.threshold) || Infinity;
      const naverOfferMap = new Map();
      offers
        .filter((o) => o.channel === "naver")
        .forEach((o) => {
          const name = (o.seller || "").trim();
          if (!name || name === "-") return;
          if (!naverOfferMap.has(name)) {
            naverOfferMap.set(name, { prices: [], belowCount: 0 });
          }
          const entry = naverOfferMap.get(name);
          entry.prices.push(o.unitPrice || 0);
          if (o.unitPrice <= threshold) entry.belowCount++;
        });

      const offerSellers = Array.from(naverOfferMap.entries()).map(([name, data]) => {
        const prices = data.prices.filter((p) => p > 0);
        const currentPrice = prices[prices.length - 1] || 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        return {
          seller: name,
          currentConsideredUnitPrice: currentPrice,
          last7dRange: maxPrice - minPrice,
          belowCount: data.belowCount,
          min_price_7d: minPrice,
          max_price_7d: maxPrice,
          priceDrop: Math.max(0, maxPrice - currentPrice),
        };
      });

      const mergedByDisplayName = new Map();
      [...summarySellers, ...offerSellers].forEach((seller) => {
        const displayName = displaySellerName(channelKey, seller.seller);
        if (!displayName) return;
        if (!mergedByDisplayName.has(displayName)) {
          mergedByDisplayName.set(displayName, seller);
          return;
        }
        const prev = mergedByDisplayName.get(displayName);
        if ((seller.priceDrop || 0) > (prev.priceDrop || 0)) {
          mergedByDisplayName.set(displayName, seller);
        }
      });
      return Array.from(mergedByDisplayName.values());
    }

    // API 데이터 없으면 offers에서 해당 채널의 판매처를 동적 추출
    const channelOffers = offers.filter((o) => o.channel === channelKey);
    if (channelOffers.length > 0) {
      const sellerMap = new Map();
      const threshold = Number(settings.threshold) || Infinity;

      channelOffers.forEach((o) => {
        const name = (o.seller || "").trim();
        if (!name || name === "-") return;
        if (!sellerMap.has(name)) {
          sellerMap.set(name, { prices: [], belowCount: 0 });
        }
        const entry = sellerMap.get(name);
        entry.prices.push(o.unitPrice || 0);
        if (o.unitPrice <= threshold) entry.belowCount++;
      });

      return Array.from(sellerMap.entries())
        .map(([name, data]) => {
          const prices = data.prices.filter((p) => p > 0);
          const currentPrice = prices[prices.length - 1] || 0;
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
          return {
            seller: name,
            currentConsideredUnitPrice: currentPrice,
            last7dRange: maxPrice - minPrice,
            belowCount: data.belowCount,
            min_price_7d: minPrice,
            max_price_7d: maxPrice,
            priceDrop: Math.max(0, maxPrice - currentPrice),
          };
        })
        .sort(
          (a, b) => a.currentConsideredUnitPrice - b.currentConsideredUnitPrice,
        );
    }

    return SAMPLE_SELLERS[channelKey] ?? [];
  }, [channelKey, mallsSummary, offers, settings.threshold]);

  const markets = MARKET_BY_CHANNEL[channelKey] ?? [];

  const filteredSellers = useMemo(() => {
    // MVP에서는 marketFilter를 셀러명/채널로만 단순 적용(실데이터 연결 시 판매처의 마켓 정보로 필터)
    if (marketFilter === "all") return sellers;
    return sellers.filter((s) => s.seller.includes(marketFilter));
  }, [sellers, marketFilter]);

  const dedupedDisplaySellers = useMemo(() => {
    const map = new Map();
    filteredSellers.forEach((seller) => {
      const displayName = displaySellerName(channelKey, seller.seller);
      if (!displayName) return;
      const prev = map.get(displayName);
      if (!prev) {
        map.set(displayName, seller);
        return;
      }
      // 같은 표시명(예: 글루어트/글루코핏)이 섞여 들어오는 경우 하락폭이 큰 값을 우선 사용
      if ((seller.priceDrop || 0) > (prev.priceDrop || 0)) {
        map.set(displayName, seller);
      }
    });
    return Array.from(map.values());
  }, [filteredSellers, channelKey]);

  const fixedMajorSellers = useMemo(() => {
    if (!FIXED_MAJOR_CHANNELS.has(channelKey)) return [];
    return NAVER_FIXED_SELLER_DEFS
      .map((def) => {
        const matched = dedupedDisplaySellers.find((seller) => {
          const raw = String(seller.seller || "").trim();
          const display = displaySellerName(channelKey, seller.seller);
          return (
            display === def.label ||
            raw === def.label ||
            def.keys.some((key) => key === raw || key === display)
          );
        });
        if (matched) return { ...matched, __fixedLabel: def.label };
        // 고정 셀러는 데이터가 없어도 카드 슬롯을 유지해 항상 6개를 보여준다.
        return {
          seller: def.label,
          __fixedLabel: def.label,
          ...NAVER_FIXED_SELLER_DEFAULT,
        };
      })
      .filter(Boolean);
  }, [channelKey, dedupedDisplaySellers]);

  const otherNaverSellers = useMemo(() => {
    if (channelKey !== "naver") return [];
    const fixedKeySet = new Set(
      NAVER_FIXED_SELLER_DEFS.flatMap((def) => [
        String(def.label).trim(),
        ...def.keys.map((k) => String(k).trim()),
      ]),
    );
    return dedupedDisplaySellers
      .filter((seller) => {
        const raw = String(seller.seller || "").trim();
        const display = displaySellerName(channelKey, seller.seller);
        return !fixedKeySet.has(raw) && !fixedKeySet.has(display);
      })
      .sort((a, b) => {
        // 말썽 판매처(기준가 이하 발생 횟수 많은 곳)를 우선 노출한다.
        const troubleDiff = (b.belowCount || 0) - (a.belowCount || 0);
        if (troubleDiff !== 0) return troubleDiff;
        const dropDiff = (b.priceDrop || 0) - (a.priceDrop || 0);
        if (dropDiff !== 0) return dropDiff;
        return (a.currentConsideredUnitPrice || 0) - (b.currentConsideredUnitPrice || 0);
      });
  }, [channelKey, dedupedDisplaySellers]);

  const majorSellerTrend = useMemo(() => {
    if (!FIXED_MAJOR_CHANNELS.has(channelKey) || !mallsTrends?.data?.length) {
      return { data: [], malls: [] };
    }
    const mappedRows = (mallsTrends.data || []).map((row) => {
      const x = row?.x || row?.date;
      const mapped = { x };
      NAVER_FIXED_SELLER_DEFS.forEach((def) => {
        const valueKeys = Array.from(new Set([def.label, ...def.keys]));
        const values = valueKeys
          .map((key) => row?.[key])
          .filter((v) => typeof v === "number" && !Number.isNaN(v));
        mapped[def.label] = values.length > 0 ? Math.min(...values) : null;
      });
      return mapped;
    });
    return {
      data: buildContinuousMallTrendData(
        mappedRows,
        NAVER_FIXED_SELLER_LABELS,
      ),
      malls: NAVER_FIXED_SELLER_LABELS,
    };
  }, [channelKey, mallsTrends]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">주요 셀러</div>
          <div className="text-2xl font-semibold text-slate-900">
            {channelLabel(channelKey)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={onBack}>← 메인으로</GhostButton>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <Card title="필터">
            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-600">마켓</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip
                    active={marketFilter === "all"}
                    onClick={() => setMarketFilter("all")}
                  >
                    전체
                  </Chip>
                  {markets.map((m) => (
                    <Chip
                      key={m}
                      active={marketFilter === m}
                      onClick={() => setMarketFilter(m)}
                    >
                      {m}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600">그래프</div>
                <div className="mt-2 flex gap-2">
                  <Chip
                    active={mode === "daily"}
                    onClick={() => setMode("daily")}
                  >
                    일별
                  </Chip>
                  <Chip
                    active={mode === "monthly"}
                    onClick={() => setMode("monthly")}
                  >
                    월별
                  </Chip>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                기준가 이하:{" "}
                <span className="font-semibold">
                  {mallsSummary?.target_price
                    ? formatKRW(mallsSummary.target_price)
                    : settings.threshold === ""
                      ? "-"
                      : formatKRW(Number(settings.threshold) || 0)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card title="채널 판매가 추이">
            {FIXED_MAJOR_CHANNELS.has(channelKey) ? (
              <PriceTrend
                mode={mode}
                data={majorSellerTrend.data}
                malls={NAVER_FIXED_SELLER_LABELS}
              />
            ) : mallsTrends?.data?.length > 0 ? (
              <PriceTrend
                mode={mode}
                data={buildContinuousMallTrendData(
                  mallsTrends.data,
                  mallsTrends.malls || [],
                )}
                malls={mallsTrends.malls || []}
              />
            ) : (
              <SellerPriceTrend
                mode={mode}
                sellers={filteredSellers}
                channelKey={channelKey}
              />
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {(FIXED_MAJOR_CHANNELS.has(channelKey)
          ? fixedMajorSellers
          : dedupedDisplaySellers).map((s) => (
          <button
            key={s.seller}
            type="button"
            className="col-span-12 md:col-span-6 lg:col-span-3 text-left"
            onClick={() => onSelectSeller(s.seller)}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
              <div className="text-sm text-slate-500">판매처</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {s.__fixedLabel || displaySellerName(channelKey, s.seller)}
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">현재 단가(최근 수집값)</span>
                  <span className="font-semibold">
                    {formatKRW(s.currentConsideredUnitPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">최근 7일 변동폭</span>
                  <span>{formatKRW(s.last7dRange)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">기준가 이하 횟수</span>
                  <span>
                    {s.belowCount > 0 ? (
                      <Badge tone="danger">{s.belowCount}회</Badge>
                    ) : (
                      <Badge tone="ok">0회</Badge>
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-sm font-semibold text-slate-900 underline">
                  세부 보기
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {channelKey === "naver" && (
        <>
          <div className="pt-1">
            <div className="text-sm text-slate-500">기타 네이버 판매처 (가격 하락순)</div>
          </div>
          <div className="grid grid-cols-12 gap-4">
            {otherNaverSellers.map((s) => (
              <button
                key={`other-${s.seller}`}
                type="button"
                className="col-span-12 md:col-span-6 lg:col-span-3 text-left"
                onClick={() => onSelectSeller(s.seller)}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
                  <div className="text-sm text-slate-500">판매처</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {displaySellerName(channelKey, s.seller)}
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">현재 단가(최근 수집값)</span>
                      <span className="font-semibold">
                        {formatKRW(s.currentConsideredUnitPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">최근 7일 변동폭</span>
                      <span>{formatKRW(s.last7dRange)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">기준가 이하 횟수</span>
                      <span>
                        {s.belowCount > 0 ? (
                          <Badge tone="danger">{s.belowCount}회</Badge>
                        ) : (
                          <Badge tone="ok">0회</Badge>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-sm font-semibold text-slate-900 underline">
                      세부 보기
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SellerDetail({
  channelKey,
  sellerName,
  settings,
  onBackToChannel,
  onManualConfirm,
}) {
  const [mode, setMode] = useState("daily");
  const [previewImage, setPreviewImage] = useState(null);
  const [previewHtmlCard, setPreviewHtmlCard] = useState(null);
  const [htmlGenerating, setHtmlGenerating] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState(null);
  const [manualQtyInput, setManualQtyInput] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTime, setFilterTime] = useState("all");
  const [filterPack, setFilterPack] = useState("all");

  // API에서 셀러 타임라인 데이터 로드
  useEffect(() => {
    async function loadTimeline() {
      setTimelineLoading(true);
      const result = await fetchMallTimeline(sellerName, 30, channelKey);
      if (result.data && result.data.length > 0) {
        setTimelineData(result.data);
      } else {
        // API 데이터 없으면 Mock 폴백
        const key = `${channelKey}::${sellerName}`;
        setTimelineData(SAMPLE_SELLER_TIMELINE[key] ?? []);
      }
      setTimelineLoading(false);
    }
    loadTimeline();
  }, [channelKey, sellerName]);

  const timeline = timelineData;

  const sellerAvg = useMemo(() => {
    if (!timeline.length) return null;
    const sum = timeline.reduce((acc, t) => acc + (t.unitPrice ?? 0), 0);
    return Math.round(sum / timeline.length);
  }, [timeline]);

  // 시간/수량 필터 + 기준가 이하 필터링
  const filteredTimeline = useMemo(() => {
    const thr =
      typeof settings.threshold === "string" && settings.threshold === ""
        ? Infinity
        : Number(settings.threshold) || Infinity;
    return timeline.filter((t) => {
      if (t.unitPrice > thr) return false;
      if (filterTime !== "all") {
        const hour = t.time ? t.time.split(":")[0] : null;
        if (hour !== filterTime) return false;
      }
      if (filterPack !== "all") {
        if (t.pack !== Number(filterPack)) return false;
      }
      return true;
    });
  }, [timeline, settings.threshold, filterTime, filterPack]);

  // 그래프용 데이터: 필터 미적용 시 일별 최저가, 필터 적용 시 필터된 전체
  const chartTimeline = useMemo(() => {
    const isFiltered = filterTime !== "all" || filterPack !== "all";
    if (isFiltered) return filteredTimeline;
    // 필터 없을 때: 일별 최저가만
    const dailyBest = {};
    for (const t of timeline) {
      const dateKey = t.date || (t.capturedAt ? t.capturedAt.slice(0, 10) : "");
      if (!dailyBest[dateKey] || t.unitPrice < dailyBest[dateKey].unitPrice) {
        dailyBest[dateKey] = t;
      }
    }
    return Object.values(dailyBest).sort((a, b) =>
      (a.capturedAt || "").localeCompare(b.capturedAt || "")
    );
  }, [timeline, filteredTimeline, filterTime, filterPack]);

  const rows = filteredTimeline
    .slice()
    .sort((a, b) => {
      const aMs = parseDateLike(a.capturedAt)?.getTime() ?? 0;
      const bMs = parseDateLike(b.capturedAt)?.getTime() ?? 0;
      return bMs - aMs;
    })
    .map((t, idx) => ({
      ...t,
      productId: t.id ?? null,
      capturedAt: formatDateTimeKST(t.capturedAt),
      __rowKey: `${channelKey}-${sellerName}-${idx}`,
    }));

  const columns = [
    { key: "capturedAt", header: "확인 시간" },
    {
      key: "price",
      header: "판매가",
      render: (r) => (
        <div className="space-y-1">
          <div className="font-medium">{formatKRW(r.price)}</div>
          <div className="text-xs text-slate-500">{r.pack}개</div>
        </div>
      ),
    },
    {
      key: "unitPrice",
      header: "단가(1개)",
      render: (r) => {
        const thr =
          typeof settings.threshold === "string" && settings.threshold === ""
            ? Infinity
            : Number(settings.threshold) || Infinity;
        const diff = thr - r.unitPrice;
        const needsCheck =
          r.calcMethod === "확인필요" ||
          r.calcMethod === "가격역산(보정)" ||
          r.calcMethod === "텍스트분석(범위초과)";
        return (
          <div className="space-y-1">
            <div className="font-semibold">{formatKRW(r.unitPrice)}</div>
            {needsCheck && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2 py-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="warning">⚠ 수동확인</Badge>
                  <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {r.calcMethod === "가격역산(보정)"
                      ? "수량추정"
                      : r.calcMethod === "텍스트분석(범위초과)"
                        ? "범위초과"
                        : "확인필요"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualTarget(r);
                      setManualQtyInput(String(r.pack || ""));
                      setManualModalOpen(true);
                    }}
                    className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    수량확정
                  </button>
                </div>
              </div>
            )}
            {diff >= 0 ? (
              <div className="text-xs">
                <Badge tone="danger">기준가 이하</Badge>
                <span className="ml-2 text-slate-500">-{formatKRW(diff)}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">-</div>
            )}
          </div>
        );
      },
    },
    {
      key: "url",
      header: "링크",
      render: (r) => (
        <a
          className="text-slate-900 underline"
          href={r.url}
          target="_blank"
          rel="noreferrer"
        >
          링크
        </a>
      ),
    },
    {
      key: "captureThumb",
      header: "캡처",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewHtmlCard(r)}
            className="group"
          >
            <img
              src={r.captureThumb}
              alt="capture"
              className="h-12 w-20 rounded-lg object-cover border border-slate-200 group-hover:ring-2 group-hover:ring-slate-400"
            />
          </button>
          <button
            type="button"
            onClick={() => setPreviewHtmlCard(r)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            HTML 카드
          </button>
          <button
            type="button"
            onClick={() => setPreviewImage(r.captureThumb)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            이미지
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ManualQuantityModal
        open={manualModalOpen}
        target={manualTarget}
        quantityInput={manualQtyInput}
        onChangeQuantity={setManualQtyInput}
        submitting={manualSubmitting}
        onSubmit={async () => {
          const qty = Number(manualQtyInput);
          if (!Number.isFinite(qty) || qty <= 0) {
            window.alert("수량은 1 이상의 숫자로 입력해 주세요.");
            return;
          }
          if (!manualTarget?.productId) return;
          setManualSubmitting(true);
          const result = await onManualConfirm(manualTarget.productId, qty);
          if (!result?.updated && result?.message) {
            window.alert(`수동확인 저장 실패: ${result.message}`);
          } else {
            const refreshed = await fetchMallTimeline(sellerName, 30, channelKey);
            if (refreshed?.data) setTimelineData(refreshed.data);
            setManualModalOpen(false);
            setManualTarget(null);
            setManualQtyInput("");
          }
          setManualSubmitting(false);
        }}
        onClose={() => {
          if (manualSubmitting) return;
          setManualModalOpen(false);
          setManualTarget(null);
          setManualQtyInput("");
        }}
      />
      <ImageModal
        open={!!previewImage}
        src={previewImage}
        onClose={() => setPreviewImage(null)}
      />
      <HtmlCardModal
        open={!!previewHtmlCard}
        row={previewHtmlCard}
        sellerName={displaySellerName(channelKey, sellerName)}
        generatingImage={htmlGenerating}
        onGenerateImage={async () => {
          if (!previewHtmlCard?.productId) return;
          setHtmlGenerating(true);
          const res = await generateCardImageOnDemand(previewHtmlCard.productId);
          if (!res?.card_image_path && res?.message) {
            window.alert(`이미지 생성 실패: ${res.message}`);
          }
          setHtmlGenerating(false);
        }}
        onClose={() => {
          setPreviewHtmlCard(null);
          setHtmlGenerating(false);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">세부데이터</div>
          <div className="text-2xl font-semibold text-slate-900">
            {channelLabel(channelKey)} · {displaySellerName(channelKey, sellerName)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={onBackToChannel}>← 셀러 목록</GhostButton>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <Card title="설정">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">채널</span>
                <span className="font-medium">{channelLabel(channelKey)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">판매처</span>
                <span className="font-medium">
                  {displaySellerName(channelKey, sellerName)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">평균 단가</span>
                <span className="font-semibold">
                  {sellerAvg ? formatKRW(sellerAvg) : "-"}
                </span>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                기준가 이하:{" "}
                <span className="font-semibold">
                  {settings.threshold === ""
                    ? "-"
                    : formatKRW(Number(settings.threshold) || 0)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card
            title="판매가 추이"
            right={
              <div className="flex items-center gap-2">
                <Chip
                  active={mode === "daily"}
                  onClick={() => setMode("daily")}
                >
                  일별
                </Chip>
                <Chip
                  active={mode === "monthly"}
                  onClick={() => setMode("monthly")}
                >
                  월별
                </Chip>
              </div>
            }
          >
            <SingleSellerPriceTrend
              mode={mode}
              timeline={chartTimeline}
              sellerName={sellerName}
            />
          </Card>
        </div>
      </div>

      <Card
        title="판매정보 + 캡처본(타임라인)"
        right={
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              filterTime !== "all" || filterPack !== "all"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>필터</span>
            {(filterTime !== "all" || filterPack !== "all") && (
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">
                {(filterTime !== "all" ? 1 : 0) + (filterPack !== "all" ? 1 : 0)}
              </span>
            )}
            <span className="text-xs">{filterOpen ? "▲" : "▼"}</span>
          </button>
        }
      >
        {filterOpen && (
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">시간</span>
              <select
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="all">전체</option>
                {["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"].map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">수량</span>
              <select
                value={filterPack}
                onChange={(e) => setFilterPack(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="all">전체</option>
                {[1,2,3,4,5,6,7].map((n) => (
                  <option key={n} value={n}>{n}개</option>
                ))}
              </select>
            </div>
            {(filterTime !== "all" || filterPack !== "all") && (
              <button
                type="button"
                onClick={() => { setFilterTime("all"); setFilterPack("all"); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
              >
                초기화
              </button>
            )}
            <span className="text-xs text-slate-400">
              {filteredTimeline.length}건
            </span>
          </div>
        )}
        <Table
          columns={columns}
          rows={rows}
          emptyText="기준가 이하 데이터가 없습니다."
          pageSize={20}
        />
      </Card>
    </div>
  );
}

// -----------------------------
// App Shell (simple internal routing)
// -----------------------------

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // 간단 라우팅: "main" | "channel" | "seller"
  const [route, setRoute] = useState({
    page: "main",
    channelKey: "naver",
    sellerName: "",
  });

  const [settings, setSettings] = useState({
    minPrice: 80000,
    maxPrice: 700000,
    threshold: 90000,
    productName: "프리스타일 리브레 2",
    packs: [1, 2, 3, 7],
  });

  // API 데이터 상태
  const [productsData, setProductsData] = useState({
    snapshot_time: null,
    count: 0,
    data: [],
  });
  const [mallsSummary, setMallsSummary] = useState({
    target_price: 90000,
    tracked_malls: [],
    data: [],
  });
  const [mallsTrends, setMallsTrends] = useState({
    days: 7,
    malls: [],
    data: [],
  });
  const [mallsTop, setMallsTop] = useState({ count: 0, data: [] });
  const [loading, setLoading] = useState(true);
  const [crawlActionLoading, setCrawlActionLoading] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState({
    running: false,
    last_started_at: null,
    last_finished_at: null,
    last_error: null,
    timezone: "Asia/Seoul",
  });
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [medicalSerialInput, setMedicalSerialInput] = useState("");
  const wasCrawlRunningRef = useRef(false);

  const handleOpenMedicalDeviceSite = () => {
    setMedicalModalOpen(true);
  };

  const handleOpenMedicalLoginPage = () => {
    window.open(MEDICAL_DEVICE_BASE_URL, "_blank", "noopener,noreferrer");
  };

  const handleSubmitMedicalModal = () => {
    const trimmed = (medicalSerialInput || "").trim();
    const url = trimmed
      ? `${MEDICAL_DEVICE_BASE_URL}?serialNumber=${encodeURIComponent(trimmed)}`
      : MEDICAL_DEVICE_BASE_URL;
    window.open(url, "_blank", "noopener,noreferrer");
    setMedicalModalOpen(false);
    setMedicalSerialInput("");
  };

  const goMainDashboard = () => {
    setRoute((prev) => ({ ...prev, page: "main", sellerName: "" }));
    navigate("/");
  };

  const goChannelPage = (channelKey) => {
    setRoute({ page: "channel", channelKey, sellerName: "" });
    navigate("/");
  };

  const refreshDashboardData = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);

    // config 먼저 로드해서 기준가 설정
    const config = await fetchConfig();
    if (config.target_price) {
      setSettings((prev) => ({ ...prev, threshold: config.target_price }));
    }

    const [products, summary, trends, top] = await Promise.all([
      fetchLatestProducts(),
      fetchTrackedMallsSummary(),
      fetchTrackedMallsTrends(90),
      fetchMallsTop(10),
    ]);
    setProductsData(products);
    setMallsSummary(summary);
    setMallsTrends(trends);
    setMallsTop(top);
    if (showLoader) setLoading(false);
  }, []);

  // API 데이터 로드
  useEffect(() => {
    refreshDashboardData({ showLoader: true });
  }, [refreshDashboardData]);

  useEffect(() => {
    let timer = null;
    const pollStatus = async () => {
      const status = await fetchCrawlStatus();
      setCrawlStatus(status);
      if (wasCrawlRunningRef.current && !status.running) {
        // 크롤링이 끝난 시점에 최신 스냅샷 데이터를 다시 가져와 메인 목록을 교체한다.
        await refreshDashboardData();
      }
      wasCrawlRunningRef.current = Boolean(status.running);
    };
    pollStatus();
    timer = setInterval(pollStatus, 10000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [refreshDashboardData]);

  const handleRunCrawlNow = async () => {
    if (crawlActionLoading || crawlStatus.running) return;
    setCrawlActionLoading(true);
    const result = await runCrawlNow();
    if (result?.status === "started") {
      setCrawlStatus((prev) => ({ ...prev, running: true, last_error: null }));
      wasCrawlRunningRef.current = true;
    }
    const latestStatus = await fetchCrawlStatus();
    setCrawlStatus(latestStatus);
    if (!latestStatus?.running) {
      await refreshDashboardData();
    }
    wasCrawlRunningRef.current = Boolean(latestStatus?.running);
    setCrawlActionLoading(false);
  };

  // 판매처별 추이 데이터 변환 (그래프용)
  const data = useMemo(() => {
    // API 데이터가 있으면 사용, 없으면 Mock 데이터
    if (mallsTrends.data && mallsTrends.data.length > 0) {
      const mallNames = NAVER_FIXED_SELLER_LABELS;

      // API 데이터를 그래프 형식으로 변환 (구이름/신이름 키 모두 대응)
      const daily = mallsTrends.data.map((item) => {
        const dateKey = item.x || item.date;
        const normalized = { x: dateKey };
        mallNames.forEach((mall) => {
          const keys = getNaverTrendValueKeys(mall);
          const value = keys.map((k) => item[k]).find((v) => v != null);
          if (value != null) normalized[mall] = value;
        });
        return normalized;
      });

      // 일별 데이터에서 월별 데이터 자동 집계 (월별 최저가)
      const monthlyMap = {};
      daily.forEach((item) => {
        // x 형식: "02/05" 또는 "2026-02-05"
        let monthKey;
        if (item.x && item.x.includes("/")) {
          monthKey = item.x.split("/")[0] + "월";
        } else if (item.x && item.x.includes("-")) {
          const parts = item.x.split("-");
          monthKey = parseInt(parts[1], 10) + "월";
        } else {
          return;
        }

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {};
        }

        mallNames.forEach((mall) => {
          if (item[mall] != null) {
            if (
              !monthlyMap[monthKey][mall] ||
              item[mall] < monthlyMap[monthKey][mall]
            ) {
              monthlyMap[monthKey][mall] = item[mall]; // 월별 최저가
            }
          }
        });
      });

      const monthly = Object.keys(monthlyMap)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((monthKey) => ({
          x: monthKey,
          ...monthlyMap[monthKey],
        }));

      return { daily, monthly, malls: mallNames };
    }

    // tracked-malls API가 비어 있어도 네이버 고정 5개 판매처 그래프를 표시한다.
    const fallbackMalls = NAVER_FIXED_SELLER_LABELS;
    const toSellerChartData = (sourceByMall) => {
      const xOrder = [];
      const seenX = new Set();

      fallbackMalls.forEach((mall) => {
        const keys = getNaverTrendValueKeys(mall);
        keys.forEach((key) => {
          (sourceByMall[key] || []).forEach((point) => {
            const x = point?.x;
            if (!x || seenX.has(x)) return;
            seenX.add(x);
            xOrder.push(x);
          });
        });
      });

      return xOrder.map((x) => {
        const row = { x };
        fallbackMalls.forEach((mall) => {
          const keys = getNaverTrendValueKeys(mall);
          const point = keys
            .map((key) => (sourceByMall[key] || []).find((p) => p.x === x))
            .find(Boolean);
          row[mall] = point ? point.price : null;
        });
        return row;
      });
    };

    return {
      daily: toSellerChartData(SAMPLE_SELLER_DAILY_DATA.naver || {}),
      monthly: toSellerChartData(SAMPLE_SELLER_MONTHLY_DATA.naver || {}),
      malls: fallbackMalls,
    };
  }, [mallsTrends]);

  // 백엔드 데이터를 프론트엔드 형식으로 변환
  const offers = useMemo(() => {
    if (!productsData.data || productsData.data.length === 0) {
      return [];
    }

    return productsData.data.map((item, index) => {
      const mallName = (item.mall_name || "").trim();
      // 백엔드 channel 필드 우선 사용, 없으면 mall_name 기반 분류
      let channel = item.channel || "naver";
      if (!item.channel || item.channel === "naver") {
        if (mallName === "쿠팡" || (item.link || "").includes("coupang")) {
          channel = "coupang";
        } else if (
          ["11번가", "G마켓", "옥션", "롯데몰"].includes(mallName) ||
          (item.link || "").includes("gmarket") ||
          (item.link || "").includes("auction") ||
          (item.link || "").includes("11st")
        ) {
          channel = "others";
        }
      }
      const market =
        mallName === "쿠팡"
          ? "쿠팡"
          : ["11번가", "G마켓", "옥션"].includes(mallName)
            ? mallName
            : item.market || "스마트스토어";

      return {
        id: `o${index + 1}`,
        productId: item.id ?? null,
        channel: channel,
        market: market,
        seller: item.mall_name || "알 수 없음",
        productName: item.product_name || "",
        pack: item.quantity || 1,
        price: item.total_price || item.unit_price,
        unitPrice: item.unit_price,
        calcMethod: item.calc_method || "텍스트분석",
        url: item.link || "#",
        capturedAt: formatDateTimeKST(item.snapshot_time || productsData.snapshot_time),
        capturedAtMs:
          parseDateLike(item.snapshot_time || productsData.snapshot_time)?.getTime() ??
          0,
        captureThumb: item.image_url || "/placeholder.png",
      };
    });
  }, [productsData]);

  const handleGenerateImageOnDemand = async (productId) => {
    const result = await generateCardImageOnDemand(productId);
    if (result?.card_image_path) {
      setProductsData((prev) => ({
        ...prev,
        data: (prev.data || []).map((it) =>
          it.id === productId
            ? {
                ...it,
                card_image_path: result.card_image_path,
              }
            : it,
        ),
      }));
      // 서버 저장 결과를 다시 읽어와 새로고침 후에도 동일하게 보이도록 동기화
      const latest = await fetchLatestProducts();
      if (latest?.data) {
        setProductsData(latest);
      }
    } else if (result?.message) {
      window.alert(`이미지 생성 실패: ${result.message}`);
    }
    return result;
  };

  const handleManualConfirmQuantity = async (productId, quantity) => {
    const result = await confirmManualQuantity(productId, quantity);
    if (result?.updated) {
      const latest = await fetchLatestProducts();
      if (latest?.data) setProductsData(latest);
    }
    return result;
  };

  // 범위/기준가 유효성 보정(입력 실수 방지)
  const safeSettings = useMemo(() => {
    const min = clampNumber(settings.minPrice, 0, 999999999);
    const max = clampNumber(settings.maxPrice, 0, 999999999);
    const min2 = Math.min(min, max);
    const max2 = Math.max(min, max);
    const thrVal =
      settings.threshold === "" ||
      (typeof settings.threshold === "string" && settings.threshold === "")
        ? 0
        : Number(settings.threshold) || 0;
    const thr = clampNumber(thrVal, min2, max2);
    return { ...settings, minPrice: min2, maxPrice: max2, threshold: thr };
  }, [settings]);

  const header = (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0" onClick={() => { navigate("/"); setRoute({ page: "main", channelKey: "", sellerName: "" }); }}>
            <img
              src="/ADC_Logo_FSL2_YCH_reduced_RGB.png"
              alt="FreeStyle Libre 2"
              className="h-10 object-contain"
            />
            <div className="text-left">
              <div className="text-sm text-slate-500">온라인 모니터링</div>
              <div className="font-semibold text-slate-900">
                Libre2 Price Monitor
              </div>
            </div>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <HeaderNavButton
            onClick={handleOpenMedicalDeviceSite}
          >
            {"의료기기 링크\n(시리얼 입력)"}
          </HeaderNavButton>
          <HeaderNavButton
            active={location.pathname === "/range-report"}
            onClick={() => navigate("/range-report")}
          >
            {"Date Range\nReport"}
          </HeaderNavButton>
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1600px] px-4 py-6 text-xs text-slate-500">
        * 본 화면은 MVP 데모용이며, 실제 크롤링/DB 연동 시 데이터가 실시간
        반영됩니다.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <MedicalSerialModal
        open={medicalModalOpen}
        serialInput={medicalSerialInput}
        onChangeSerial={setMedicalSerialInput}
        onOpenLogin={handleOpenMedicalLoginPage}
        onClose={() => {
          setMedicalModalOpen(false);
          setMedicalSerialInput("");
        }}
        onSubmit={handleSubmitMedicalModal}
      />
      {header}
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <Routes>
          <Route
            path="/"
            element={
              <>
                {route.page === "main" && (
                  <MainDashboard
                    settings={settings}
                    safeSettings={safeSettings}
                    onChangeSettings={setSettings}
                    crawlStatus={crawlStatus}
                    crawlActionLoading={crawlActionLoading}
                    onRunCrawl={handleRunCrawlNow}
                    onGoChannel={(channelKey) =>
                      setRoute({ page: "channel", channelKey, sellerName: "" })
                    }
                    onGenerateImage={handleGenerateImageOnDemand}
                    onManualConfirm={handleManualConfirmQuantity}
                    data={data}
                    offers={offers}
                    mallsSummary={mallsSummary}
                    mallsTop={mallsTop}
                  />
                )}

                {route.page === "channel" && (
                  <ChannelSellers
                    channelKey={route.channelKey}
                    settings={safeSettings}
                    onBack={() =>
                      setRoute({
                        page: "main",
                        channelKey: route.channelKey,
                        sellerName: "",
                      })
                    }
                    onSelectSeller={(sellerName) =>
                      setRoute({
                        page: "seller",
                        channelKey: route.channelKey,
                        sellerName,
                      })
                    }
                    mallsSummary={mallsSummary}
                    mallsTrends={mallsTrends}
                    offers={offers}
                  />
                )}

                {route.page === "seller" && (
                  <SellerDetail
                    channelKey={route.channelKey}
                    sellerName={route.sellerName}
                    settings={safeSettings}
                    onManualConfirm={handleManualConfirmQuantity}
                    onBackToChannel={() =>
                      setRoute({
                        page: "channel",
                        channelKey: route.channelKey,
                        sellerName: "",
                      })
                    }
                  />
                )}
              </>
            }
          />
          <Route
            path="/report"
            element={
              <div className="space-y-3">
                <div className="flex justify-end">
                  <GhostButton onClick={goMainDashboard}>← 메인으로</GhostButton>
                </div>
                <MonthlyReportPage />
              </div>
            }
          />
          <Route
            path="/range-report"
            element={
              <div className="space-y-3">
                <div className="flex justify-end">
                  <GhostButton onClick={goMainDashboard}>← 메인으로</GhostButton>
                </div>
                <RangeReportPage />
              </div>
            }
          />
          <Route
            path="/tracked-report"
            element={
              <div className="space-y-3">
                <div className="flex justify-end">
                  <GhostButton onClick={goMainDashboard}>← 메인으로</GhostButton>
                </div>
                <Report />
              </div>
            }
          />
        </Routes>
      </main>
      {footer}
    </div>
  );
}
