# Libre Price Monitor - Frontend Client

Libre2 가격 모니터링 대시보드 프론트엔드 애플리케이션

## 기술 스택

- React 19
- Vite 7
- Recharts (차트 라이브러리)

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
# 백엔드 API URL
VITE_API_BASE_URL=http://localhost:8000
```

### 3. 개발 서버 실행

```bash
npm run dev
```

## 빌드

프로덕션 빌드:

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

빌드 결과 미리보기:

```bash
npm run preview
```

## 배포 (Vercel)

### Vercel 배포 장점

✅ **자동 배포**: GitHub/GitLab 푸시 시 자동 배포  
✅ **프리뷰 배포**: PR/브랜치별 자동 프리뷰 배포  
✅ **환경 변수 관리**: 쉬운 환경 변수 설정  
✅ **무료 플랜**: 충분한 무료 사용량 제공  
✅ **커스텀 도메인**: 자신의 도메인 연결 가능  

### 배포 단계

1. **GitHub에 프로젝트 푸시**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Vercel 가입 및 연결**
   - [vercel.com](https://vercel.com) 접속
   - GitHub 계정으로 로그인
   - "Add New Project" 클릭
   - 저장소 선택 후 "Import"

3. **프로젝트 설정**
   - Framework Preset: **Vite** (자동 감지)
   - Build Command: `npm run build` (자동 설정)
   - Output Directory: `dist` (자동 설정)
   - Install Command: `npm install` (자동 설정)

4. **환경 변수 설정**
   - Settings → Environment Variables
   - 다음 변수 추가:
     ```
     VITE_API_BASE_URL = https://your-backend-api.com
     ```
   - Production, Preview, Development 각각 설정 가능

5. **배포 완료**
   - "Deploy" 클릭
   - 배포 완료 후 URL 확인

### 브랜치별 배포

- `main` 브랜치 → Production 환경 (메인 도메인)
- 다른 브랜치/PR → Preview 환경 (임시 URL)
- 개발 중인 기능은 브랜치로 작업하면 자동 프리뷰 배포

### 환경 변수 관리

백엔드 API URL은 환경별로 다르게 설정:

**로컬 개발:**
- `.env.local`: `VITE_API_BASE_URL=http://localhost:8000`

**Vercel 환경 변수:**
- Production: 실제 백엔드 API URL
- Preview: 개발/테스트용 백엔드 URL
- Development: 로컬 개발용 (사용 안 함)

### 유지보수 워크플로우

1. **기능 개발**
   ```bash
   git checkout -b feature/new-feature
   # 코드 수정
   git push origin feature/new-feature
   ```
   → 자동으로 프리뷰 URL 생성

2. **검토 및 머지**
   - PR 생성 → 프리뷰 URL에서 테스트
   - 승인 후 `main` 브랜치로 머지
   → 자동으로 Production 배포

3. **긴급 수정**
   - `main` 브랜치에서 직접 수정
   - 푸시 시 자동 배포

## 기타 배포 옵션

### Netlify
- Vercel과 유사한 기능
- 드래그 앤 드롭 배포 지원
- [netlify.com](https://netlify.com)

### Cloudflare Pages
- 빠른 CDN
- 무료 플랜 제공
- [pages.cloudflare.com](https://pages.cloudflare.com)

### GitHub Pages
- GitHub 저장소와 통합
- 무료
- 단일 브랜치만 배포 가능

---

## 참고

- Vite 환경 변수는 `VITE_` 접두사가 필요합니다
- 환경 변수 변경 후 재배포가 필요합니다
- `.env.local` 파일은 Git에 커밋하지 마세요 (이미 .gitignore에 포함됨)
