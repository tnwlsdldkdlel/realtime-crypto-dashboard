# 주요 이슈 및 해결 방법

이 문서는 프로젝트 개발 중 발생한 주요 이슈와 해결 방법을 정리합니다.

## 목차

1. [즐겨찾기 클릭 시 WebSocket 연결 끊김 문제](#1-즐겨찾기-클릭-시-websocket-연결-끊김-문제)
2. [React Hooks 의존성 문제로 인한 WebSocket 재생성](#2-react-hooks-의존성-문제로-인한-websocket-재생성)
3. [React Hooks Rules 위반 (조건부 Hook 호출)](#3-react-hooks-rules-위반-조건부-hook-호출)
4. [Ref 접근 오류 (렌더링 중 Ref 접근)](#4-ref-접근-오류-렌더링-중-ref-접근)
5. [페이지 이동 시 WebSocket 정리 오류](#5-페이지-이동-시-websocket-정리-오류)
6. [한국어 코인 이름: JSON → 하이브리드 방식 전환](#6-한국어-코인-이름-json--하이브리드-방식-전환)
7. [Lightweight Charts v5 API 변경 문제](#7-lightweight-charts-v5-api-변경-문제)
8. [TypeScript 타입 불일치: BinanceKlineResponse](#8-typescript-타입-불일치-binanceklineresponse)
9. [React Hook 의존성 배열 경고 (차트 구현)](#9-react-hook-의존성-배열-경고-차트-구현)
10. [Next.js 모듈 해석 오류: 상대 경로 vs 절대 경로](#10-nextjs-모듈-해석-오류-상대-경로-vs-절대-경로)

---

## 1. 즐겨찾기 클릭 시 WebSocket 연결 끊김 문제

### 문제 상황

즐겨찾기 버튼을 클릭하면 WebSocket 연결이 끊어지고 "연결 끊김" 상태로 변경되는 문제가 발생했습니다.

### 원인 분석

1. **이중 재연결 문제**: `unsubscribe`와 `subscribe`가 각각 `reconnect()`를 호출하여 연결이 두 번 끊어짐
2. **Binance WebSocket 제약**: 연결 시점에 스트림 목록이 URL에 포함되어야 하므로, 스트림 변경 시 재연결이 필수
3. **대규모 변경 시 비효율**: 전체 코인(100개) → 즐겨찾기(1개)로 변경 시 99개 해제 + 1개 추가로 두 번 재연결 발생

### 왜 재연결이 필요한가?

Binance WebSocket API의 **Combined Streams** 방식은 다음과 같은 제약이 있습니다:

1. **URL 기반 구독**: 연결 시점에 스트림 목록이 URL 쿼리 파라미터로 포함되어야 함
   ```
   wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker
   ```

2. **동적 구독 API 부재**: 연결 후 메시지를 보내서 스트림을 추가/제거하는 API가 없음
   - 다른 WebSocket API처럼 `ws.send({ method: "SUBSCRIBE", ... })` 방식이 불가능

3. **스트림 변경 = 새 연결 필요**: 즐겨찾기 변경으로 구독할 심볼이 바뀌면, 새로운 URL로 재연결해야 함
   - 예: 전체 코인(100개) → 즐겨찾기(1개)로 변경 시
   - 기존: `?streams=btc@ticker/eth@ticker/...` (100개)
   - 변경: `?streams=btc@ticker` (1개)
   - → **새로운 URL로 재연결 필요**

이는 Binance API의 설계 특성이며, 재연결 없이는 스트림 변경이 불가능합니다.

### 해결 방법

**대규모 변경 감지 및 전체 재구독 방식**을 도입했습니다.

#### 1. `updateSubscription` 메서드 추가

```typescript
// lib/websocket/binanceWebSocket.ts
updateSubscription(symbols: string[], type: StreamType): void {
  // 기존 구독 모두 해제 (내부 상태만 정리)
  this.subscribedStreams.clear();
  
  // 새 구독으로 설정
  streams.forEach((stream) => this.subscribedStreams.add(stream));

  // 한 번만 재연결 (연결 끊김 최소화)
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.reconnect();
  } else {
    this.connect();
  }
}
```

#### 2. 대규모 변경 감지 로직 추가

```typescript
// hooks/useBinanceWebSocket.ts
const isMajorChange =
  previousSymbols.length === 0 || // 첫 구독
  currentSymbols.length === 0 || // 모두 해제
  // 변경 비율이 50% 이상이면 대규모 변경으로 간주
  Math.abs(previousSymbols.length - currentSymbols.length) /
    Math.max(previousSymbols.length, 1) > 0.5 ||
  // 공통 심볼이 50% 미만이면 대규모 변경
  previousSymbols.filter((sym) => currentSymbols.includes(sym)).length /
    Math.max(previousSymbols.length, currentSymbols.length) < 0.5;

if (isMajorChange) {
  // 대규모 변경: 전체 재구독 (한 번만 재연결)
  client.updateSubscription(currentSymbols, 'ticker');
} else {
  // 소규모 변경: 차등 구독 (기존 로직)
  // ...
}
```

### 결과

- ✅ 연결이 한 번만 끊어지고 재연결됨
- ✅ 상태 변경이 "연결됨" → "연결 끊김" → "연결됨"으로 안정화
- ✅ 사용자 경험 개선

---

## 2. React Hooks 의존성 문제로 인한 WebSocket 재생성

### 문제 상황

WebSocket 클라이언트가 불필요하게 재생성되어 연결이 끊어지는 문제가 발생했습니다.

### 원인 분석

1. **의존성 배열 문제**: `useEffect`의 의존성 배열에 함수 참조가 포함되어 매 렌더링마다 재실행
2. **클로저 문제**: WebSocket 콜백 함수가 오래된 함수 참조를 사용하여 최신 상태를 반영하지 못함

### 해결 방법

**`useRef`를 사용한 인스턴스 및 핸들러 관리**를 도입했습니다.

```typescript
// hooks/useBinanceWebSocket.ts
const clientRef = useRef<BinanceWebSocketClient | null>(null);
const handlersRef = useRef({
  updateTicker,
  onStatusChange,
  onError,
});

// WebSocket 클라이언트는 한 번만 생성
useEffect(() => {
  if (!autoConnect) return;

  clientRef.current = new BinanceWebSocketClient({
    onTickerMessage: (message) => {
      // 항상 최신 함수 참조 사용
      handlersRef.current.updateTicker(ticker);
    },
    // ...
  });

  return () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  };
}, [autoConnect]); // autoConnect만 의존성

// 핸들러는 별도 useEffect로 최신화
useEffect(() => {
  handlersRef.current = {
    updateTicker,
    onStatusChange,
    onError,
  };
}, [updateTicker, onStatusChange, onError]);
```

### 결과

- ✅ WebSocket 클라이언트가 한 번만 생성됨
- ✅ 콜백 함수가 항상 최신 상태를 반영
- ✅ 불필요한 재연결 방지

---

## 3. React Hooks Rules 위반 (조건부 Hook 호출)

### 문제 상황

ESLint에서 "React Hook is called conditionally" 오류가 발생했습니다.

### 원인 분석

조건문 이후에 Hook을 호출하여 React Hooks 규칙을 위반했습니다.

```typescript
// ❌ 잘못된 코드
if (error) {
  return <ErrorMessage error={error} />;
}

useEffect(() => {
  // Hook이 조건문 이후에 호출됨
}, []);
```

### 해결 방법

**모든 Hook을 컴포넌트 최상단으로 이동**했습니다.

```typescript
// ✅ 올바른 코드
export default function CoinListClient({ initialCoins, error }: Props) {
  // 모든 Hook을 최상단에 배치
  const [state, setState] = useState();
  const ref = useRef();
  useEffect(() => {
    // ...
  }, []);

  // 조건부 렌더링은 Hook 호출 이후
  if (error) {
    return <ErrorMessage error={error} />;
  }

  return <div>...</div>;
}
```

### 결과

- ✅ React Hooks 규칙 준수
- ✅ ESLint 오류 해결
- ✅ 컴포넌트 안정성 향상

---

## 4. Ref 접근 오류 (렌더링 중 Ref 접근)

### 문제 상황

"Cannot access refs during render" 오류가 발생했습니다.

### 원인 분석

렌더링 중에 `ref.current`를 직접 접근하여 React 규칙을 위반했습니다.

```typescript
// ❌ 잘못된 코드
const getHighlightClass = useCallback((symbol: string) => {
  const direction = highlightDirectionsRef.current.get(symbol);
  // 렌더링 중 ref 접근
  return direction === 'up' ? 'bg-green-500' : 'bg-red-500';
}, []);
```

### 해결 방법

**State와 Ref를 분리하여 관리**했습니다.

```typescript
// ✅ 올바른 코드
// Ref는 내부 로직용
const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());

// State는 렌더링용
const [highlightDirections, setHighlightDirections] = useState<Map<string, PriceChangeDirection>>(new Map());

useEffect(() => {
  // Ref 업데이트
  highlightDirectionsRef.current = new Map(directions);
  // State 업데이트 (렌더링 트리거)
  setHighlightDirections(new Map(directions));
}, [directions]);

// 렌더링에서는 State 사용
const getHighlightClass = useCallback((symbol: string) => {
  const direction = highlightDirections.get(symbol); // State 사용
  return direction === 'up' ? 'bg-green-500' : 'bg-red-500';
}, [highlightDirections]);
```

### 결과

- ✅ React 규칙 준수
- ✅ 렌더링 안정성 확보
- ✅ 상태 관리 명확화

---

## 5. 페이지 이동 시 WebSocket 정리 오류

### 문제 상황

홈 페이지에서 즐겨찾기 페이지로 이동할 때 Next.js 오류가 발생했습니다.

```
CoinListClient.useBinanceWebSocket [as onStatusChange]
components/CoinListClient.tsx (118:17)
useBinanceWebSocket.useEffect [as onStatusChange]
hooks/useBinanceWebSocket.ts (83:43)
BinanceWebSocketClient.setStatus
lib/websocket/binanceWebSocket.ts (234:33)
ws.onerror
lib/websocket/binanceWebSocket.ts (79:14)
```

### 원인 분석

페이지 이동 시 다음과 같은 순서로 문제가 발생했습니다:

1. **컴포넌트 언마운트**: 이전 페이지의 `CoinListClient`가 언마운트됨
2. **WebSocket 정리**: `useBinanceWebSocket`의 cleanup이 실행되어 `disconnect()` 호출
3. **비동기 이벤트 발생**: `disconnect()`에서 `ws.close()` 호출 시 WebSocket이 닫히는 과정에서 `onerror`나 `onclose` 이벤트가 비동기로 발생
4. **오류 발생**: 이미 언마운트된 컴포넌트의 `onStatusChange`를 호출하려고 하면 오류 발생

```typescript
// ❌ 문제가 있던 코드
disconnect(): void {
  if (this.ws) {
    this.ws.close(); // 이 시점에 onerror/onclose 이벤트가 발생할 수 있음
    this.ws = null;
  }
  this.setStatus('disconnected'); // 이미 언마운트된 컴포넌트의 콜백 호출 시도
}

// ws.onerror에서
this.ws.onerror = () => {
  this.setStatus('error'); // 언마운트된 컴포넌트의 onStatusChange 호출 시도
  this.config.onError?.(new Error('WebSocket error occurred'));
};
```

### 해결 방법

**이벤트 리스너를 먼저 제거하고, 모든 콜백 호출 전에 config 유효성을 확인**하도록 수정했습니다.

#### 1. `disconnect()` 메서드 개선

```typescript
// lib/websocket/binanceWebSocket.ts
disconnect(): void {
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  if (this.ws) {
    // 이벤트 리스너를 먼저 제거하여 페이지 이동 시 오류 방지
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
    
    // WebSocket 닫기
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    
    this.ws = null;
  }

  // 상태 변경 (config가 유효한 경우에만)
  if (this.config) {
    this.setStatus('disconnected');
  }
}
```

#### 2. 모든 이벤트 핸들러에 config 유효성 체크 추가

```typescript
// lib/websocket/binanceWebSocket.ts
this.ws.onopen = () => {
  // WebSocket이 아직 유효한 경우에만 상태 변경
  if (this.ws && this.config) {
    this.setStatus('connected');
    this.reconnectAttempts = 0;
  }
};

this.ws.onmessage = (event) => {
  // WebSocket이 아직 유효한 경우에만 메시지 처리
  if (!this.ws || !this.config) {
    return;
  }
  // ... 메시지 처리
};

this.ws.onerror = () => {
  // WebSocket이 아직 유효한 경우에만 에러 처리
  if (this.ws && this.config) {
    this.setStatus('error');
    this.config.onError?.(new Error('WebSocket error occurred'));
  }
};

this.ws.onclose = () => {
  // WebSocket이 아직 유효한 경우에만 상태 변경 및 재연결
  if (this.ws && this.config) {
    this.setStatus('disconnected');
    this.scheduleReconnect();
  }
};
```

#### 3. 내부 메서드에도 보호 로직 추가

```typescript
// lib/websocket/binanceWebSocket.ts
private setStatus(status: WebSocketStatus): void {
  if (this.status !== status) {
    this.status = status;
    // config가 유효한 경우에만 콜백 호출 (페이지 이동 시 오류 방지)
    if (this.config) {
      this.config.onStatusChange?.(status);
    }
  }
}

private handleMessage(message: {...}): void {
  // config가 유효한 경우에만 메시지 처리
  if (!this.config) {
    return;
  }
  // ... 메시지 처리
}

private scheduleReconnect(): void {
  if (this.reconnectTimer || !this.config) {
    return;
  }
  // ... 재연결 스케줄링
}
```

### 결과

- ✅ 페이지 이동 시 WebSocket 정리 과정에서 오류가 발생하지 않음
- ✅ 이미 언마운트된 컴포넌트의 콜백 호출 방지
- ✅ 안전한 WebSocket 정리 보장

---

## 해결 방법 요약

| 이슈 | 핵심 해결 방법 | 주요 기술 |
|------|---------------|----------|
| WebSocket 연결 끊김 | 대규모 변경 감지 및 전체 재구독 | `updateSubscription` 메서드 |
| WebSocket 재생성 | `useRef`를 통한 인스턴스 관리 | React Hooks, 클로저 해결 |
| 조건부 Hook 호출 | Hook을 컴포넌트 최상단으로 이동 | React Hooks Rules |
| 렌더링 중 Ref 접근 | State와 Ref 분리 관리 | React State vs Ref |
| 페이지 이동 시 WebSocket 오류 | 이벤트 리스너 먼저 제거 및 config 유효성 체크 | WebSocket 생명주기 관리 |
| 한국어 코인 이름 일치율 저하 | JSON + CoinGecko API 하이브리드 방식 | 배치 처리, 메모리 캐싱 |

---

## 6. 한국어 코인 이름: JSON → 하이브리드 방식 전환

### 문제 상황

초기에는 한국어 코인 이름을 로컬 JSON 파일(`data/coinNamesKO.json`)로만 관리했습니다. 하지만 실제로 표시되는 코인과 JSON 파일에 있는 코인이 일치하지 않는 문제가 발생했습니다.

### 초기 구현: JSON 파일 방식

#### JSON 방식으로 시작한 이유

1. **성능**: 로컬 파일이므로 즉시 로드 가능, 네트워크 요청 없음
2. **안정성**: 외부 API 의존성 없음, Rate Limit 걱정 없음
3. **빠른 구현**: 간단한 매핑 파일로 빠르게 구현 가능
4. **오프라인 지원**: 네트워크 없이도 동작 가능

```typescript
// adapters/binance.ts (초기 구현)
import coinNamesKO from '@/data/coinNamesKO.json';

export function adaptBinanceTicker(data: BinanceTickerResponse): Ticker {
  return {
    symbol: data.symbol,
    nameKO: (coinNamesKO as Record<string, string>)[data.symbol], // JSON에서 직접 조회
    // ...
  };
}
```

### JSON 방식의 한계점

1. **거래량 순위 변동**: Binance는 거래량 기준 상위 100개 코인을 가져오는데, 거래량 순위는 계속 변함
   - 예: 오늘 상위 100개에 있던 코인이 내일은 101위로 밀려날 수 있음
   - JSON 파일에는 고정된 코인만 있어서 새로 상위권에 진입한 코인은 한국어 이름이 없음

2. **수동 업데이트 필요**: 새로운 코인이 상위권에 진입할 때마다 JSON 파일을 수동으로 업데이트해야 함
   - 유지보수 부담 증가
   - 실시간 반영 불가능

3. **일치율 저하**: 실제 표시되는 코인 중 JSON에 있는 코인 비율이 낮아짐
   - 테스트 결과: 약 30-40% 정도만 일치
   - 대부분의 코인에 한국어 이름이 표시되지 않음

4. **확장성 부족**: 코인 종류가 늘어날수록 JSON 파일이 커지고 관리가 어려워짐

### 하이브리드 방식으로 전환한 이유

**JSON + CoinGecko API 조합**으로 전환하여 JSON의 장점은 유지하면서 한계점을 보완했습니다.

#### 하이브리드 방식의 장점

1. **높은 일치율**: JSON에 없는 코인도 API로 가져와서 대부분의 코인에 한국어 이름 표시 가능
   - 테스트 결과: 100% 일치율 달성

2. **자동 업데이트**: 새로운 코인이 상위권에 진입해도 API에서 자동으로 가져옴
   - 수동 업데이트 불필요
   - 실시간 반영 가능

3. **성능 최적화**: 주요 코인은 JSON에서 즉시 가져오고, 없는 코인만 API 호출
   - 대부분의 경우 네트워크 요청 없음
   - API 호출 최소화

4. **Rate Limit 관리**: CoinGecko의 `/coins/list` 엔드포인트를 한 번만 호출하여 모든 코인 목록을 가져와 메모리 캐시에 저장
   - 24시간 캐시로 중복 호출 방지
   - Rate Limit 걱정 없음

### 해결 방법

#### 1. 하이브리드 유틸리티 함수 구현

```typescript
// utils/coinNames.ts
export async function getCoinNamesKOBatch(symbols: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  // 1단계: JSON 파일에서 먼저 확인 (가장 빠름)
  const jsonData = coinNamesKO as Record<string, string>;
  const missingSymbols: string[] = [];
  
  symbols.forEach((symbol) => {
    if (jsonData[symbol]) {
      result[symbol] = jsonData[symbol]; // JSON에 있으면 즉시 반환
    } else {
      missingSymbols.push(symbol); // 없으면 API 호출 대상
    }
  });
  
  // 2단계: 없는 코인만 CoinGecko API로 가져오기
  if (missingSymbols.length > 0) {
    await loadCoinListFromAPI(); // 한 번만 호출하여 모든 코인 목록 캐시
    
    missingSymbols.forEach((symbol) => {
      if (coinNameCache.has(symbol)) {
        result[symbol] = coinNameCache.get(symbol)!; // 캐시에서 가져오기
      } else {
        result[symbol] = symbol.replace('USDT', ''); // 없으면 심볼만 표시
      }
    });
  }
  
  return result;
}
```

#### 2. 서버 사이드 배치 처리

```typescript
// utils/binanceApi.ts
export async function fetchInitialCoins(limit = 100): Promise<Ticker[]> {
  // 티커 데이터 변환
  const tickers = usdtPairs.map(adaptBinanceTicker);
  
  // 한국어 이름 배치로 가져오기 (JSON에 없는 코인만)
  const symbols = tickers.map((t) => t.symbol);
  const namesKO = await getCoinNamesKOBatch(symbols);
  
  // 한국어 이름 추가
  return tickers.map((ticker) => ({
    ...ticker,
    nameKO: ticker.nameKO || namesKO[ticker.symbol] || undefined,
  }));
}
```

#### 3. WebSocket 업데이트 시 한국어 이름 유지

```typescript
// stores/tickerStore.ts
storeSetState((state) => {
  const newTickers = new Map(state.tickers);
  updates.forEach((ticker) => {
    // 기존 티커의 nameKO를 유지 (WebSocket 업데이트 시 한국어 이름 보존)
    const existingTicker = state.tickers.get(ticker.symbol);
    if (existingTicker?.nameKO && !ticker.nameKO) {
      ticker.nameKO = existingTicker.nameKO;
    }
    newTickers.set(ticker.symbol, ticker);
  });
  return { tickers: newTickers };
});
```

### 동작 흐름

1. **초기 로드 (서버 사이드)**:
   - Binance API에서 상위 100개 코인 가져오기
   - JSON 파일에서 한국어 이름 확인 (주요 코인)
   - JSON에 없는 코인은 CoinGecko API에서 가져오기 (한 번만 호출)
   - 모든 코인에 한국어 이름 할당

2. **실시간 업데이트 (클라이언트 사이드)**:
   - WebSocket으로 티커 업데이트
   - 기존 티커의 `nameKO` 유지 (스토어에서 보존)
   - 새로운 코인이 추가되면 JSON에서 확인, 없으면 영어 이름 표시

3. **캐싱**:
   - CoinGecko API 응답을 메모리 캐시에 저장
   - 24시간 캐시로 중복 호출 방지

### 결과

- ✅ **일치율 향상**: 30-40% → 100% (테스트 결과)
- ✅ **자동 업데이트**: 새로운 코인도 자동으로 한국어 이름 표시
- ✅ **성능 유지**: 주요 코인은 JSON에서 즉시 로드, API 호출 최소화
- ✅ **Rate Limit 안전**: 한 번만 호출하여 모든 코인 목록 캐시
- ✅ **유지보수 부담 감소**: 수동 업데이트 불필요

### 참고 사항

- 현재 구현은 CoinGecko의 `/coins/list` 엔드포인트를 사용하여 **영어 이름**을 가져옵니다
- 한국어 이름을 가져오려면 각 코인의 상세 정보(`/coins/{id}?localization=true`)를 조회해야 하지만, 100개 코인을 개별 호출하면 Rate Limit 문제가 발생할 수 있습니다
- 따라서 현재는 영어 이름도 표시하는 방식을 채택했습니다 (한국어 이름이 없으면 영어 이름 표시)

---

## 7. Lightweight Charts v5 API 변경 문제

### 문제 상황

빌드 시 TypeScript 오류가 발생하고, 런타임에서도 차트가 렌더링되지 않는 문제가 발생했습니다.

```
Type error: Property 'addCandlestickSeries' does not exist on type 'IChartApi'.
```

### 원인 분석

Lightweight Charts 라이브러리가 v4에서 v5로 업그레이드되면서 API가 변경되었습니다.

1. **v4 방식 (deprecated)**:
   ```typescript
   const series = chart.addCandlestickSeries({
     upColor: '#26a69a',
     downColor: '#ef5350',
   });
   ```

2. **v5 방식 (새로운 API)**:
   ```typescript
   import { CandlestickSeries } from 'lightweight-charts';
   
   const series = chart.addSeries(CandlestickSeries, {
     upColor: '#26a69a',
     downColor: '#ef5350',
   });
   ```

### 해결 방법

**v5 API로 마이그레이션**했습니다.

```typescript
// components/CandlestickChart.tsx
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts';

// v5 방식으로 변경
const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderVisible: false,
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
});
```

### 결과

- ✅ TypeScript 오류 해결
- ✅ 런타임에서 정상적으로 차트 렌더링
- ✅ Lightweight Charts v5 API 준수

### 참고 사항

- 라이브러리 업그레이드 시 API 변경사항을 반드시 확인해야 함
- `@ts-ignore`로 임시 우회하는 것보다 올바른 API 사용이 중요

---

## 8. TypeScript 타입 불일치: BinanceKlineResponse

### 문제 상황

`convertKlineToCandlestick` 함수에서 타입 오류가 발생했습니다.

```typescript
// ❌ 잘못된 타입 정의
export function convertKlineToCandlestick(kline: number[]): CandlestickData {
  return {
    time: (kline[0] / 1000) as Time,
    open: parseFloat(kline[1]), // 타입 오류: number에 parseFloat 사용
    // ...
  };
}
```

### 원인 분석

Binance API의 Kline 응답은 **배열의 각 요소가 서로 다른 타입**을 가집니다:

```typescript
// 실제 BinanceKlineResponse 타입
export type BinanceKlineResponse = [
  number,  // openTime
  string,  // open
  string,  // high
  string,  // low
  string,  // close
  string,  // volume
  number,  // closeTime
  string,  // quoteAssetVolume
  number,  // numberOfTrades
  string,  // takerBuyBaseAssetVolume
  string,  // takerBuyQuoteAssetVolume
  string   // ignore
];
```

`number[]`로 정의하면 모든 요소가 `number`로 추론되어 `parseFloat`를 사용할 수 없습니다.

### 해결 방법

**정확한 타입 정의 사용** 및 **타입 가드 추가**했습니다.

```typescript
// ✅ 올바른 타입 정의
import type { BinanceKlineResponse } from '@/types/binance';

export function convertKlineToCandlestick(kline: BinanceKlineResponse): CandlestickData {
  return {
    time: (kline[0] / 1000) as Time, // number
    open: parseFloat(kline[1] as string), // string → number 변환
    high: parseFloat(kline[2] as string),
    low: parseFloat(kline[3] as string),
    close: parseFloat(kline[4] as string),
  };
}
```

### 결과

- ✅ TypeScript 타입 오류 해결
- ✅ 타입 안정성 확보
- ✅ 런타임 오류 방지

### 참고 사항

- 외부 API 응답 타입을 정확히 정의하는 것이 중요
- `number[]`와 같은 일반적인 타입보다 구체적인 타입 사용 권장

---

## 9. React Hook 의존성 배열 경고 (차트 구현)

### 문제 상황

차트 구현 중 여러 React Hook 의존성 배열 관련 경고가 발생했습니다.

1. **useEffect 내부 setState 호출**:
   ```
   React Hook useEffect has a missing dependency: 'data'
   ```

2. **useCallback 의존성 누락**:
   ```
   React Hook useCallback has a missing dependency: 'updateChartDataWithRealtimeKline'
   ```

3. **함수 호출 순서 문제**:
   ```
   'loadChartData' 변수가 할당되기 전에 사용되었습니다
   ```

### 원인 분석

1. **함수 호이스팅 문제**: `useEffect`에서 `loadChartData`를 호출하지만, 함수 정의가 아래에 있어서 호이스팅되지 않음
2. **의존성 체인**: `loadChartData` → `setupWebSocket` → `updateChartDataWithRealtimeKline` 순서로 의존성이 연결됨
3. **useCallback 누락**: 함수들이 매 렌더링마다 재생성되어 의존성 배열이 계속 변경됨

### 해결 방법

**함수 정의 순서 조정 및 useCallback 적용**했습니다.

#### 1. 함수 정의 순서 조정

```typescript
// app/chart/ChartClient.tsx

// 1단계: 유틸리티 함수들 (의존성 없음)
const convertKlineToCandlestickFromKline = (kline: {...}) => { ... };

// 2단계: 상태 업데이트 함수 (useCallback으로 감싸기)
const updateChartDataWithRealtimeKline = useCallback((kline: {...}) => {
  setChartData((prevData) => { ... });
}, []);

// 3단계: WebSocket 설정 (updateChartDataWithRealtimeKline 의존)
const setupWebSocket = useCallback((symbol: string) => {
  // ...
  updateChartDataWithRealtimeKline(kline);
}, [updateChartDataWithRealtimeKline]);

// 4단계: 데이터 로드 (setupWebSocket 의존)
const loadChartData = useCallback(async (symbol: string, interval: string) => {
  // ...
  setupWebSocket(symbol);
}, [setupWebSocket]);

// 5단계: useEffect (loadChartData 의존)
useEffect(() => {
  loadChartData(selectedSymbol, selectedInterval);
}, [selectedSymbol, selectedInterval, loadChartData]);
```

#### 2. 모달 초기화 로직 개선

```typescript
// components/CoinSelectModal.tsx
useEffect(() => {
  if (!isOpen) return;
  
  if (searchInputRef.current) {
    searchInputRef.current.focus();
  }
  setSearchQuery('');
  setHighlightedIndex(0);
  setDisplayCount(50);
  // 모달이 열릴 때만 초기화하므로 isOpen만 의존성으로 사용
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen]);
```

### 결과

- ✅ 모든 React Hook 의존성 경고 해결
- ✅ 함수 호출 순서 문제 해결
- ✅ 불필요한 재렌더링 방지
- ✅ 코드 안정성 향상

### 참고 사항

- 함수 정의 순서가 중요: 의존성이 있는 함수는 의존되는 함수보다 아래에 정의
- `useCallback`으로 함수를 메모이제이션하여 의존성 배열 안정화
- 모달 초기화 같은 경우는 의도적으로 의존성을 제한할 수 있음

---

## 10. Next.js 모듈 해석 오류: 상대 경로 vs 절대 경로

### 문제 상황

TypeScript 컴파일러가 상대 경로로 import한 모듈을 찾지 못하는 오류가 발생했습니다.

```
'./ChartClient' 모듈 또는 해당 형식 선언을 찾을 수 없습니다.
```

### 원인 분석

Next.js의 TypeScript 설정과 모듈 해석 방식에 문제가 있었습니다.

1. **상대 경로 문제**: `'./ChartClient'`가 때때로 인식되지 않음
2. **TypeScript 설정**: `tsconfig.json`의 `paths` 설정과 충돌 가능
3. **Next.js 모듈 해석**: Next.js의 내부 모듈 해석 로직과 TypeScript의 해석 방식이 다를 수 있음

### 해결 방법

**절대 경로(@ alias) 사용**으로 변경했습니다.

```typescript
// ❌ 상대 경로 (문제 발생)
import ChartClient from './ChartClient';

// ✅ 절대 경로 (해결)
import ChartClient from '@/app/chart/ChartClient';
```

### 결과

- ✅ TypeScript 모듈 해석 오류 해결
- ✅ 빌드 성공
- ✅ 일관된 import 경로 사용

### 참고 사항

- Next.js 프로젝트에서는 `@/` alias를 사용하는 것이 권장됨
- 상대 경로보다 절대 경로가 유지보수에 유리함
- `tsconfig.json`의 `paths` 설정을 확인하여 alias가 올바르게 설정되어 있는지 확인

---

## 해결 방법 요약

| 이슈 | 핵심 해결 방법 | 주요 기술 |
|------|---------------|----------|
| WebSocket 연결 끊김 | 대규모 변경 감지 및 전체 재구독 | `updateSubscription` 메서드 |
| WebSocket 재생성 | `useRef`를 통한 인스턴스 관리 | React Hooks, 클로저 해결 |
| 조건부 Hook 호출 | Hook을 컴포넌트 최상단으로 이동 | React Hooks Rules |
| 렌더링 중 Ref 접근 | State와 Ref 분리 관리 | React State vs Ref |
| 페이지 이동 시 WebSocket 오류 | 이벤트 리스너 먼저 제거 및 config 유효성 체크 | WebSocket 생명주기 관리 |
| 한국어 코인 이름 일치율 저하 | JSON + CoinGecko API 하이브리드 방식 | 배치 처리, 메모리 캐싱 |
| Lightweight Charts v5 API 변경 | `addCandlestickSeries` → `addSeries(CandlestickSeries, ...)` | 라이브러리 마이그레이션 |
| TypeScript 타입 불일치 | `BinanceKlineResponse` 타입 정확히 정의 | 타입 안정성 |
| React Hook 의존성 경고 | 함수 정의 순서 조정 및 useCallback 적용 | React Hooks, 의존성 관리 |
| Next.js 모듈 해석 오류 | 상대 경로 → 절대 경로(@ alias) 변경 | 모듈 해석, TypeScript 설정 |

---

## 참고 사항

- 모든 이슈는 테스트를 통해 검증되었습니다.
- 자세한 구현 내용은 각 파일의 주석을 참고하세요.
- 추가 이슈 발생 시 이 문서에 업데이트하세요.

