# 성능 분석 문서

## 📊 성능 지표

이 문서는 실시간 암호화폐 대시보드의 성능 측정 결과를 기록합니다.

---

## 🎯 Core Web Vitals

### 측정 방법
- **Lighthouse**: 자동화된 성능 테스트 (`scripts/lighthouse-test.js`)
- **Performance API**: 브라우저 네이티브 성능 측정 (`scripts/performance-test.js`)
- **Web Vitals**: Core Web Vitals 자동 측정 (`components/WebVitals.tsx`)

### 주요 메트릭

#### 1. LCP (Largest Contentful Paint)
- **목표**: 2.5초 이하
- **측정**: 가장 큰 콘텐츠 요소가 렌더링되는 시간

#### 2. FID (First Input Delay)
- **목표**: 100ms 이하
- **측정**: 사용자 상호작용에 대한 응답 시간

#### 3. CLS (Cumulative Layout Shift)
- **목표**: 0.1 이하
- **측정**: 레이아웃 이동의 누적 점수

#### 4. FCP (First Contentful Paint)
- **목표**: 1.8초 이하
- **측정**: 첫 콘텐츠가 렌더링되는 시간

#### 5. TTFB (Time to First Byte)
- **목표**: 800ms 이하
- **측정**: 서버 응답 시간

---

## 🚀 성능 최적화 전략

### 1. React 최적화
- **React.memo**: 불필요한 리렌더링 방지
  - `FavoriteButton`, `LoadingSpinner`, `ErrorMessage`, `CandlestickChart`
- **useMemo**: 계산 비용이 높은 값 메모이제이션
  - `tickerArray`, `wsStatusText`, `wsStatusColor`, `filteredCoins`
- **useCallback**: 함수 메모이제이션
  - `getHighlightClass`, `handleSort`, `updateChartDataWithRealtimeKline`

### 2. 번들 크기 최적화
- **Package Imports 최적화**: `@tanstack/react-virtual`, `lightweight-charts`
- **Dynamic Imports**: 필요 시에만 로드
- **Tree Shaking**: 사용하지 않는 코드 제거

### 3. 데이터 처리 최적화
- **배치 업데이트**: `requestAnimationFrame`을 사용한 배치 처리
- **가상화**: TanStack Virtual을 통한 리스트 가상화
- **캐싱**: API 응답 캐싱으로 중복 요청 방지

### 4. 네트워크 최적화
- **WebSocket**: 실시간 데이터 전송
- **REST API 폴백**: WebSocket 실패 시 폴링 모드
- **Rate Limit 대응**: 캐시 우선 사용, 재시도 로직

---

## 📈 성능 측정 결과

### Lighthouse 성능 점수

**최신 측정 결과** (2024년 기준):

| 메트릭 | 스로틀링 ON | 스로틀링 OFF | 목표 | 상태 |
|--------|------------|-------------|------|------|
| **성능 점수** | 68 | 69 | 90+ | ⚠️ 개선 필요 |
| **FCP** | 250ms | 210ms | < 1.8s | ✅ 양호 |
| **LCP** | 370ms | 330ms | < 2.5s | ✅ 양호 |
| **TTI** | 24.2s | 24.4s | < 3.8s | ⚠️ 개선 필요 |
| **TBT** | 1.1s | 1.0s | < 200ms | ⚠️ 개선 필요 |
| **CLS** | 0.013 | 0.021 | < 0.1 | ✅ 양호 |

**분석**:
- ✅ **FCP, LCP, CLS**: 목표 달성
- ⚠️ **TTI, TBT**: WebSocket 연결 및 실시간 데이터 처리로 인한 지연
- 📊 **성능 점수**: 실시간 기능으로 인한 트레이드오프

### 실시간 업데이트 성능

**Performance API 측정 결과**:

| 메트릭 | 스로틀링 ON | 스로틀링 OFF | 목표 | 상태 |
|--------|------------|-------------|------|------|
| **FPS** | 46.11 | 46.78 | 60 | ⚠️ 개선 필요 |
| **렌더링 시간** | 21.77ms | 21.56ms | < 16ms | ⚠️ 개선 필요 |
| **CPU 사용률** | 0% | 0% | < 30% | ✅ 양호 |
| **메모리 사용량** | 23MB | 22MB | < 100MB | ✅ 양호 |

**분석**:
- ✅ **CPU, 메모리**: 효율적인 사용
- ⚠️ **FPS, 렌더링 시간**: 실시간 업데이트로 인한 프레임 드롭
- 📊 **최적화 여지**: 배치 업데이트 및 가상화로 개선 가능

---

## 🔧 성능 측정 스크립트

### Lighthouse 테스트
```bash
npm run lighthouse
# 또는
node scripts/lighthouse-test.js
```

### Performance 테스트
```bash
npm run performance
# 또는
node scripts/performance-test.js
```

---

## 📝 참고사항

- 성능 측정은 로컬 환경에서 실행해야 합니다 (`http://localhost:3003`)
- WebSocket 연결 및 데이터 로드 시간을 고려하여 충분한 대기 시간이 필요합니다
- 측정 결과는 `lighthouse-results/` 및 `performance-results/` 디렉토리에 저장됩니다

---

## 🔄 지속적인 모니터링

성능 통계 페이지 (`/stats`)에서 실시간으로 다음 지표를 모니터링할 수 있습니다:
- 초당 업데이트 수 (UPS)
- 구독 중인 심볼 수
- WebSocket 연결 상태
- 마지막 업데이트 시간

