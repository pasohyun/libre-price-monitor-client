# Libre2 Price Monitor (Client)

프리스타일 리브레2 온라인 가격 모니터링 **대시보드 프론트엔드**입니다.
채널(네이버/쿠팡/기타)별 단가 추이, 기준가 이하 판매처 목록, 판매처 상세 타임라인(증빙 캡처), 리포트, 원본 데이터 Export, 알림 설정 화면을 제공합니다.

> 이 저장소는 **UI만** 포함합니다. 데이터는 전부 백엔드 API에서 가져옵니다.
> 백엔드 → `libre2-api` (FastAPI, Railway 배포). 스키마·비즈니스 로직·크롤러는 그쪽 README를 참고하세요.

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [화면 구성 · 라우팅](#2-화면-구성--라우팅)
3. [디렉토리 구조 (파일별 역할)](#3-디렉토리-구조-파일별-역할)
4. [`src/App.jsx` 내부 지도](#4-srcappjsx-내부-지도)
5. [인증 방식](#5-인증-방식)
6. [백엔드 연동](#6-백엔드-연동)
7. [환경 변수](#7-환경-변수)
8. [로컬 개발 · 빌드](#8-로컬-개발--빌드)
9. [배포 (Vercel)](#9-배포-vercel)
10. [알려진 이슈 · 주의사항](#10-알려진-이슈--주의사항)
11. [인수인계 체크리스트](#11-인수인계-체크리스트)

---

## 1. 기술 스택

| 구분 | 사용 기술 | 비고 |
|------|-----------|------|
| UI | **React 19.2** | `react` / `react-dom` |
| 빌드 | **Vite 7** | `@vitejs/plugin-react` |
| 라우팅 | **react-router-dom 7.13** | `BrowserRouter` |
| 차트 | **Recharts 3.6** | LineChart / BarChart |
| 스타일 | **TailwindCSS (CDN)** | ⚠️ 빌드 도구가 아니라 `index.html`의 `cdn.tailwindcss.com` 스크립트로 **런타임 주입**. `tailwind.config.js`·PostCSS 설정 없음 |
| 폰트 | Google Fonts (Inter, Noto Sans KR) | `index.html`에서 로드 |
| 린트 | ESLint 9 (flat config) | `npm run lint` |
| 언어 | JavaScript + TypeScript **혼용** | 메인은 `.jsx`, 리포트 페이지만 `.tsx`. `tsconfig.json`은 `strict: false`, `noEmit`(타입체크 스크립트 없음) |
| 배포 | Vercel | `vercel.json`에 SPA rewrite 설정 |

> Tailwind CDN 방식이라 **인터넷이 끊기거나 CDN이 막히면 스타일이 전부 깨집니다.** 사내망 배포를 고려한다면
> Tailwind를 빌드 타임 의존성으로 전환하는 작업이 선행되어야 합니다.

---

## 2. 화면 구성 · 라우팅

이 앱은 **두 가지 라우팅이 섞여 있습니다.** 인수인계 시 가장 먼저 알아야 할 부분입니다.

### (A) react-router 경로 — URL이 바뀜

| 경로 | 화면 | 컴포넌트 |
|------|------|----------|
| `/` | 메인 대시보드 (아래 B 참고) | `MainDashboard` 외 |
| `/report` | 월간 리포트 | `pages/MonthlyReportPage.tsx` |
| `/range-report` | 기간 리포트 | `pages/RangeReportPage.tsx` |
| `/tracked-report` | 주요 판매처 요약 리포트 | `src/Report.jsx` |
| `/raw-export` | 원본 데이터 엑셀 Export | `pages/RawDataExportPage.jsx` |
| `/alerts` | 알림 설정 | `AlertSettingsPage` (App.jsx 내부) |

### (B) `/` 내부의 상태 기반 화면 전환 — **URL이 바뀌지 않음**

`App()`의 `route` state(`{ page, channelKey, sellerName }`)로 세 화면을 갈아끼웁니다.

```
main (메인 대시보드)
  └─ 채널 카드 클릭 ─▶ channel (채널별 주요 판매처)
                        └─ 판매처 클릭 ─▶ seller (판매처 상세 타임라인)
```

⚠️ 이 세 화면은 URL이 전부 `/`이므로 **브라우저 뒤로가기·새로고침·링크 공유가 동작하지 않습니다.**
화면 내 "← 돌아가기" 버튼으로만 이동합니다. (개선하려면 `/channel/:key`, `/seller/:name` 형태로 라우터에 편입하면 됩니다.)

### 화면별 기능 요약

- **메인 대시보드** — 채널별 단가 추이 그래프(일별/월별 토글), 기준가 이하 판매처 테이블, 캡처 썸네일 확대 모달, 수동 크롤링 실행 버튼 및 진행 상태 표시, 수동 수량 확정, 행 삭제, 운영 메모 보드
- **채널별 주요 판매처** — 채널 선택 후 주요 판매처 카드 리스트, 마켓 필터(쿠팡 로켓배송/마켓플레이스 등)
- **판매처 상세** — 수집 타임라인(확인시각/총가격/단가/링크/증빙 캡처), 일별·월별 그래프, 가격 인사이트(이상탐지·예측), 업체 메모
- **필터 조건** — 단가 범위(min/max), 기준가(threshold), 상품명, 구성옵션(1/2/3/7개입). 기준가 기본값은 백엔드 `/products/config`에서 받아 덮어씀

---

## 3. 디렉토리 구조 (파일별 역할)

```
libre-price-monitor-client/
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx              ★ 대부분의 코드가 여기 있음 (약 7,480줄)
│   ├── Report.jsx
│   ├── api/
│   ├── config/
│   ├── pages/
│   └── assets/
├── public/
└── (설정 파일)
```

### `src/` 소스

| 파일 | 줄수 | 역할 |
|------|------|------|
| `main.jsx` | 15 | 진입점. `BrowserRouter` + `React.StrictMode`로 `App`을 마운트. `index.css` 로드. |
| `App.jsx` | **~7,480** | ★ **사실상 앱 전체.** API 호출 함수 30여 개, 공용 UI 컴포넌트, 차트 컴포넌트, 3개 주요 화면, 메모 보드, 알림 설정 페이지, 라우팅이 **모두 이 한 파일**에 들어 있습니다. 상세 지도는 [4장](#4-srcappjsx-내부-지도) 참고. |
| `Report.jsx` | 200 | `/tracked-report` 화면. 주요 판매처 요약(`/products/tracked-malls/summary`)과 상위 판매처(`/products/malls/top`)를 표로 보여줍니다. App.jsx와 별개로 자체 fetch 함수·판매처명 정규화 로직을 갖고 있습니다(중복). |
| `api/authFetch.ts` | 39 | **인증 처리의 핵심.** localStorage 토큰 get/set/clear, `Authorization: Bearer` 헤더 생성, `authFetch()` 래퍼. **응답이 401이면 토큰을 지우고 `dashboard-auth-expired` 커스텀 이벤트를 발생**시켜 앱이 로그인 화면으로 돌아가게 합니다. |
| `api/reports.ts` | 86 | 리포트 API 클라이언트. `getMonthlyReport()`(월간), `getRangeReport()`(기간). 파라미터 타입 정의 포함. ⚠️ 두 함수의 인증 처리가 다릅니다 — [10장](#10-알려진-이슈--주의사항) 참고. |
| `config/api.ts` | 27 | `API_BASE_URL` 상수. Vite → CRA → Next.js 환경변수 순으로 fallback하고 마지막은 `http://127.0.0.1:8000`. 끝 슬래시 제거. |
| `index.css` | 31 | 전역 스타일(최소한). |
| `App.css` | 21 | 컴포넌트 스타일(거의 미사용, Tailwind 유틸 클래스가 주). |
| `assets/react.svg` | — | Vite 기본 템플릿 잔재. 미사용. |

### `src/pages/`

| 파일 | 줄수 | 역할 |
|------|------|------|
| `MonthlyReportPage.tsx` | 694 | `/report`. 월(YYYY-MM)·기준가·채널·크롤 스케줄·상위 카드 수·LLM 요약 사용 여부를 지정해 월간 리포트를 조회·렌더. |
| `RangeReportPage.tsx` | 1,208 | `/range-report`. 시작일~종료일 임의 기간 리포트. Recharts 그래프 + 미준수 상세 + 증빙 카드 이미지 링크(`API_BASE_URL/{card_image_path}`). 기본 기간은 최근 30일. |
| `RawDataExportPage.jsx` | 258 | `/raw-export`. 조건(기간/채널/판매처 등)을 지정해 `/products/export/raw`에서 엑셀을 내려받음. **조건 프리셋을 localStorage(`raw_export_presets_v1`)에 저장**하는 기능 포함. KST 기준 날짜 처리. |

### `public/` 정적 자산

| 파일 | 역할 |
|------|------|
| `ADC_Logo_FSL2_YCH_reduced_RGB.png` | 제품 로고 (헤더) |
| `o1.png`, `o2.png`, `o3.png` | 구성옵션(1/2/3개입) 아이콘 |
| `vite.svg` | 파비콘 (Vite 기본값 그대로) |

### 설정 파일

| 파일 | 역할 |
|------|------|
| `index.html` | HTML 셸. **Tailwind CDN 스크립트 + `tailwind.config` 인라인 정의(폰트 패밀리)**, Google Fonts preconnect, 앱 타이틀. Tailwind 관련 수정은 전부 여기서 합니다. |
| `vite.config.js` | Vite 설정. react 플러그인만 등록된 기본 상태(프록시·alias 없음). |
| `vercel.json` | Vercel 빌드 설정 + **SPA rewrite**(`/(.*)` → `/index.html`). 이게 없으면 `/report` 직접 접속 시 404가 납니다. |
| `tsconfig.json` | TS 설정. `allowJs: true`, `strict: false`, `noEmit: true`. 타입 검사를 강제하지 않는 느슨한 설정. |
| `eslint.config.js` | ESLint flat config (react-hooks, react-refresh 플러그인). |
| `package.json` | 의존성 및 스크립트(`dev`/`build`/`lint`/`preview`). |
| `.env.production` | **커밋되어 있는 파일.** 프로덕션 백엔드 URL(`VITE_API_BASE_URL`)이 들어 있습니다. |
| `.gitignore` | `node_modules`, `dist`, `.env.local`, `.env.production.local` 등 제외. |
| `vnev/` | ⚠️ Windows에서 만들어진 **Python 가상환경 잔재**. 이 프로젝트와 무관하며 삭제해도 됩니다(오타 포함). |

---

## 4. `src/App.jsx` 내부 지도

7,480줄 단일 파일이라 검색이 어렵습니다. 주요 정의 위치는 아래와 같습니다 (줄 번호는 참고용, 수정 시 달라짐).

### 상단: 상수 · API 호출 함수 (L1~560)

| 줄 | 항목 |
|----|------|
| 45 | `API_BASE` — `VITE_API_BASE_URL` 또는 `http://localhost:8000` |
| 46 | `MEDICAL_DEVICE_BASE_URL` — 대웅 의료기기 사이트 외부 링크 |
| 112~370 | 상품·크롤 관련: `fetchLatestProducts`, `fetchConfig`, `fetchTrackedMallsSummary`, `fetchTrackedMallsTrends`, `fetchMallsTop`, `runCrawlNow`, `fetchCrawlStatus`, `fetchMallTimeline`, `fetchMallPriceInsights`, `generateCardImageOnDemand`, `confirmManualQuantity`, `deleteProductsByIds` |
| 232~283 | 알림 관련: `fetchAlertConfig`, `saveAlertConfig`, `triggerAlertNow` |
| 384~560 | 메모 관련: `fetchGlobalMemos`, `createGlobalMemo`, `fetchVendorMemosAggregate`, `fetchVendorMemosForSeller`, `createVendorMemo`, `uploadMemoImage`, `deleteDashboardMemo`, `updateDashboardMemo`, 첨부 URL 변환 헬퍼 |

### 중단: 상수 · 포맷터 (L563~1660)

| 줄 | 항목 |
|----|------|
| 563 | `CHANNELS` — `naver`(네이버스토어) / `coupang`(쿠팡) / `others`(기타 G마켓·옥션) |
| 569 | `HEADER_LABELS`, `MARKET_BY_CHANNEL` |
| 1440~1550 | 포맷터: `formatKRW`, `getPriceLevel`(기준가 대비 색상 등급), `parseDateLike`, `formatDateTimeKST`, `clampNumber` |
| 1475 | `buildContinuousMallTrendData` — 결측일을 메워 연속 그래프 데이터 생성 |
| 1585~1660 | 판매처명 표시 처리: `getSellerDisplayAlias`, `displaySellerName`, `buildSellerMetricsFromTimeline` |

### 하단: 컴포넌트 (L48, L1664~7479)

| 줄 | 컴포넌트 | 역할 |
|----|----------|------|
| 48 | `DashboardPasswordScreen` | 공유 비밀번호 입력 → 토큰 발급 화면 |
| 1664~2860 | `Chip` `Card` `Stat` `Table` `Badge` `PrimaryButton` `GhostButton` `HeaderNavButton` | 공용 UI 프리미티브 |
| 1696 | `GlobalMemoBoard` | 상단 운영 메모 보드 |
| 2180 | `VendorMemosAggregateCard` | 업체별 메모 집계 카드 |
| 2873 | `PriceTrend` | 판매처별 단가 추이 라인 차트 |
| 2993 | `MonthlyBars` | 월별 막대 차트 |
| 3027 | `SellerPriceTrend` | 채널 내 여러 판매처 비교 차트 |
| 3167 | `SingleSellerPriceTrend` | 단일 판매처 상세 차트 |
| 3394 | `SettingsPanel` | 필터(단가 범위·기준가·상품명·구성옵션) 패널 |
| 3594 | `ImageModal` | 증빙 캡처 확대 모달 |
| 3622 | `HtmlCardModal` | 증빙 카드 생성·미리보기 모달 |
| 3707 | `ManualQuantityModal` | 수량 수동 확정 모달 |
| **3754** | **`MainDashboard`** | 메인 화면 (약 1,070줄) |
| **4826** | **`ChannelSellers`** | 채널별 주요 판매처 (약 590줄) |
| **5419** | **`SellerDetail`** | 판매처 상세 (약 1,300줄) |
| 6725 | `AlertSettingsPage` | `/alerts` 알림 설정 |
| **6919** | **`App`** | 루트. 전역 state, 데이터 로딩, 라우팅, 로그인 게이트 |

> 💡 **수정 시 팁**: 화면 하나를 손볼 때는 위 표에서 해당 컴포넌트 시작 줄을 찾아 그 블록 안에서만 작업하세요.
> 장기적으로는 `MainDashboard` / `ChannelSellers` / `SellerDetail` / 차트 / 메모를 별도 파일로 분리하는 것을 권장합니다.

---

## 5. 인증 방식

백엔드가 **공유 비밀번호 + JWT** 방식을 쓰므로 프론트도 이에 맞춰 동작합니다.

```
① 앱 진입 → localStorage("libre_dashboard_token") 확인
② 토큰 없음 → 전체 화면 오버레이로 DashboardPasswordScreen 표시
③ 비밀번호 입력 → POST /auth/dashboard/login → JWT 수신 → localStorage 저장
④ 이후 모든 요청은 authFetch()가 Authorization: Bearer <JWT> 자동 부착
⑤ 401 응답 → 토큰 삭제 + "dashboard-auth-expired" 이벤트 → 다시 로그인 화면
```

- 토큰 키: `libre_dashboard_token` (localStorage)
- 토큰 유효기간: **1일** (백엔드에서 결정). 만료되면 자동으로 로그인 화면으로 돌아갑니다.
- 로그인 화면은 라우팅이 아니라 **오버레이**입니다. 미인증 상태에서도 뒤쪽 화면이 마운트되어 있으므로,
  데이터 로딩 함수들은 `getDashboardToken()`이 비어 있으면 요청을 건너뜁니다.
- 백엔드에서 `DASHBOARD_AUTH_ENABLED=false`로 두면 인증 없이 동작합니다(로컬 개발 전용).

---

## 6. 백엔드 연동

호출하는 엔드포인트 전체입니다. 명세는 백엔드의 `GET /docs`(Swagger UI)를 참고하세요.

| 엔드포인트 | 사용 위치 |
|------------|-----------|
| `POST /auth/dashboard/login` | `DashboardPasswordScreen` |
| `GET /products/latest` | 메인 대시보드 (최신 스냅샷) |
| `GET /products/today` | 당일 데이터 |
| `GET /products/config` | 기준가·주요 판매처·검색어 초기값 |
| `GET /products/tracked-malls/summary` · `/trends` | 주요 판매처 요약·추이 |
| `GET /products/malls/top` | 상위 판매처 |
| `GET /products/mall/timeline` | 판매처 상세 타임라인 |
| `GET /products/mall/price-insights` | 이상탐지·단기예측 |
| `POST /products/crawl/run` · `GET /products/crawl/status` | 수동 크롤링 실행·상태 폴링 |
| `POST /products/card/generate` | 증빙 카드 단건 생성 |
| `POST /products/manual-confirm` | 수량 수동 확정 |
| `POST /products/delete` | 행 삭제 |
| `GET /products/export/raw` | 엑셀 Export |
| `GET/POST /memos/global` · `/memos/vendor` | 운영·업체 메모 |
| `GET /memos/vendors/aggregate` | 업체 메모 집계 |
| `PATCH/DELETE /memos/{id}` · `POST /memos/upload-image` | 메모 수정·삭제·이미지 업로드 |
| `GET/PUT /alerts/config` · `POST /alerts/trigger` | 알림 설정·수동 발송 |
| `GET /reports/monthly/{month}` · `GET /reports/range` | 월간·기간 리포트 |

**CORS**: 백엔드 `api/main.py`가 `localhost:3000`, `localhost:5173`, `127.0.0.1:5173`, `*.vercel.app`을 허용합니다.
다른 포트나 도메인에서 띄우면 **백엔드 CORS 목록에 추가해야** 합니다.

---

## 7. 환경 변수

Vite 규칙상 **`VITE_` 접두사**가 있어야 클라이언트 번들에 주입됩니다.

| 변수 | 용도 | 설정 위치 |
|------|------|-----------|
| `VITE_API_BASE_URL` | 백엔드 API 베이스 URL | 로컬 `.env.local` / 프로덕션 `.env.production` 또는 Vercel 환경변수 |

```bash
# .env.local (로컬 개발용, gitignore 됨)
VITE_API_BASE_URL=http://localhost:8000
```

미설정 시 기본값은 파일마다 다릅니다 — `src/config/api.ts`는 `http://127.0.0.1:8000`, `App.jsx`/`Report.jsx`/`RawDataExportPage.jsx`는 `http://localhost:8000`.
백엔드 CORS가 둘 다 허용하므로 실사용에 문제는 없지만, 하나로 통일하는 편이 좋습니다.

> ⚠️ 환경변수는 **빌드 타임에 번들로 구워집니다.** 값을 바꾸면 반드시 **재배포**해야 반영됩니다.
> 또한 클라이언트 번들에 그대로 노출되므로 **비밀 값을 넣으면 안 됩니다**(현재 API URL만 있어 문제 없음).

---

## 8. 로컬 개발 · 빌드

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 (백엔드를 로컬에서 띄운 경우)
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

# 3) 개발 서버 → http://localhost:5173
npm run dev

# 4) 린트
npm run lint

# 5) 프로덕션 빌드 → dist/
npm run build
npm run preview      # 빌드 결과 로컬 확인
```

**동작 확인 순서**: 개발 서버 접속 → 비밀번호 입력 화면이 뜨는지 → 로그인 후 메인 대시보드에 데이터가 들어오는지.
데이터가 비어 있으면 프론트가 아니라 **백엔드 DB에 스냅샷이 없을 가능성**이 큽니다. 백엔드 `GET /health/db`로 먼저 확인하세요.

---

## 9. 배포 (Vercel)

| 항목 | 값 |
|------|-----|
| Framework Preset | Vite (자동 감지) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Rewrites | `/(.*)` → `/index.html` (`vercel.json`에 정의됨. SPA 직접 접속용) |

- `main` 브랜치 push → **Production 자동 배포**
- 그 외 브랜치·PR → **Preview URL 자동 생성**
- 환경변수는 Vercel **Settings → Environment Variables**에서 Production / Preview 각각 설정.
  현재 저장소에는 `.env.production`이 커밋되어 있어 Vercel 설정이 없어도 빌드는 됩니다.
- 백엔드 CORS가 `*.vercel.app`을 정규식으로 허용하므로 Preview 도메인도 그대로 동작합니다.

---

## 10. 알려진 이슈 · 주의사항

### ① 월간 리포트가 401로 실패할 수 있음

`src/api/reports.ts`의 `getMonthlyReport()`는 **`authFetch`가 아닌 순수 `fetch`를 사용**해 `Authorization` 헤더를 보내지 않습니다.
같은 파일의 `getRangeReport()`는 `authFetch`를 씁니다.
백엔드는 `/reports/*` 전체에 JWT를 요구하므로, 인증이 켜진 환경에서 `/report` 화면은 401을 받습니다.

**수정 방법**: `getMonthlyReport()`의 `fetch`를 `authFetch`로 교체(`authFetch`는 이미 같은 파일 상단에서 import 중).

### ② `/` 내부 화면은 URL이 없음

메인 ↔ 채널 ↔ 판매처 상세는 state 기반이라 **뒤로가기·새로고침·링크 공유 불가**입니다. [2장](#2-화면-구성--라우팅) 참고.

### ③ Tailwind가 CDN 의존

`index.html`의 `cdn.tailwindcss.com` 스크립트에 의존합니다. 이 CDN 방식은 공식적으로 프로덕션 권장 방식이 아니며,
네트워크 차단 환경에서는 스타일이 전부 깨집니다.

### ④ `App.jsx` 단일 파일 7,480줄

병합 충돌이 잦고 탐색이 어렵습니다. 기능 추가 시 새 컴포넌트는 **별도 파일로 분리**해 더 커지지 않게 하세요.

### ⑤ API 호출 로직 중복

`App.jsx`, `Report.jsx`, `RawDataExportPage.jsx`가 각자 `API_BASE`를 정의하고 fetch 함수를 따로 갖고 있습니다.
`src/config/api.ts` + `src/api/`로 일원화하는 것이 정리 방향입니다.

### ⑥ 잔재 파일

- `vnev/` — Windows Python 가상환경 잔재. 삭제 가능
- `src/assets/react.svg`, `public/vite.svg` — Vite 템플릿 기본값
- 화면 하단 푸터에 `* 본 화면은 MVP 데모용이며...` 문구가 남아 있음 (`App.jsx`의 `footer`)

### ⑦ 데이터가 들쭉날쭉해 보일 때

프론트 버그가 아니라 **쿠팡 크롤러의 봇 차단** 때문일 가능성이 높습니다.
실행마다 수집되는 판매처 구성이 달라집니다. 백엔드 README의 트러블슈팅 항목을 참고하세요.

---

## 11. 인수인계 체크리스트

- [ ] 저장소 접근 권한 (프론트 / 백엔드 `libre2-api` 양쪽)
- [ ] Vercel 프로젝트 권한 및 환경변수(`VITE_API_BASE_URL`) 값 확인
- [ ] 대시보드 공유 비밀번호 인수 (백엔드 `DASHBOARD_PASSWORD`)
- [ ] 백엔드 CORS 허용 목록에 사용할 도메인이 포함되어 있는지 확인
- [ ] `npm install && npm run dev`로 로컬 구동 → 로그인 → 메인 대시보드 데이터 확인
- [ ] 10장 ① 월간 리포트 인증 이슈 처리 여부 결정
- [ ] `App.jsx` 분리 리팩터링 계획 수립 여부 결정
