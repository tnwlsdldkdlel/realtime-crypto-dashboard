# 실시간 전략 문서

## 📋 목차

1. [개요](#개요)
2. [WebSocket 전략](#websocket-전략)
3. [구독 관리 전략](#구독-관리-전략)
4. [재연결 전략](#재연결-전략)
5. [Degraded Mode](#degraded-mode)
6. [데이터 병합 전략](#데이터-병합-전략)
7. [성능 최적화](#성능-최적화)

---

## 개요

실시간 암호화폐 대시보드는 **Binance WebSocket API**를 활용하여 실시간 가격 정보를 제공합니다. 이 문서는 실시간 데이터 처리 전략을 상세히 설명합니다.

### 핵심 원칙

1. **단일 연결, 다중 스트림**: 하나의 WebSocket 연결에 여러 심볼 스트림 구독
2. **자동 재연결**: 지수 백오프 전략으로 안정적인 재연결
3. **Degraded Mode**: WebSocket 실패 시 REST API 폴링으로 전환
4. **배치 업데이트**: 고빈도 메시지를 배치로 처리하여 성능 최적화

---

## WebSocket 전략

### Binance WebSocket API 구조

Binance는 **Combined Streams** 방식을 사용합니다:

```
wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker
```

**특징**:
- 연결 시점에 URL에 스트림 목록이 포함되어야 함
- 연결 후 동적으로 스트림 추가/제거하는 API가 없음
- 스트림 변경 시 **재연결 필수**

### 연결 관리

```typescript
// lib/websocket/binanceWebSocket.ts
export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private subscribedStreams: Set<string> = new Set();

  connect(): void {
    const streams = Array.from(this.subscribedStreams);
    const streamParams = streams.length > 0 
      ? `?streams=${streams.join('/')}`
      : '';
    
    const url = `${BINANCE_WS_BASE_URL}${streamParams}`;
    this.ws = new WebSocket(url);
    // ... 이벤트 핸들러 설정
  }
}
```

### 스트림 타입

1. **Ticker Stream**: `{symbol}@ticker`
   - 실시간 가격, 변동률, 거래량 등
   - 코인 목록 페이지에서 사용

2. **Kline Stream**: `{symbol}@kline_{interval}`
   - 캔들스틱 데이터 (1m, 5m, 1h 등)
   - 차트 페이지에서 사용

---

## 구독 관리 전략

### 변경 규모 감지

구독 변경 시 **대규모 변경**과 **소규모 변경**을 구분하여 최적의 전략을 선택합니다.

#### 대규모 변경 (전체 재구독)

다음 조건 중 하나라도 만족하면 전체 재구독:

1. **첫 구독**: `previousSymbols.length === 0`
2. **모든 구독 해제**: `currentSymbols.length === 0`
3. **변경 비율 50% 이상**: 
   ```typescript
   const changeRatio = Math.abs(previousSymbols.length - currentSymbols.length) 
     / Math.max(previousSymbols.length, currentSymbols.length);
   changeRatio >= 0.5
   ```
4. **공통 심볼 50% 미만**:
   ```typescript
   const commonSymbols = previousSymbols.filter(s => currentSymbols.includes(s));
   const commonRatio = commonSymbols.length / Math.max(previousSymbols.length, currentSymbols.length);
   commonRatio < 0.5
   ```

**동작**: `updateSubscription()` 호출 → 전체 재구독 (한 번만 재연결)

#### 소규모 변경 (차등 구독)

대규모 변경 조건을 만족하지 않으면 차등 구독:

**동작**:
1. 제거된 심볼: `unsubscribe()` 호출
2. 추가된 심볼: `subscribe()` 호출

**주의**: Binance API 제약으로 인해 실제로는 재연결이 필요하지만, 소규모 변경은 사용자 경험에 미치는 영향이 적습니다.

### 디바운스 적용

즐겨찾기 연속 클릭 시 재연결 폭증을 방지하기 위해 **디바운스**를 적용합니다:

```typescript
// components/CoinListClient.tsx
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

---

## 재연결 전략

### 지수 백오프 (Exponential Backoff)

재연결 시도 간격을 점진적으로 증가시킵니다:

```typescript
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 30000; // 30초
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // 지터 추가 (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}
```

**재연결 시도 간격**:
- 1회: ~1초
- 2회: ~2초
- 3회: ~4초
- 4회: ~8초
- ...
- 최대: 30초

### 재연결 시도 횟수 제한

최대 10회 재연결 시도 후 사용자에게 알림:

```typescript
private maxReconnectAttempts = 10;

hasReachedMaxAttempts(): boolean {
  return this.reconnectAttempts >= this.maxReconnectAttempts;
}
```

**사용자 경험**:
- 재연결 실패 시 Degraded Mode로 자동 전환
- UI에 재연결 시도 횟수 및 상태 표시

---

## Degraded Mode

### 목적

WebSocket 연결이 실패하거나 지속적으로 끊기는 경우, **REST API 폴링**으로 전환하여 기본 기능을 유지합니다.

### 전환 조건

1. **최대 재연결 시도 초과**: 10회 재연결 실패
2. **수동 전환**: 사용자가 폴링 모드 선택

### 구현

```typescript
// hooks/usePollingMode.ts
export function usePollingMode(options: UsePollingModeOptions) {
  const [isPolling, setIsPolling] = useState(false);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    // 주기적으로 REST API 호출
    const interval = setInterval(() => {
      fetchTickers(symbols);
    }, 5000); // 5초마다
  }, [symbols]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    clearInterval(interval);
  }, []);
}
```

### API 캐싱

폴링 모드에서 Rate Limit을 방지하기 위해 **API 응답 캐싱**을 사용:

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

**TTL (Time-To-Live)**: 60초

---

## 데이터 병합 전략

### 과거 데이터 + 실시간 데이터

차트에서 과거 Kline 데이터와 실시간 Kline 스트림을 병합합니다:

```typescript
// app/chart/ChartClient.tsx
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

### 데이터 Gap 처리

과거 데이터에 누락된 시간대가 있는 경우 자동으로 보완:

```typescript
// app/chart/ChartClient.tsx
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

## 성능 최적화

### 배치 업데이트

고빈도 WebSocket 메시지를 `requestAnimationFrame`으로 배치 처리:

```typescript
// stores/tickerStore.ts
let updateBuffer: Ticker[] = [];

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
- 초당 수백 개의 메시지를 배치로 처리
- React 리렌더링 횟수 최소화
- CPU 사용률 감소

### 정규화된 데이터 구조

Map 기반 저장으로 O(1) 조회 성능:

```typescript
// stores/tickerStore.ts
interface TickerStore {
  tickers: Map<string, Ticker>; // Map 기반
}

// O(1) 조회
getTicker(symbol: string): Ticker | undefined {
  return this.tickers.get(symbol);
}
```

### 메모이제이션

React 컴포넌트 및 훅에서 불필요한 재계산 방지:

- **React.memo**: 컴포넌트 메모이제이션
- **useMemo**: 계산 비용이 높은 값 메모이제이션
- **useCallback**: 함수 메모이제이션

---

## 모니터링

### 성능 통계

`/stats` 페이지에서 실시간 성능 지표를 모니터링:

- **초당 업데이트 수 (UPS)**: WebSocket 메시지 처리 속도
- **구독 중인 심볼 수**: 현재 구독 중인 스트림 수
- **WebSocket 연결 상태**: connected/disconnected/error
- **마지막 업데이트 시간**: 최근 데이터 업데이트 시각

### Web Vitals

Core Web Vitals를 자동으로 측정 및 보고:

- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)

---

## 참고 문서

- [아키텍처 문서](./architecture.md)
- [성능 분석 문서](./performance.md)
- [이슈 및 해결책](./issues-and-solutions.md)
- [디바운스 딥다이브](./points/debounce-deep-dive.md)
- [실시간/과거 데이터 병합 딥다이브](./points/realtime-historical-data-merge-deep-dive.md)

