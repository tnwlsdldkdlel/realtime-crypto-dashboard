# Next.js로 만든 실시간 암호화폐 대시보드 개발기

## 📌 프로젝트 소개

실시간 암호화폐 대시보드는 **Next.js 16**과 **React 19**를 활용하여 구축한 고성능 실시간 웹 애플리케이션입니다. Binance API를 통해 실시간 암호화폐 가격 정보를 제공하며, WebSocket을 활용한 실시간 데이터 처리와 SSR/SSG를 통한 성능 최적화를 구현했습니다.

**🔗 Live Demo**: [https://realtime-crypto-dashboard.vercel.app](https://realtime-crypto-dashboard.vercel.app)  
**📂 GitHub**: [https://github.com/tnwlsdldkdlel/realtime-crypto-dashboard](https://github.com/tnwlsdldkdlel/realtime-crypto-dashboard)

---

## 🎯 프로젝트 목표

이 프로젝트를 통해 다음을 달성하고자 했습니다:

1. **Next.js의 서버 환경 활용**: SSR/SSG를 통한 초기 로딩 성능 개선
2. **실시간 데이터 처리**: WebSocket을 활용한 고빈도 데이터 업데이트
3. **강건한 아키텍처**: 어댑터 패턴, 리포지토리 패턴 등 확장 가능한 구조
4. **성능 최적화**: 가상화, 메모이제이션, 배치 업데이트를 통한 최적화

---

## 🛠️ 기술 스택

### 핵심 기술

- **Next.js 16**: SSR/SSG, API Routes, 파일 기반 라우팅
- **React 19**: 선언적 UI 구성 및 컴포넌트 기반 개발
- **TypeScript**: 타입 안정성 및 코드 품질 확보
- **Zustand**: 고빈도 실시간 데이터 관리 (React 렌더링과 분리)
- **Lightweight Charts**: 캔들스틱 차트 시각화
- **TanStack Virtual**: 대량 리스트 가상화
- **Tailwind CSS**: 유틸리티 기반 스타일링

### 기술 스택 선택 이유

#### 1. Zustand를 선택한 이유

고빈도 실시간 데이터를 처리해야 하는 상황에서, Redux나 Context API는 성능 이슈가 있었습니다. Zustand는:
- React 렌더링과 완전히 분리된 상태 관리
- 간단한 API와 낮은 보일러플레이트
- Map 기반 데이터 구조로 O(1) 조회 성능

#### 2. TanStack Virtual을 선택한 이유

수백 개의 코인 목록을 렌더링할 때, 모든 항목을 DOM에 렌더링하면 성능 저하가 발생합니다. TanStack Virtual은:
- 화면에 보이는 항목만 렌더링
- 스크롤 성능 최적화
- 메모리 사용량 감소

---

## 🏗️ 아키텍처 설계

### 하이브리드 API 전략

프로젝트의 핵심은 **하이브리드 API 전략**입니다:

```
클라이언트 (브라우저)
  ├─ WebSocket (직접 연결)
  │   └─ 실시간 가격 업데이트
  │
  └─ REST API (Next.js API Routes 프록시)
      └─ 초기 데이터, 과거 데이터
```

**왜 이렇게 설계했나요?**

1. **WebSocket은 클라이언트에서 직접 연결**
   - 실시간 데이터는 지연이 최소화되어야 함
   - 서버를 거치면 불필요한 지연 발생

2. **REST API는 Next.js API Routes를 통해 프록시**
   - API Key 보안 (서버에만 저장)
   - Rate Limit 중앙 관리
   - 에러 처리 및 재시도 로직 통합

### 계층 구조

```
프레젠테이션 계층 (React Components)
    ↓
상태 관리 계층 (Zustand Store)
    ↓
데이터 접근 계층 (Adapter, Repository)
    ↓
API 계층 (Next.js API Routes)
    ↓
외부 API (Binance)
```

### 핵심 디자인 패턴

#### 1. 어댑터 패턴

Binance API의 원시 데이터를 도메인 타입으로 변환합니다.

```typescript
// adapters/binance.ts
export function adaptBinanceTicker(data: BinanceTickerResponse): Ticker {
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    priceChange: parseFloat(data.priceChangePercent),
    // ... 도메인 타입으로 변환
  };
}
```

**장점**: Binance API 형식이 변경되어도 어댑터만 수정하면 됩니다.

#### 2. 리포지토리 패턴

상태 관리 계층을 추상화하여 라이브러리 비종속성을 확보합니다.

```typescript
// repositories/tickerRepository.ts
export interface TickerRepository {
  getTicker(symbol: string): Ticker | undefined;
  getAllTickers(): TickerMap;
  updateTicker(ticker: Ticker): void;
}
```

**장점**: Zustand를 다른 상태 관리 라이브러리로 교체해도 인터페이스는 동일합니다.

---

## 💡 핵심 구현 내용

### 1. 실시간 데이터 배치 업데이트

초당 수백 개의 WebSocket 메시지를 처리해야 하는 상황에서, 각 메시지마다 상태를 업데이트하면 성능 저하가 발생합니다.

**해결책**: `requestAnimationFrame`을 활용한 배치 업데이트

```typescript
// stores/tickerStore.ts
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;

function scheduleUpdate() {
  if (rafId !== null) return;
  
  rafId = requestAnimationFrame(() => {
    flushUpdates();
  });
}

function flushUpdates() {
  const updates = [...updateBuffer];
  updateBuffer = [];
  
  // 한 번에 모든 업데이트 적용
  storeSetState((state) => {
    const newTickers = new Map(state.tickers);
    updates.forEach((ticker) => {
      newTickers.set(ticker.symbol, ticker);
    });
    return { tickers: newTickers };
  });
}
```

**효과**: 
- React 리렌더링 횟수 최소화
- CPU 사용률 감소
- 부드러운 UI 업데이트

### 2. 지능형 WebSocket 구독 관리

Binance WebSocket은 URL 기반 구독 방식을 사용합니다. 즐겨찾기를 변경할 때마다 재연결이 필요하지만, 모든 변경에 대해 재연결하면 성능 저하가 발생합니다.

**해결책**: 변경 규모에 따른 최적 전략 선택

```typescript
// 대규모 변경 감지
const isMajorChange =
  previousSymbols.length === 0 || // 첫 구독
  currentSymbols.length === 0 || // 모든 구독 해제
  changeRatio >= 0.5 || // 변경 비율 50% 이상
  commonRatio < 0.5; // 공통 심볼 50% 미만

if (isMajorChange) {
  // 전체 재구독 (한 번만 재연결)
  client.updateSubscription(currentSymbols, 'ticker');
} else {
  // 소규모 변경: 차등 구독
  client.subscribe(newSymbols, 'ticker');
  client.unsubscribe(removedSymbols, 'ticker');
}
```

**효과**:
- 대규모 변경 시 한 번만 재연결
- 소규모 변경 시 빠른 처리
- 사용자 경험 개선

### 3. 디바운스된 재연결

사용자가 즐겨찾기 버튼을 빠르게 연속 클릭하면, 각 클릭마다 WebSocket 재연결이 발생합니다.

**해결책**: 디바운스 패턴 적용

```typescript
const debouncedUpdateSubscription = useMemo(
  () => debounce((symbols: string[]) => {
    // WebSocket 구독 업데이트
  }, 500),
  []
);
```

**효과**:
- 연속 클릭 시 마지막 클릭 후 500ms 후에만 재연결
- 불필요한 재연결 최소화
- 서버 부하 감소

### 4. 실시간 데이터와 과거 데이터 병합

차트에서 과거 Kline 데이터와 실시간 Kline 스트림을 병합해야 합니다.

**해결책**: 시간 기반 병합 로직

```typescript
const updateChartDataWithRealtimeKline = useCallback((kline: Kline) => {
  setChartData((prev) => {
    const lastCandle = prev[prev.length - 1];
    
    // 같은 시간대의 캔들 업데이트
    if (lastCandle && lastCandle.time === kline.openTime) {
      return [...prev.slice(0, -1), convertKlineToCandlestick(kline)];
    }
    
    // 새로운 캔들 추가
    return [...prev, convertKlineToCandlestick(kline)];
  });
}, []);
```

### 5. 데이터 Gap 자동 보완

과거 데이터에 누락된 시간대가 있는 경우 자동으로 보완합니다.

```typescript
const detectAndFillGaps = async (data: CandlestickData[]) => {
  const gaps: { start: number; end: number }[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const expectedInterval = getIntervalMs(selectedInterval);
    const actualInterval = data[i].time - data[i - 1].time;
    
    if (actualInterval > expectedInterval * 1.5) {
      gaps.push({ start: data[i - 1].time, end: data[i].time });
    }
  }
  
  // Gap이 있으면 REST API로 보완
  for (const gap of gaps) {
    const gapData = await fetchKlines(symbol, interval, gap.start, gap.end);
    // 데이터 삽입
  }
};
```

---

## 🐛 트러블슈팅 및 해결 과정

### 1. HTTP 451 오류 (지역 제한)

**문제**: Vercel에 배포한 후 Binance API에서 451 오류 발생

**원인**: 
- 로컬 환경: 사용자의 한국 IP로 접근 → ✅ 접근 가능
- Vercel 환경: Vercel 서버의 IP로 접근 → ❌ 일부 지역 제한

**해결책**:
1. Vercel 대시보드에서 배포 지역 변경 (EU 또는 US)
2. 451 오류 명시적 처리 및 사용자 친화적 메시지

```typescript
if (response.status === 451) {
  throw new Error('Binance API is not available in this region.');
}
```

### 2. Lightweight Charts v5 API 변경

**문제**: `addCandlestickSeries` 메서드가 존재하지 않음

**원인**: Lightweight Charts v5에서 API가 변경됨

**해결책**: 새로운 API 사용

```typescript
// v4 (구버전)
chart.addCandlestickSeries({ ... });

// v5 (신버전)
import { CandlestickSeries } from 'lightweight-charts';
chart.addSeries(CandlestickSeries, { ... });
```

### 3. WebSocket 재연결 실패

**문제**: 페이지 간 이동 시 WebSocket 연결이 끊기고 재연결되지 않음

**원인**: 컴포넌트 언마운트 시 `previousSymbolsRef`가 초기화되지 않음

**해결책**: 클린업 함수에서 명시적 초기화

```typescript
useEffect(() => {
  // ...
  
  return () => {
    // 컴포넌트 언마운트 시 초기화
    previousSymbolsRef.current = [];
  };
}, []);
```

### 4. useCallback 의존성 체인 문제

**문제**: ESLint 경고 및 불필요한 재렌더링

**원인**: 의존성 체인이 하위 함수에서 상위 함수로 전파됨

**해결책**: 하위 함수부터 메모이제이션

```typescript
// 하위 함수 먼저 메모이제이션
const updateChartDataWithRealtimeKline = useCallback((kline: Kline) => {
  // ...
}, []);

// 상위 함수는 하위 함수를 의존성에 포함
const setupWebSocket = useCallback(() => {
  // updateChartDataWithRealtimeKline 사용
}, [updateChartDataWithRealtimeKline]);
```

---

## ⚡ 성능 최적화

### 1. 리스트 가상화

수백 개의 코인 목록을 렌더링할 때, TanStack Virtual을 사용하여 화면에 보이는 항목만 렌더링합니다.

**효과**: 
- 초기 렌더링 시간 단축
- 스크롤 성능 향상
- 메모리 사용량 감소

### 2. React.memo 적용

불필요한 리렌더링을 방지하기 위해 다음 컴포넌트에 `React.memo` 적용:
- `FavoriteButton`
- `LoadingSpinner`
- `ErrorMessage`
- `CandlestickChart`

### 3. API 응답 캐싱

Rate Limit을 대응하기 위해 API 응답을 캐싱합니다.

```typescript
// utils/apiCache.ts
const cache = new Map<string, { data: any; expiresAt: number }>();

export function get(key: string): any | null {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiresAt) {
    return null;
  }
  return item.data;
}
```

**TTL**: 60초

### 4. 번들 크기 최적화

`next.config.ts`에서 패키지 임포트 최적화:

```typescript
optimizePackageImports: [
  '@tanstack/react-virtual',
  'lightweight-charts',
  'zustand'
]
```

---

## 📊 성능 측정 결과

### Core Web Vitals

| 메트릭 | 측정값 | 목표 | 상태 |
|--------|--------|------|------|
| **FCP** | 210-250ms | < 1.8s | ✅ |
| **LCP** | 330-370ms | < 2.5s | ✅ |
| **CLS** | 0.013-0.021 | < 0.1 | ✅ |
| **TTI** | 24.2s | < 3.8s | ⚠️ |
| **TBT** | 1.0-1.1s | < 200ms | ⚠️ |

### 실시간 업데이트 성능

- **FPS**: 46-47 (목표: 60)
- **렌더링 시간**: 21-22ms (목표: < 16ms)
- **CPU 사용률**: 0% ✅
- **메모리 사용량**: 22-23MB ✅

> **참고**: TTI와 TBT는 실시간 WebSocket 연결 및 데이터 처리로 인한 트레이드오프입니다.

---

## 🚀 배포 및 결과

### 배포 환경

- **플랫폼**: Vercel
- **URL**: [https://realtime-crypto-dashboard.vercel.app](https://realtime-crypto-dashboard.vercel.app)
- **CI/CD**: GitHub Actions (ESLint, Vitest, 빌드 테스트)

### 배포 과정에서의 이슈

1. **지역 제한**: Vercel 배포 지역을 EU로 변경하여 해결
2. **환경 변수**: 현재는 공개 API만 사용하므로 환경 변수 불필요

---

## 📚 주요 학습 내용

이 프로젝트를 통해 다음을 학습했습니다:

1. **Next.js App Router**: Server Components와 Client Components의 적절한 분리
2. **WebSocket 관리**: 단일 연결 다중 스트림 구독 및 재연결 전략
3. **성능 최적화**: 가상화, 메모이제이션, 배치 업데이트
4. **디자인 패턴**: 어댑터 패턴, 리포지토리 패턴의 실전 적용
5. **에러 처리**: Degraded Mode, 재시도 로직, Error Boundary

---

## 🎓 회고

### 잘한 점

1. **아키텍처 설계**: 확장 가능한 구조로 설계하여 유지보수성 향상
2. **성능 최적화**: 다양한 최적화 기법을 적용하여 사용자 경험 개선
3. **에러 처리**: 강건한 에러 처리로 안정성 확보

### 개선할 점

1. **테스트 커버리지**: 단위 테스트와 통합 테스트 확대 필요
2. **접근성**: ARIA 속성 및 키보드 네비게이션 개선
3. **다국어 지원**: i18n 적용 고려

### 다음 단계

1. **PWA 지원**: 오프라인 기능 및 설치 가능한 앱으로 전환
2. **다중 거래소 지원**: Coinbase, Kraken 등 추가
3. **알림 기능**: 가격 변동 알림 구현

---

## 🔗 참고 자료

- [프로젝트 GitHub](https://github.com/tnwlsdldkdlel/realtime-crypto-dashboard)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Binance API 문서](https://binance-docs.github.io/apidocs/spot/en/)
- [Lightweight Charts 문서](https://tradingview.github.io/lightweight-charts/)

---

## 마무리

이 프로젝트를 통해 실시간 웹 애플리케이션 개발의 전 과정을 경험할 수 있었습니다. 특히 WebSocket 관리, 성능 최적화, 아키텍처 설계 등 실무에서 중요한 기술들을 학습할 수 있었던 값진 경험이었습니다.

궁금한 점이나 피드백이 있으시면 댓글로 남겨주세요! 🙏

