# 배포 가이드

## 📋 목차

1. [개요](#개요)
2. [환경 변수 설정](#환경-변수-설정)
3. [Vercel 배포](#vercel-배포)
4. [로컬 프로덕션 빌드](#로컬-프로덕션-빌드)
5. [배포 후 확인사항](#배포-후-확인사항)

---

## 개요

이 프로젝트는 **Vercel**을 권장 배포 플랫폼으로 사용합니다. Next.js와의 완벽한 통합 및 자동 배포 기능을 제공합니다.

### 지원 플랫폼

- ✅ **Vercel** (권장)
- ✅ **Netlify**
- ✅ **AWS Amplify**
- ✅ **자체 서버** (Node.js 18+)

---

## 환경 변수 설정

### 개발 환경

프로젝트 루트에 `.env.local` 파일을 생성합니다:

```bash
# .env.local (로컬 개발용, Git에 커밋하지 않음)
# 현재는 Binance API Key가 필요하지 않지만, 향후 확장을 위해 준비
# BINANCE_API_KEY=your_api_key_here
# BINANCE_API_SECRET=your_api_secret_here
```

**참고**: 현재 버전은 공개 API만 사용하므로 API Key가 필요하지 않습니다.

### 프로덕션 환경 (Vercel)

Vercel 대시보드에서 환경 변수를 설정합니다:

1. Vercel 프로젝트 설정 → Environment Variables
2. 필요한 환경 변수 추가:
   ```
   BINANCE_API_KEY=your_api_key_here (선택사항)
   BINANCE_API_SECRET=your_api_secret_here (선택사항)
   ```

---

## Vercel 배포

### 1. Vercel 계정 생성

1. [Vercel](https://vercel.com)에 가입
2. GitHub 계정 연동

### 2. 프로젝트 배포

#### 방법 1: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 루트에서 실행
vercel

# 프로덕션 배포
vercel --prod
```

#### 방법 2: GitHub 연동 (권장)

1. Vercel 대시보드 → Add New Project
2. GitHub 저장소 선택
3. 프로젝트 설정:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `.next` (기본값)
4. Deploy 클릭

### 3. 자동 배포 설정

GitHub 연동 시 다음 브랜치에 자동 배포됩니다:

- **Production**: `main` 브랜치 → 프로덕션 URL
- **Preview**: 다른 브랜치 → 프리뷰 URL

### 4. 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables에서 설정:

```
BINANCE_API_KEY=your_api_key_here (선택사항)
BINANCE_API_SECRET=your_api_secret_here (선택사항)
```

---

## 로컬 프로덕션 빌드

### 빌드 및 실행

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### 빌드 최적화 확인

```bash
# 빌드 결과 확인
npm run build

# 번들 크기 분석 (선택사항)
npm install -D @next/bundle-analyzer
```

---

## 배포 후 확인사항

### 1. 기본 기능 확인

- [ ] 메인 페이지 로드
- [ ] 코인 목록 표시
- [ ] WebSocket 연결 상태 확인
- [ ] 실시간 가격 업데이트 확인
- [ ] 차트 페이지 동작 확인
- [ ] 즐겨찾기 기능 확인

### 2. 성능 확인

- [ ] Lighthouse 성능 점수 확인
- [ ] Core Web Vitals 확인
- [ ] 네트워크 요청 최적화 확인

### 3. 에러 모니터링

- [ ] 브라우저 콘솔 에러 확인
- [ ] Vercel 로그 확인
- [ ] WebSocket 연결 상태 확인

### 4. 환경별 설정

#### 개발 환경
- URL: `http://localhost:3003`
- WebSocket: `wss://stream.binance.com:9443/stream`

#### 프로덕션 환경
- URL: `https://your-project.vercel.app`
- WebSocket: `wss://stream.binance.com:9443/stream` (동일)

---

## 트러블슈팅

### 빌드 실패

**문제**: `npm run build` 실패

**해결책**:
1. Node.js 버전 확인 (18 이상 필요)
2. 의존성 재설치: `rm -rf node_modules package-lock.json && npm install`
3. TypeScript 오류 확인: `npm run lint`

### WebSocket 연결 실패

**문제**: 프로덕션에서 WebSocket 연결 실패

**해결책**:
1. Vercel은 WebSocket을 지원하지만, 일부 제한이 있을 수 있음
2. Degraded Mode로 자동 전환되는지 확인
3. 브라우저 콘솔에서 에러 메시지 확인

### 환경 변수 미적용

**문제**: 환경 변수가 적용되지 않음

**해결책**:
1. Vercel 대시보드에서 환경 변수 재설정
2. 프로젝트 재배포
3. 환경 변수 이름 확인 (대소문자 구분)

### HTTP 451 오류 (지역 제한)

**문제**: `HTTP error! status: 451` 오류 발생

**원인**: Binance API가 일부 지역에서 차단되어 있음 (예: 한국)

**해결책**:

1. **Vercel 지역 설정 변경** (권장):
   - Vercel 대시보드 → 프로젝트 설정 → Functions
   - **Region** 설정을 지원되는 지역으로 변경:
     - `iad1` (US East - Virginia)
     - `sfo1` (US West - San Francisco)
     - `fra1` (EU - Frankfurt)
     - `lhr1` (EU - London)
   - 저장 후 재배포

2. **대안**: Binance API 대신 다른 데이터 소스 사용
   - CoinGecko API
   - CryptoCompare API

3. **임시 해결책**: 
   - 클라이언트 측에서 직접 Binance API 호출 (CORS 이슈 가능)
   - 프록시 서버 사용

---

## 추가 리소스

- [Next.js 배포 문서](https://nextjs.org/docs/deployment)
- [Vercel 문서](https://vercel.com/docs)
- [환경 변수 관리](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 참고 문서

- [아키텍처 문서](./architecture.md)
- [API 문서](./api.md)
- [성능 분석 문서](./performance.md)

