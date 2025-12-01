# 학습 포인트 (Learning Points)

이 문서는 프로젝트에서 구현된 주요 기술과 패턴에 대한 학습 가이드입니다.

---

## 📚 목차

1. [requestAnimationFrame을 사용한 배치 업데이트](#1-requestanimationframe을-사용한-배치-업데이트)
2. [지수 백오프(Exponential Backoff) 재연결 전략](#2-지수-백오프exponential-backoff-재연결-전략)
3. [어댑터 패턴(Adapter Pattern)](#3-어댑터-패턴adapter-pattern)
4. [리포지토리 패턴(Repository Pattern)](#4-리포지토리-패턴repository-pattern)
5. [Server Components와 Client Components 분리](#5-server-components와-client-components-분리)
6. [Rate Limit 처리 및 재시도 로직](#6-rate-limit-처리-및-재시도-로직)
7. [디바운스된 재연결](#7-디바운스된-재연결)
8. [Map을 사용한 정규화된 데이터 구조](#8-map을-사용한-정규화된-데이터-구조)
9. [커스텀 훅을 통한 WebSocket 관리](#9-커스텀-훅을-통한-websocket-관리)
10. [React ref를 사용한 의존성 문제 해결](#10-react-ref를-사용한-의존성-문제-해결)
11. [반응형 테이블 레이아웃 디자인](#11-반응형-테이블-레이아웃-디자인)
12. [가격 변경 감지 및 애니메이션 스로틀링](#12-가격-변경-감지-및-애니메이션-스로틀링)
13. [Zustand Persist Middleware를 활용한 영구 저장](#13-zustand-persist-middleware를-활용한-영구-저장)
14. [디바운스 패턴을 활용한 WebSocket 재구독 최적화](#14-디바운스-패턴을-활용한-websocket-재구독-최적화)
15. [동적 WebSocket 구독 및 대규모 변경 감지](#15-동적-websocket-구독-및-대규모-변경-감지)
16. [Lightweight Charts 라이브러리 통합 및 외부 차트 라이브러리 사용 패턴](#16-lightweight-charts-라이브러리-통합-및-외부-차트-라이브러리-사용-패턴)
17. [실시간 데이터와 과거 데이터 병합 전략](#17-실시간-데이터와-과거-데이터-병합-전략)
18. [데이터 간격 감지 및 메우기 (Data Gap Handling)](#18-데이터-간격-감지-및-메우기-data-gap-handling)
19. [Intersection Observer를 활용한 무한 스크롤 구현](#19-intersection-observer를-활용한-무한-스크롤-구현)
20. [Combobox/Modal UI 패턴: 검색 가능한 대용량 리스트 선택](#20-comboboxmodal-ui-패턴-검색-가능한-대용량-리스트-선택)
21. [useCallback을 활용한 함수 메모이제이션 및 의존성 체인 관리](#21-usecallback을-활용한-함수-메모이제이션-및-의존성-체인-관리)

---

## 1. requestAnimationFrame을 사용한 배치 업데이트

**위치**: `stores/tickerStore.ts`

### 핵심 개념

고빈도 실시간 데이터 업데이트를 효율적으로 처리하기 위해 배치 업데이트 패턴을 사용합니다. `requestAnimationFrame`을 활용하여 브라우저의 렌더링 사이클과 동기화하여 성능을 최적화합니다.

### 구현 코드

```typescript
/**
 * 배치 업데이트를 위한 임시 버퍼
 */
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;

/**
 * requestAnimationFrame을 사용한 배치 업데이트
 */
function flushUpdates() {
  if (updateBuffer.length === 0 || !storeSetState) return;

  const updates = [...updateBuffer];
  updateBuffer = [];

  storeSetState((state) => {
    const newTickers = new Map(state.tickers);
    updates.forEach((ticker) => {
      newTickers.set(ticker.symbol, ticker);
    });
    return { tickers: newTickers };
  });

  rafId = null;
}

/**
 * 배치 업데이트 스케줄링
 */
function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}
```

### 학습 가치

- **성능 최적화**: 초당 수백 개의 업데이트를 한 번에 처리하여 리렌더링 횟수 감소
- **브라우저 동기화**: `requestAnimationFrame`으로 브라우저 렌더링 타이밍과 맞춤
- **초기 데이터 최적화**: 초기 데이터는 즉시 반영, 실시간 업데이트만 배치 처리

### 실무 적용

- 실시간 주식/암호화폐 가격 업데이트
- 게임 상태 업데이트
- 센서 데이터 시각화
- 채팅 메시지 배치 처리

---

## 2. 지수 백오프(Exponential Backoff) 재연결 전략

**위치**: `lib/websocket/binanceWebSocket.ts`

### 핵심 개념

네트워크 연결이 끊어졌을 때 재연결을 시도하되, 시도 횟수가 증가할수록 대기 시간을 지수적으로 늘리는 전략입니다. 지터(Jitter)를 추가하여 여러 클라이언트가 동시에 재연결을 시도하는 것을 방지합니다.

### 구현 코드

```typescript
/**
 * 지수 백오프 재연결 전략
 */
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 30000; // 30초
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // 지터 추가 (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

/**
 * 지수 백오프 재연결 스케줄링
 */
private scheduleReconnect(): void {
  if (this.reconnectTimer) {
    return;
  }

  const delay = getReconnectDelay(this.reconnectAttempts);
  this.reconnectAttempts++;

  this.reconnectTimer = setTimeout(() => {
    this.reconnectTimer = null;
    this.connect();
  }, delay);
}
```

### 학습 가치

- **서버 부하 감소**: 재연결 시도를 점진적으로 늘려 서버에 부담을 주지 않음
- **지터 효과**: 랜덤 변동을 추가하여 동시 재연결 방지 (Thundering Herd 문제 해결)
- **최대 지연 제한**: 무한 대기를 방지하기 위해 최대 지연 시간 설정

### 재연결 시도 패턴

```
시도 1: ~1초 후
시도 2: ~2초 후
시도 3: ~4초 후
시도 4: ~8초 후
시도 5: ~16초 후
시도 6+: ~30초 후 (최대 지연)
```

### 실무 적용

- WebSocket 재연결
- API 재시도 로직
- 분산 시스템의 서비스 재연결
- 데이터베이스 연결 풀 관리

---

## 3. 어댑터 패턴(Adapter Pattern)

**위치**: `adapters/binance.ts`

### 핵심 개념

외부 API의 데이터 형식을 내부 도메인 타입으로 변환하는 패턴입니다. API 변경 시 영향 범위를 최소화하고, 코드의 유지보수성을 높입니다.

### 구현 코드

```typescript
/**
 * Binance REST API 티커 응답을 도메인 타입으로 변환
 */
export function adaptBinanceTicker(data: BinanceTickerResponse): Ticker {
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice || data.price || '0'),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume),
    highPrice: parseFloat(data.highPrice),
    lowPrice: parseFloat(data.lowPrice),
    lastUpdateTime: Date.now(),
  };
}

/**
 * Binance WebSocket 티커 스트림 메시지를 도메인 타입으로 변환
 */
export function adaptBinanceTickerStream(
  message: BinanceTickerStreamMessage
): Ticker {
  const { data } = message;
  return {
    symbol: data.s,
    price: parseFloat(data.c),
    priceChange: parseFloat(data.p),
    priceChangePercent: parseFloat(data.P),
    volume: parseFloat(data.v),
    highPrice: parseFloat(data.h),
    lowPrice: parseFloat(data.l),
    lastUpdateTime: data.E,
  };
}
```

### 학습 가치

- **관심사 분리**: API 형식 변환 로직을 한 곳에 집중
- **유지보수성**: API 변경 시 어댑터만 수정하면 됨
- **테스트 용이성**: 순수 함수로 테스트하기 쉬움
- **재사용성**: 여러 곳에서 동일한 변환 로직 사용

### 실무 적용

- 외부 API 통합
- 레거시 시스템 연동
- 데이터베이스 스키마 변환
- 다양한 데이터 소스 통합

---

## 4. 리포지토리 패턴(Repository Pattern)

**위치**: `repositories/tickerRepository.ts` + `stores/tickerStore.ts`

### 핵심 개념

데이터 접근 계층을 추상화하여 비즈니스 로직과 데이터 저장소를 분리하는 패턴입니다. 상태 관리 라이브러리에 종속되지 않고, 나중에 다른 구현체로 교체할 수 있도록 합니다.

### 구현 코드

```typescript
/**
 * Ticker 리포지토리 인터페이스
 */
export interface TickerRepository {
  getAllTickers(): TickerMap;
  getTicker(symbol: string): Ticker | undefined;
  updateTicker(ticker: Ticker): void;
  updateTickers(tickers: Ticker[]): void;
  clearTickers(): void;
}

/**
 * Zustand로 구현한 리포지토리
 */
export const useTickerStore = create<TickerStore>((set, get) => {
  return {
    tickers: new Map(),
    getAllTickers: () => get().tickers,
    getTicker: (symbol: string) => get().tickers.get(symbol),
    // ...
  };
});
```

### 학습 가치

- **의존성 역전**: 인터페이스에 의존하여 구현체 교체 가능
- **테스트 용이성**: Mock 리포지토리로 쉽게 테스트 가능
- **유연성**: Zustand → Redux → 다른 라이브러리로 교체 가능
- **단일 책임**: 데이터 접근 로직만 담당

### 실무 적용

- 상태 관리 라이브러리 교체 시
- 서버 사이드와 클라이언트 사이드 데이터 소스 분리
- 캐싱 전략 변경 시
- 데이터베이스 ORM 교체 시

---

## 5. Server Components와 Client Components 분리

**위치**: `app/page.tsx` (Server) + `components/CoinListClient.tsx` (Client)

### 핵심 개념

Next.js App Router에서 서버 컴포넌트와 클라이언트 컴포넌트를 적절히 분리하여 초기 로딩 성능을 최적화하고, 필요한 부분만 클라이언트 JavaScript를 전송합니다.

### 구현 코드

```typescript
/**
 * Server Component: 서버에서 데이터 페칭
 */
// app/page.tsx
export default async function Home() {
  let initialCoins: Awaited<ReturnType<typeof fetchInitialCoins>> = [];
  let error: string | null = null;

  try {
    // 서버 사이드에서 초기 코인 데이터 페칭
    initialCoins = await fetchInitialCoins(100);
  } catch (err) {
    error = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
  }

  return (
    <main>
      <CoinListClient initialCoins={initialCoins} error={error} />
    </main>
  );
}

/**
 * Client Component: 클라이언트에서 상태 관리 및 인터랙션
 */
// components/CoinListClient.tsx
'use client';

export default function CoinListClient({
  initialCoins,
  error,
}: CoinListClientProps) {
  const { updateTickers } = useTickerStore();

  useEffect(() => {
    if (initialCoins.length > 0) {
      updateTickers(initialCoins);
    }
  }, [initialCoins, updateTickers]);

  // ...
}
```

### 학습 가치

- **초기 로딩 성능**: 서버에서 데이터를 페칭하여 HTML에 포함
- **번들 크기 감소**: 필요한 부분만 클라이언트 JavaScript 전송
- **SEO 최적화**: 서버에서 렌더링된 HTML 제공
- **하이드레이션 전략**: 서버 데이터 → 클라이언트 상태 전환

### 실무 적용

- 초기 데이터가 중요한 페이지
- SEO가 중요한 웹사이트
- 대용량 데이터 처리
- 사용자 인증이 필요한 페이지

---

## 6. Rate Limit 처리 및 재시도 로직

**위치**: `utils/binanceApi.ts`

### 핵심 개념

API Rate Limit을 감지하고, `Retry-After` 헤더를 활용하여 적절한 시간 후 재시도하는 로직입니다. 서버 부하를 줄이고 안정적인 API 호출을 보장합니다.

### 구현 코드

```typescript
/**
 * Rate Limit 처리 및 재시도 로직
 */
async function fetchWithRetry(
  url: string,
  retries = 3,
  retryDelay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      });

      // Rate Limit 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : retryDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue; // 재시도
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Failed to fetch after retries');
}
```

### 학습 가치

- **HTTP 429 처리**: Rate Limit 에러를 명시적으로 처리
- **Retry-After 헤더 활용**: 서버가 지정한 대기 시간 사용
- **재시도 전략**: 실패 시 자동 재시도, 최대 재시도 횟수 제한
- **에러 복구**: 일시적 오류에서 자동 복구

### 실무 적용

- 외부 API 통합
- 크롤링 및 데이터 수집
- 마이크로서비스 간 통신
- 제3자 서비스 연동

---

## 7. 디바운스된 재연결

**위치**: `lib/websocket/binanceWebSocket.ts`

### 핵심 개념

연속된 재연결 요청을 디바운스하여 불필요한 재연결을 방지합니다. 특히 구독 목록이 자주 변경될 때 유용합니다.

### 구현 코드

```typescript
/**
 * 재연결 (디바운스)
 */
private reconnect(): void {
  this.disconnect();
  // 디바운스: 300ms 후 재연결
  setTimeout(() => {
    this.connect();
  }, 300);
}

/**
 * 스트림 구독
 */
subscribe(symbols: string[], type: StreamType): void {
  const streams = symbols.map((symbol) => {
    const symbolLower = symbol.toLowerCase();
    return type === 'ticker' 
      ? `${symbolLower}@ticker`
      : `${symbolLower}@kline_1m`;
  });

  streams.forEach((stream) => this.subscribedStreams.add(stream));

  // 재연결이 필요한 경우 디바운스된 재연결
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.reconnect(); // 300ms 디바운스
  } else {
    this.connect();
  }
}
```

### 학습 가치

- **성능 최적화**: 연속된 재연결 요청을 하나로 묶음
- **서버 부하 감소**: 불필요한 연결/해제 반복 방지
- **사용자 경험**: 빠른 연속 클릭에도 안정적인 동작

### 디바운스 vs 스로틀

- **디바운스**: 마지막 호출 후 일정 시간 지연 후 실행
- **스로틀**: 일정 시간마다 최대 한 번 실행

### 실무 적용

- 검색 자동완성
- 창 크기 조정 이벤트
- 스크롤 이벤트
- WebSocket 재연결
- 폼 입력 검증

---

## 8. Map을 사용한 정규화된 데이터 구조

**위치**: `stores/tickerStore.ts`

### 핵심 개념

배열 대신 Map을 사용하여 데이터를 정규화하고, O(1) 조회 성능을 확보합니다. 중복 데이터를 방지하고 메모리 효율성을 높입니다.

### 구현 코드

```typescript
/**
 * 정규화된 티커 데이터 맵
 */
export type TickerMap = Map<string, Ticker>;

interface TickerStore {
  tickers: TickerMap; // Map<string, Ticker>
}

// 조회: O(1)
getTicker: (symbol: string) => get().tickers.get(symbol);

// 업데이트: O(1)
updateTicker: (ticker: Ticker) => {
  updateBuffer.push(ticker);
  scheduleUpdate();
};

// 배치 업데이트
storeSetState((state) => {
  const newTickers = new Map(state.tickers);
  updates.forEach((ticker) => {
    newTickers.set(ticker.symbol, ticker); // O(1) 업데이트
  });
  return { tickers: newTickers };
});
```

### 학습 가치

- **성능**: O(1) 조회 및 업데이트 (배열은 O(n))
- **중복 방지**: 심볼을 키로 사용하여 중복 데이터 방지
- **메모리 효율**: 필요한 데이터만 저장
- **정규화**: 단일 소스 오브 트루스(Single Source of Truth)

### 배열 vs Map 비교

| 작업 | 배열 | Map |
| :--- | :--- | :--- |
| 조회 | O(n) | O(1) |
| 업데이트 | O(n) | O(1) |
| 삽입 | O(1) | O(1) |
| 중복 체크 | O(n) | O(1) |

### 실무 적용

- 실시간 데이터 관리
- 캐시 시스템
- ID 기반 데이터 조회
- 상태 관리 (Redux, Zustand 등)

---

## 9. 커스텀 훅을 통한 WebSocket 관리

**위치**: `hooks/useBinanceWebSocket.ts`

### 핵심 개념

WebSocket 연결과 구독을 관리하는 커스텀 훅을 만들어 재사용성과 관심사 분리를 달성합니다. 컴포넌트에서 WebSocket 로직을 분리하여 코드를 깔끔하게 유지합니다.

### 구현 코드

```typescript
/**
 * Binance WebSocket 훅
 */
export function useBinanceWebSocket(options: UseBinanceWebSocketOptions = {}) {
  const {
    symbols = [],
    onStatusChange,
    onError,
    autoConnect = true,
  } = options;

  const { updateTicker } = useTickerStore();
  const clientRef = useRef<BinanceWebSocketClient | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // 핸들러를 ref로 저장하여 의존성 문제 해결
  const handlersRef = useRef({
    updateTicker,
    onStatusChange,
    onError,
  });

  // WebSocket 클라이언트 초기화
  useEffect(() => {
    if (!autoConnect) return;

    clientRef.current = new BinanceWebSocketClient({
      onTickerMessage: (message) => {
        try {
          const ticker = adaptBinanceTickerStream(message);
          handlersRef.current.updateTicker(ticker);
        } catch (error) {
          handlersRef.current.onError?.(error as Error);
        }
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        handlersRef.current.onStatusChange?.(newStatus);
      },
      onError: (error) => {
        handlersRef.current.onError?.(error);
      },
    });

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [autoConnect]);

  // 심볼 구독 관리
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !autoConnect) return;

    if (symbols.length > 0) {
      client.subscribe(symbols, 'ticker');
    } else {
      client.disconnect();
    }

    return () => {
      if (client && symbols.length > 0) {
        client.unsubscribe(symbols, 'ticker');
      }
    };
  }, [symbols, autoConnect]);

  return {
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
    getStatus: () => clientRef.current?.getStatus() ?? 'disconnected',
    status,
  };
}
```

### 학습 가치

- **관심사 분리**: WebSocket 로직을 컴포넌트에서 분리
- **재사용성**: 여러 컴포넌트에서 동일한 훅 사용 가능
- **생명주기 관리**: useEffect를 통한 자동 연결/해제
- **타입 안정성**: TypeScript로 안전한 API 제공
- **상태 관리**: React 상태와 외부 클라이언트 동기화

### 훅 사용 예시

```typescript
// 컴포넌트에서 사용
const { status: wsStatus } = useBinanceWebSocket({
  symbols: ['BTCUSDT', 'ETHUSDT'],
  onStatusChange: (status) => {
    console.log('WebSocket status:', status);
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
  autoConnect: true,
});
```

### 실무 적용

- WebSocket 연결 관리
- 실시간 데이터 구독
- 외부 서비스 통합
- 이벤트 리스너 관리
- 타이머 및 인터벌 관리

---

## 10. React ref를 사용한 의존성 문제 해결

**위치**: `hooks/useBinanceWebSocket.ts`

### 핵심 개념

`useEffect`의 의존성 배열에 함수를 포함하면 불필요한 재실행이 발생할 수 있습니다. `useRef`를 사용하여 최신 함수 참조를 유지하면서 의존성 문제를 해결합니다.

### 문제 상황

```typescript
// ❌ 문제: 의존성 배열에 함수가 있으면 매번 재생성
useEffect(() => {
  const client = new BinanceWebSocketClient({
    onTickerMessage: handleTickerMessage, // 매번 새로운 함수
    onStatusChange: handleStatusChange,     // 매번 새로운 함수
  });
}, [handleTickerMessage, handleStatusChange]); // 무한 루프 위험
```

### 해결 방법

```typescript
// ✅ 해결: ref를 사용하여 최신 함수 참조 유지
const handlersRef = useRef({
  updateTicker,
  onStatusChange,
  onError,
});

// ref 업데이트 (의존성은 있지만 클라이언트 재생성 없음)
useEffect(() => {
  handlersRef.current = {
    updateTicker,
    onStatusChange,
    onError,
  };
}, [updateTicker, onStatusChange, onError]);

// 클라이언트는 한 번만 생성
useEffect(() => {
  clientRef.current = new BinanceWebSocketClient({
    onTickerMessage: (message) => {
      // ref를 통해 최신 함수 호출
      handlersRef.current.updateTicker(ticker);
    },
  });
}, [autoConnect]); // autoConnect만 의존성
```

### 학습 가치

- **성능 최적화**: 불필요한 재생성 방지
- **메모리 효율**: 클라이언트 인스턴스 재생성 방지
- **최신 값 보장**: ref를 통해 항상 최신 함수 참조
- **의존성 관리**: 의존성 배열을 최소화하여 안정성 확보

### ref vs state 비교

| 특징 | useRef | useState |
| :--- | :--- | :--- |
| 재렌더링 | 없음 | 있음 |
| 값 변경 감지 | 없음 | 있음 |
| 최신 값 보장 | 항상 | 항상 |
| 용도 | DOM 참조, 인스턴스 저장 | UI 상태 관리 |

### 실무 적용

- 이벤트 핸들러 최적화
- 외부 라이브러리 인스턴스 관리
- DOM 참조 저장
- 이전 값 비교
- 타이머 ID 저장

---

## 11. 반응형 테이블 레이아웃 디자인

**위치**: `components/CoinListClient.tsx`

### 핵심 개념

Tailwind CSS의 반응형 유틸리티를 활용하여 화면 크기에 따라 다른 컬럼을 표시하는 테이블을 구현합니다. 모바일에서는 핵심 정보만, 데스크톱에서는 상세 정보를 표시합니다.

### 구현 코드

```typescript
<table className="w-full border-collapse">
  <thead>
    <tr className="border-b border-gray-700">
      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
        심볼
      </th>
      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
        현재가
      </th>
      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
        24h 변동률
      </th>
      {/* 태블릿 이상에서만 표시 */}
      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden md:table-cell">
        거래량
      </th>
      {/* 데스크톱에서만 표시 */}
      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:table-cell">
        고가
      </th>
      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:table-cell">
        저가
      </th>
    </tr>
  </thead>
  <tbody>
    {Array.from(tickers.values()).map((ticker) => (
      <tr
        key={ticker.symbol}
        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
      >
        <td className="py-3 px-4">
          <span className="font-semibold text-white">{ticker.symbol}</span>
        </td>
        {/* ... */}
        <td className="py-3 px-4 text-right text-gray-300 hidden md:table-cell">
          {ticker.volume.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right text-gray-400 hidden lg:table-cell">
          ${ticker.highPrice.toLocaleString()}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 반응형 브레이크포인트

| 화면 크기 | 표시되는 컬럼 |
| :--- | :--- |
| 모바일 (< 768px) | 심볼, 현재가, 24h 변동률 |
| 태블릿 (≥ 768px) | + 거래량 |
| 데스크톱 (≥ 1024px) | + 고가, 저가 |

### 학습 가치

- **사용자 경험**: 화면 크기에 맞는 정보 표시
- **성능**: 불필요한 렌더링 최소화
- **접근성**: 핵심 정보 우선 표시
- **유지보수성**: Tailwind 유틸리티로 간단한 반응형 구현

### Tailwind 반응형 유틸리티

- `hidden`: 기본적으로 숨김
- `md:table-cell`: 768px 이상에서 표시
- `lg:table-cell`: 1024px 이상에서 표시
- `hover:bg-gray-800/50`: 호버 시 배경색 변경

### 실무 적용

- 데이터 테이블
- 대시보드 레이아웃
- 카드 그리드
- 네비게이션 메뉴
- 폼 레이아웃

---

## 12. 가격 변경 감지 및 애니메이션 스로틀링

**위치**: `components/CoinListClient.tsx`

### 핵심 개념

실시간 데이터 변경을 감지하고 시각적 피드백을 제공하기 위해 `useRef`를 사용하여 이전 값을 추적하고, 애니메이션 스로틀링을 적용하여 과도한 애니메이션을 방지합니다. `requestAnimationFrame`과 `setTimeout`을 조합하여 성능 최적화와 자동 제거를 구현합니다.

### 구현 코드

```typescript
// 이전 가격 추적 (가격 변경 감지용)
const previousPricesRef = useRef<Map<string, number>>(new Map());

// 하이라이트 상태 관리 (100ms 스로틀링 적용)
const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());
const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
const rafIdRef = useRef<number | null>(null);

/**
 * 가격 변경 감지 및 하이라이트 처리 (100ms 스로틀링)
 */
useEffect(() => {
  const tickerArray = Array.from(tickers.values());
  
  // requestAnimationFrame을 사용하여 배치 처리
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      const newHighlightedSymbols = new Set<string>();
      const newDirections = new Map<string, PriceChangeDirection>();
      
      tickerArray.forEach((ticker) => {
        const previousPrice = previousPricesRef.current.get(ticker.symbol);
        const lastHighlightTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
        
        // 가격이 변경되었고, 100ms 이상 경과한 경우에만 하이라이트
        if (previousPrice !== undefined && previousPrice !== ticker.price) {
          const timeSinceLastHighlight = now - lastHighlightTime;
          
          if (timeSinceLastHighlight >= 100) {
            const direction: PriceChangeDirection = ticker.price > previousPrice ? 'up' : 'down';
            newHighlightedSymbols.add(ticker.symbol);
            newDirections.set(ticker.symbol, direction);
            lastHighlightTimeRef.current.set(ticker.symbol, now);
            
            // 300ms 후 하이라이트 제거
            setTimeout(() => {
              setHighlightedSymbols((prev) => {
                const next = new Set(prev);
                next.delete(ticker.symbol);
                return next;
              });
              highlightDirectionsRef.current.delete(ticker.symbol);
            }, 300);
          }
        }
        
        // 현재 가격을 이전 가격으로 저장
        previousPricesRef.current.set(ticker.symbol, ticker.price);
      });
      
      // 하이라이트 상태 업데이트
      if (newHighlightedSymbols.size > 0) {
        setHighlightedSymbols((prev) => {
          const merged = new Set(prev);
          newHighlightedSymbols.forEach((symbol) => merged.add(symbol));
          return merged;
        });
        newDirections.forEach((direction, symbol) => {
          highlightDirectionsRef.current.set(symbol, direction);
        });
      }
      
      rafIdRef.current = null;
    });
  }
  
  return () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };
}, [tickers]);
```

### 핵심 패턴

#### 1. useRef를 사용한 이전 값 추적

```typescript
const previousPricesRef = useRef<Map<string, number>>(new Map());

// 이전 가격과 비교
const previousPrice = previousPricesRef.current.get(ticker.symbol);
if (previousPrice !== undefined && previousPrice !== ticker.price) {
  // 가격 변경 감지
}

// 현재 가격을 이전 가격으로 저장
previousPricesRef.current.set(ticker.symbol, ticker.price);
```

**장점:**
- 리렌더링 없이 이전 값 추적 가능
- Map을 사용하여 여러 항목의 이전 값 관리
- 메모리 효율적

#### 2. 애니메이션 스로틀링 패턴

```typescript
const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());

const lastHighlightTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
const timeSinceLastHighlight = now - lastHighlightTime;

if (timeSinceLastHighlight >= 100) {
  // 100ms 이상 경과한 경우에만 하이라이트
  lastHighlightTimeRef.current.set(ticker.symbol, now);
}
```

**장점:**
- 고빈도 업데이트에서 과도한 애니메이션 방지
- 각 항목별로 독립적인 스로틀링 관리
- 사용자 경험 개선 (너무 빠른 깜빡임 방지)

#### 3. requestAnimationFrame과 setTimeout의 조합

```typescript
// requestAnimationFrame: 배치 처리 및 성능 최적화
rafIdRef.current = requestAnimationFrame(() => {
  // 가격 변경 감지 및 하이라이트 처리
});

// setTimeout: 자동 제거
setTimeout(() => {
  setHighlightedSymbols((prev) => {
    const next = new Set(prev);
    next.delete(ticker.symbol);
    return next;
  });
}, 300);
```

**장점:**
- `requestAnimationFrame`: 브라우저 렌더링 사이클과 동기화
- `setTimeout`: 일정 시간 후 자동 제거
- 두 API의 장점을 결합한 패턴

#### 4. Set과 Map을 활용한 복합 상태 관리

```typescript
// Set: 하이라이트된 심볼 목록 (빠른 조회)
const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());

// Map: 각 심볼의 방향 정보 (키-값 쌍)
const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());

// 효율적인 상태 업데이트
setHighlightedSymbols((prev) => {
  const merged = new Set(prev);
  newHighlightedSymbols.forEach((symbol) => merged.add(symbol));
  return merged;
});
```

**장점:**
- Set: O(1) 조회 성능, 중복 자동 제거
- Map: 키-값 쌍 관리, 빠른 조회
- 상태 분리로 관리 용이

### 학습 가치

- **이전 값 추적**: `useRef`로 리렌더링 없이 이전 값 비교
- **성능 최적화**: `requestAnimationFrame`으로 배치 처리
- **애니메이션 제어**: 스로틀링으로 과도한 애니메이션 방지
- **자동 제거**: `setTimeout`으로 일정 시간 후 자동 정리
- **복합 상태 관리**: Set과 Map을 활용한 효율적인 상태 관리

### 패턴 비교

| 패턴 | 사용 시기 | 장점 |
| :--- | :--- | :--- |
| **useRef로 이전 값 추적** | 값 변경 감지가 필요할 때 | 리렌더링 없이 이전 값 비교 |
| **애니메이션 스로틀링** | 고빈도 업데이트 시 | 과도한 애니메이션 방지 |
| **RAF + setTimeout** | 배치 처리 + 자동 제거 | 성능 최적화 + 자동 정리 |
| **Set + Map 상태 관리** | 복합 상태 관리 | 효율적인 조회 및 업데이트 |

### 실무 적용

- **실시간 주식/암호화폐 가격 업데이트**: 가격 변경 시 하이라이트
- **게임 UI**: 점수 변경 시 애니메이션
- **대시보드**: 지표 변경 시 시각적 피드백
- **채팅 애플리케이션**: 새 메시지 알림
- **알림 시스템**: 상태 변경 시 하이라이트

### 주의사항

1. **메모리 누수 방지**: 컴포넌트 언마운트 시 `cancelAnimationFrame` 호출
2. **스로틀링 간격 조정**: 사용자 경험에 맞게 간격 조정 (100ms 권장)
3. **하이라이트 지속 시간**: 너무 짧으면 인식 어려움, 너무 길면 시각적 혼란 (300ms 권장)
4. **Set/Map 초기화**: 컴포넌트 재마운트 시 초기화 필요

---

## 13. Zustand Persist Middleware를 활용한 영구 저장

**위치**: `stores/favoriteStore.ts`

### 핵심 개념

Zustand의 `persist` 미들웨어를 사용하여 클라이언트 사이드 상태를 localStorage에 자동으로 저장하고 복원합니다. 페이지를 새로고침하거나 다시 방문해도 사용자의 즐겨찾기 목록이 유지됩니다.

### 구현 코드

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoriteStore {
  favorites: string[];
  addFavorite: (symbol: string) => void;
  removeFavorite: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
}

export const useFavoriteStore = create<FavoriteStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (symbol: string) =>
        set((state) => ({
          // Set을 사용하여 중복 제거
          favorites: [...new Set([...state.favorites, symbol])],
        })),

      removeFavorite: (symbol: string) =>
        set((state) => ({
          favorites: state.favorites.filter((s) => s !== symbol),
        })),

      toggleFavorite: (symbol: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(symbol)) {
          removeFavorite(symbol);
        } else {
          addFavorite(symbol);
        }
      },

      isFavorite: (symbol: string) => get().favorites.includes(symbol),
    }),
    {
      name: 'crypto-favorites-storage', // localStorage 키 이름
    }
  )
);
```

### 학습 가치

- **자동 영구 저장**: 상태 변경 시 자동으로 localStorage에 저장
- **자동 복원**: 페이지 로드 시 localStorage에서 자동으로 복원
- **중복 제거**: Set을 활용하여 중복된 즐겨찾기 방지
- **타입 안정성**: TypeScript로 안전한 상태 관리
- **간단한 API**: 복잡한 설정 없이 바로 사용 가능

### Persist Middleware 동작 방식

1. **저장**: 상태가 변경될 때마다 자동으로 localStorage에 저장
2. **복원**: 스토어 초기화 시 localStorage에서 데이터를 읽어와 상태 복원
3. **직렬화**: JSON.stringify/parse를 자동으로 처리
4. **동기화**: 여러 탭 간 상태 동기화 가능 (옵션)

### 실무 적용

- 사용자 설정 저장 (테마, 언어 등)
- 장바구니 데이터
- 즐겨찾기/북마크
- 폼 데이터 임시 저장
- 사용자 선호도 저장

### 주의사항

1. **용량 제한**: localStorage는 약 5-10MB 제한
2. **동기 작업**: localStorage는 동기 작업이므로 대용량 데이터는 주의
3. **보안**: 민감한 정보는 저장하지 않음
4. **직렬화**: 함수나 클래스 인스턴스는 저장 불가

---

## 14. 디바운스 패턴을 활용한 WebSocket 재구독 최적화

**위치**: `components/CoinListClient.tsx`

### 핵심 개념

사용자가 빠르게 여러 코인을 즐겨찾기로 추가/제거할 때, 각 변경마다 WebSocket을 재구독하는 것은 비효율적입니다. 디바운스 패턴을 사용하여 연속된 변경을 하나로 묶어 마지막 변경 후 일정 시간(300ms)이 지난 후에만 WebSocket을 재구독합니다.

### 구현 코드

```typescript
// 디바운스된 심볼 목록 (WebSocket 재구독 최적화)
const [debouncedSymbols, setDebouncedSymbols] = useState<string[]>(allSymbols);
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  // 이전 타이머 클리어
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }

  // 300ms 후 업데이트
  debounceTimerRef.current = setTimeout(() => {
    setDebouncedSymbols(allSymbols);
    debounceTimerRef.current = null;
  }, 300);

  // 클린업: 컴포넌트 언마운트 또는 allSymbols 변경 시 이전 타이머 제거
  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };
}, [allSymbols]);

// 디바운스된 심볼을 WebSocket 구독에 사용
const symbols = debouncedSymbols;
```

### 동작 흐름

```
사용자 액션: 즐겨찾기 추가/제거
    ↓
allSymbols 변경 (즉시)
    ↓
디바운스 타이머 시작 (300ms)
    ↓
[300ms 내 추가 변경 발생 시]
    ↓
이전 타이머 취소 → 새 타이머 시작
    ↓
[300ms 동안 변경 없음]
    ↓
debouncedSymbols 업데이트
    ↓
WebSocket 재구독 (한 번만 실행)
```

### 학습 가치

- **성능 최적화**: 연속된 변경을 하나로 묶어 불필요한 재구독 방지
- **서버 부하 감소**: WebSocket 재연결 횟수 최소화
- **사용자 경험**: 빠른 연속 클릭에도 안정적인 동작
- **리소스 효율**: 네트워크 요청 최소화

### 디바운스 vs 스로틀 비교

| 패턴 | 동작 방식 | 사용 시기 |
| :--- | :--- | :--- |
| **디바운스** | 마지막 호출 후 일정 시간 지연 후 실행 | 검색 입력, 즐겨찾기 변경 |
| **스로틀** | 일정 시간마다 최대 한 번 실행 | 스크롤 이벤트, 리사이즈 이벤트 |

### 실무 적용

- 검색 자동완성 (입력 완료 후 검색)
- 폼 검증 (입력 완료 후 검증)
- WebSocket 재구독
- API 호출 최적화
- 창 크기 조정 이벤트

### 주의사항

1. **타이머 클리어**: 컴포넌트 언마운트 시 반드시 타이머 클리어
2. **간격 조정**: 너무 짧으면 효과 없음, 너무 길면 반응 느림 (300ms 권장)
3. **useRef 사용**: 타이머 ID를 ref에 저장하여 리렌더링 방지

---

## 15. 동적 WebSocket 구독 및 대규모 변경 감지

**위치**: `hooks/useBinanceWebSocket.ts` + `lib/websocket/binanceWebSocket.ts`

### 핵심 개념

사용자가 즐겨찾기를 변경할 때마다 WebSocket 구독을 동적으로 변경해야 합니다. 소규모 변경(1-2개 추가/제거)은 차등 구독으로 처리하고, 대규모 변경(50% 이상 변경)은 전체 재구독으로 처리하여 효율성을 높입니다.

### 구현 코드

#### 1. 대규모 변경 감지 로직

```typescript
// hooks/useBinanceWebSocket.ts
const previousSymbolsRef = useRef<string[]>([]);

useEffect(() => {
  const currentSymbols = symbols;
  const previousSymbols = previousSymbolsRef.current;

  // 대규모 변경 감지
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
    if (currentSymbols.length > 0) {
      client.updateSubscription(currentSymbols, 'ticker');
    } else {
      client.disconnect();
    }
  } else {
    // 소규모 변경: 차등 구독
    // 이전 구독 해제
    const symbolsToUnsubscribe = previousSymbols.filter(
      (sym) => !currentSymbols.includes(sym)
    );
    if (symbolsToUnsubscribe.length > 0) {
      client.unsubscribe(symbolsToUnsubscribe, 'ticker');
    }

    // 새 구독 추가
    const symbolsToSubscribe = currentSymbols.filter(
      (sym) => !previousSymbols.includes(sym)
    );
    if (symbolsToSubscribe.length > 0) {
      client.subscribe(symbolsToSubscribe, 'ticker');
    }
  }

  previousSymbolsRef.current = currentSymbols;
}, [symbols]);
```

#### 2. 전체 재구독 메서드

```typescript
// lib/websocket/binanceWebSocket.ts
updateSubscription(symbols: string[], type: StreamType): void {
  const streams = symbols.map((symbol) => {
    const symbolLower = symbol.toLowerCase();
    if (type === 'ticker') {
      return `${symbolLower}@ticker`;
    } else {
      return `${symbolLower}@kline_1m`;
    }
  });

  // 기존 구독 모두 해제 (내부 상태만 정리)
  this.subscribedStreams.clear();
  
  // 새 구독으로 설정
  streams.forEach((stream) => this.subscribedStreams.add(stream));

  // 심볼이 없으면 연결 해제
  if (this.subscribedStreams.size === 0) {
    this.disconnect();
    return;
  }

  // 한 번만 재연결 (연결 끊김 최소화)
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.reconnect();
  } else {
    this.connect();
  }
}
```

### 변경 감지 전략

#### 대규모 변경 (전체 재구독)
- 첫 구독
- 모든 구독 해제
- 변경 비율 50% 이상
- 공통 심볼 50% 미만

#### 소규모 변경 (차등 구독)
- 1-2개 추가/제거
- 변경 비율 50% 미만
- 공통 심볼 50% 이상

### 학습 가치

- **효율적인 구독 관리**: 변경 규모에 따라 최적의 전략 선택
- **연결 안정성**: 대규모 변경 시 한 번만 재연결하여 연결 끊김 최소화
- **성능 최적화**: 소규모 변경은 차등 구독으로 빠른 처리
- **이전 상태 추적**: useRef를 사용하여 이전 구독 목록 추적

### 시나리오별 동작

#### 시나리오 1: 즐겨찾기 1개 추가
```
이전: [BTCUSDT, ETHUSDT]
현재: [BTCUSDT, ETHUSDT, SOLUSDT]
→ 소규모 변경: SOLUSDT만 구독 추가
```

#### 시나리오 2: 전체 → 즐겨찾기로 전환
```
이전: [100개 코인]
현재: [BTCUSDT] (1개)
→ 대규모 변경: 전체 재구독
```

#### 시나리오 3: 즐겨찾기 1개 제거
```
이전: [BTCUSDT, ETHUSDT, SOLUSDT]
현재: [BTCUSDT, ETHUSDT]
→ 소규모 변경: SOLUSDT만 구독 해제
```

### 실무 적용

- 실시간 데이터 구독 관리
- 동적 필터링 (카테고리 변경)
- 사용자 그룹별 데이터 구독
- 대시보드 위젯 추가/제거

### 주의사항

1. **이전 상태 추적**: useRef를 사용하여 리렌더링 없이 이전 상태 추적
2. **임계값 조정**: 50% 임계값은 프로젝트에 맞게 조정 가능
3. **연결 상태 확인**: WebSocket 연결 상태를 확인하여 적절한 처리
4. **클린업**: 컴포넌트 언마운트 시 구독 해제

---

## 16. Lightweight Charts 라이브러리 통합 및 외부 차트 라이브러리 사용 패턴

**위치**: `components/CandlestickChart.tsx`

### 핵심 개념

외부 차트 라이브러리(Lightweight Charts)를 React 컴포넌트에 통합할 때, 라이브러리의 생명주기와 React의 생명주기를 올바르게 동기화하는 것이 중요합니다. 특히 DOM 조작이 필요한 외부 라이브러리는 `useRef`와 `useEffect`를 활용하여 관리해야 합니다.

### 구현 코드

```typescript
// components/CandlestickChart.tsx
import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts';

export default function CandlestickChart({
  data,
  symbol = 'BTCUSDT',
  height = 500,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // 차트 초기화 (한 번만 실행)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d5db',
      },
      // ... 차트 옵션
    });

    // 시리즈 추가 (Lightweight Charts v5 방식)
    const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeriesInstance;

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 클린업: 컴포넌트 언마운트 시 차트 제거
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [height]); // height만 의존성 (차트는 한 번만 생성)

  // 데이터 업데이트 (별도 useEffect로 분리)
  useEffect(() => {
    if (seriesRef.current) {
      if (data.length > 0) {
        seriesRef.current.setData(data);
      } else {
        seriesRef.current.setData([]);
      }
    }
  }, [data]); // data 변경 시에만 업데이트
}
```

### 핵심 패턴

#### 1. 생명주기 분리

```typescript
// ✅ 올바른 패턴: 초기화와 업데이트를 분리
useEffect(() => {
  // 차트 생성 (한 번만)
  const chart = createChart(...);
}, [height]); // 의존성 최소화

useEffect(() => {
  // 데이터 업데이트 (data 변경 시)
  seriesRef.current?.setData(data);
}, [data]);
```

**장점:**
- 차트 인스턴스가 불필요하게 재생성되지 않음
- 데이터만 변경될 때는 업데이트만 수행
- 성능 최적화

#### 2. Ref를 통한 인스턴스 관리

```typescript
const chartRef = useRef<IChartApi | null>(null);
const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

// ref에 저장하여 재렌더링 없이 접근
chartRef.current = chart;
seriesRef.current = candlestickSeriesInstance;
```

**장점:**
- 리렌더링 없이 차트 인스턴스 접근
- 컴포넌트 상태와 외부 라이브러리 상태 분리
- 메모리 누수 방지

#### 3. 클린업 로직

```typescript
return () => {
  window.removeEventListener('resize', handleResize);
  if (chartRef.current) {
    chartRef.current.remove(); // 라이브러리 정리 메서드 호출
    chartRef.current = null;
  }
  seriesRef.current = null;
};
```

**장점:**
- 메모리 누수 방지
- 이벤트 리스너 정리
- 외부 라이브러리 리소스 해제

### 학습 가치

- **외부 라이브러리 통합**: React 생명주기와 외부 라이브러리 생명주기 동기화
- **성능 최적화**: 불필요한 재생성 방지, 데이터만 업데이트
- **메모리 관리**: 클린업 로직으로 리소스 해제
- **API 버전 관리**: 라이브러리 업그레이드 시 API 변경사항 대응 (v4 → v5)

### 라이브러리 버전 업그레이드 대응

```typescript
// v4 (deprecated)
const series = chart.addCandlestickSeries({...});

// v5 (새로운 API)
import { CandlestickSeries } from 'lightweight-charts';
const series = chart.addSeries(CandlestickSeries, {...});
```

### 실무 적용

- 차트 라이브러리 통합 (Lightweight Charts, Chart.js, D3.js 등)
- 지도 라이브러리 통합 (Google Maps, Mapbox 등)
- 에디터 라이브러리 통합 (CodeMirror, Monaco Editor 등)
- 비디오 플레이어 통합 (Video.js, Plyr 등)

---

## 17. 실시간 데이터와 과거 데이터 병합 전략

**위치**: `app/chart/ChartClient.tsx`

### 핵심 개념

REST API로 가져온 과거 데이터와 WebSocket으로 받는 실시간 데이터를 시간 기준으로 병합하여 끊김 없는 차트를 구현합니다. `openTime`을 기준으로 기존 캔들을 업데이트하거나 새 캔들을 추가합니다.

### 구현 코드

```typescript
// app/chart/ChartClient.tsx

/**
 * 실시간 Kline 데이터를 차트 데이터에 병합
 * openTime 기준으로 기존 캔들 업데이트 또는 새 캔들 추가
 */
const updateChartDataWithRealtimeKline = useCallback((kline: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}) => {
  setChartData((prevData) => {
    const newData = [...prevData];
    const klineTime = kline.openTime / 1000; // 밀리초 → 초 변환
    
    // openTime으로 기존 캔들 찾기
    const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
    
    const candlestickData = convertKlineToCandlestickFromKline(kline);
    
    if (existingIndex >= 0) {
      // 기존 캔들 업데이트 (실시간으로 가격이 변동 중)
      newData[existingIndex] = candlestickData;
    } else {
      // 새 캔들 추가 (새로운 시간대 시작)
      newData.push(candlestickData);
      newData.sort((a, b) => (a.time as number) - (b.time as number));
    }
    
    chartDataRef.current = newData;
    return newData;
  });
}, []);
```

### 병합 전략

#### 1. 시간 기준 매칭

```typescript
const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
```

**동작:**
- `openTime`을 기준으로 기존 캔들 검색
- 정확한 시간 매칭으로 중복 방지

#### 2. 업데이트 vs 추가 결정

```typescript
if (existingIndex >= 0) {
  // 기존 캔들 업데이트 (같은 시간대의 실시간 업데이트)
  newData[existingIndex] = candlestickData;
} else {
  // 새 캔들 추가 (새로운 시간대 시작)
  newData.push(candlestickData);
  newData.sort((a, b) => (a.time as number) - (b.time as number));
}
```

**시나리오:**
- **업데이트**: 현재 진행 중인 1분봉의 가격이 실시간으로 변동
- **추가**: 새로운 1분봉이 시작되어 새 캔들 생성

#### 3. 시간 순서 정렬

```typescript
newData.sort((a, b) => (a.time as number) - (b.time as number));
```

**이유:**
- 차트 라이브러리는 시간 순서대로 정렬된 데이터를 요구
- 새 캔들이 중간에 삽입될 수 있으므로 정렬 필수

### 데이터 흐름

```
1. 초기 로드: REST API로 과거 500개 캔들 가져오기
   → [캔들1, 캔들2, ..., 캔들500]

2. 실시간 업데이트: WebSocket으로 현재 캔들 업데이트
   → 캔들500의 가격이 실시간으로 변동
   → 기존 캔들 업데이트

3. 새 캔들 생성: 새로운 1분봉 시작
   → 캔들501 추가
   → 시간 순서대로 정렬
```

### 학습 가치

- **데이터 정합성**: 시간 기준으로 정확한 병합
- **성능 최적화**: 불필요한 재정렬 최소화
- **실시간 업데이트**: 끊김 없는 차트 표시
- **상태 관리**: React 상태와 외부 차트 라이브러리 동기화

### 실무 적용

- 실시간 주식/암호화폐 차트
- IoT 센서 데이터 시각화
- 실시간 대시보드
- 로그 데이터 시각화

---

## 18. 데이터 간격 감지 및 메우기 (Data Gap Handling)

**위치**: `app/chart/ChartClient.tsx`

### 핵심 개념

과거 데이터를 가져올 때 네트워크 오류나 API 제한으로 인해 일부 시간대의 데이터가 누락될 수 있습니다. 이를 감지하고 REST API를 통해 누락된 데이터를 자동으로 채워넣는 로직입니다.

### 구현 코드

```typescript
// app/chart/ChartClient.tsx

/**
 * 데이터 간격 감지 및 메우기
 * @param data 현재 차트 데이터
 * @param symbol 코인 심볼
 * @param interval 시간 간격 (예: '1m', '5m')
 * @returns 간격이 메워진 데이터
 */
const detectAndFillGaps = async (
  data: CandlestickData[],
  symbol: string,
  interval: string
): Promise<CandlestickData[]> => {
  if (data.length < 2) return data;

  // 간격 크기 계산 (밀리초)
  const intervalMs: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };

  const intervalSize = intervalMs[interval] || intervalMs['1m'];
  const gaps: Array<{ start: number; end: number }> = [];

  // 간격 감지
  for (let i = 0; i < data.length - 1; i++) {
    const currentTime = (data[i].time as number) * 1000;
    const nextTime = (data[i + 1].time as number) * 1000;
    const expectedNextTime = currentTime + intervalSize;

    // 예상 시간보다 1.5배 이상 차이나면 간격으로 간주
    if (nextTime - expectedNextTime > intervalSize * 1.5) {
      gaps.push({
        start: expectedNextTime,
        end: nextTime - intervalSize,
      });
    }
  }

  if (gaps.length === 0) return data;

  // 간격 메우기
  const filledData = [...data];
  for (const gap of gaps) {
    try {
      const response = await fetch(
        `/api/klines?symbol=${symbol}&interval=${interval}&startTime=${Math.floor(gap.start)}&endTime=${Math.floor(gap.end)}`
      );

      if (response.ok) {
        const gapKlines: BinanceKlineResponse[] = await response.json();
        const gapCandles = gapKlines.map(convertKlineToCandlestick);

        gapCandles.forEach((candle) => {
          const exists = filledData.some((d) => d.time === candle.time);
          if (!exists) {
            filledData.push(candle);
          }
        });
      }
    } catch (err) {
      console.warn('Failed to fill gap:', err);
    }
  }

  // 시간 순서대로 정렬
  filledData.sort((a, b) => (a.time as number) - (b.time as number));
  return filledData;
};
```

### 핵심 로직

#### 1. 간격 감지 알고리즘

```typescript
const expectedNextTime = currentTime + intervalSize;

// 예상 시간보다 1.5배 이상 차이나면 간격으로 간주
if (nextTime - expectedNextTime > intervalSize * 1.5) {
  gaps.push({
    start: expectedNextTime,
    end: nextTime - intervalSize,
  });
}
```

**임계값 (1.5배):**
- 정상적인 간격: `intervalSize` (예: 1분 = 60초)
- 간격으로 간주: `intervalSize * 1.5` 이상 (예: 90초 이상)
- 이유: 네트워크 지연이나 타임스탬프 오차를 고려

#### 2. 간격 메우기

```typescript
for (const gap of gaps) {
  const response = await fetch(
    `/api/klines?symbol=${symbol}&interval=${interval}&startTime=${gap.start}&endTime=${gap.end}`
  );
  
  const gapKlines = await response.json();
  const gapCandles = gapKlines.map(convertKlineToCandlestick);
  
  gapCandles.forEach((candle) => {
    const exists = filledData.some((d) => d.time === candle.time);
    if (!exists) {
      filledData.push(candle);
    }
  });
}
```

**중복 방지:**
- 이미 존재하는 캔들은 추가하지 않음
- `time` 기준으로 중복 체크

### 학습 가치

- **데이터 정합성**: 누락된 데이터를 자동으로 보완
- **에러 복구**: 네트워크 오류나 API 제한으로 인한 데이터 누락 처리
- **사용자 경험**: 끊김 없는 차트 표시
- **비동기 처리**: 여러 간격을 순차적으로 메우기

### 실무 적용

- 실시간 차트 데이터 보완
- 로그 데이터 간격 메우기
- 센서 데이터 누락 처리
- 시계열 데이터 정합성 보장

---

## 19. Intersection Observer를 활용한 무한 스크롤 구현

**위치**: `components/CoinSelectModal.tsx`

### 핵심 개념

대용량 리스트(500개 이상)를 효율적으로 표시하기 위해 초기에는 일부만 렌더링하고, 사용자가 스크롤할 때 추가 항목을 로드하는 무한 스크롤 패턴입니다. `Intersection Observer API`를 사용하여 트리거 요소가 뷰포트에 들어올 때 자동으로 더 많은 항목을 로드합니다.

### 구현 코드

```typescript
// components/CoinSelectModal.tsx

const [displayCount, setDisplayCount] = useState(50); // 초기 표시 개수
const loadMoreRef = useRef<HTMLDivElement>(null);

// 표시할 코인 목록 (무한 스크롤용)
const displayedCoins = useMemo(() => {
  if (searchQuery.trim()) {
    return filteredCoins; // 검색 중일 때는 모든 결과 표시
  }
  return filteredCoins.slice(0, displayCount); // displayCount만큼만 표시
}, [filteredCoins, displayCount, searchQuery]);

// 더 로드할 항목이 있는지 확인
const hasMore = !searchQuery.trim() && displayCount < filteredCoins.length;

// 무한 스크롤: Intersection Observer로 더 로드하기
useEffect(() => {
  if (!isOpen || !hasMore || !loadMoreRef.current) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // 50개씩 추가 로드
        setDisplayCount((prev) => Math.min(prev + 50, filteredCoins.length));
      }
    },
    {
      root: listRef.current, // 스크롤 컨테이너
      rootMargin: '100px', // 100px 전에 미리 로드
      threshold: 0.1, // 10% 보이면 트리거
    }
  );

  observer.observe(loadMoreRef.current);

  return () => {
    observer.disconnect();
  };
}, [isOpen, hasMore, filteredCoins.length]);
```

### 핵심 패턴

#### 1. Intersection Observer 설정

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      // 트리거 요소가 보이면 더 로드
      setDisplayCount((prev) => Math.min(prev + 50, filteredCoins.length));
    }
  },
  {
    root: listRef.current, // 스크롤 컨테이너 지정
    rootMargin: '100px', // 100px 전에 미리 로드 (프리로딩)
    threshold: 0.1, // 10% 보이면 트리거
  }
);
```

**옵션 설명:**
- `root`: 스크롤 컨테이너 (기본값: viewport)
- `rootMargin`: 미리 로드할 거리 (성능 최적화)
- `threshold`: 트리거 기준 (0.1 = 10% 보이면)

#### 2. 트리거 요소

```typescript
{hasMore && (
  <div ref={loadMoreRef} className="p-4 text-center text-gray-400">
    더 불러오는 중...
  </div>
)}
```

**동작:**
- 이 요소가 뷰포트에 들어오면 `IntersectionObserver` 콜백 실행
- `displayCount`를 50씩 증가시켜 더 많은 항목 표시

#### 3. 검색 중 무한 스크롤 비활성화

```typescript
const displayedCoins = useMemo(() => {
  if (searchQuery.trim()) {
    return filteredCoins; // 검색 중일 때는 모든 결과 표시
  }
  return filteredCoins.slice(0, displayCount);
}, [filteredCoins, displayCount, searchQuery]);

const hasMore = !searchQuery.trim() && displayCount < filteredCoins.length;
```

**이유:**
- 검색 결과는 보통 적으므로 무한 스크롤 불필요
- 모든 검색 결과를 즉시 표시하여 사용자 경험 향상

### 학습 가치

- **성능 최적화**: 초기 렌더링 항목 수 제한으로 초기 로딩 시간 단축
- **메모리 효율**: 필요한 만큼만 렌더링하여 메모리 사용량 감소
- **사용자 경험**: 부드러운 스크롤 경험, 자동 로딩
- **Intersection Observer API**: 브라우저 네이티브 API 활용

### Intersection Observer vs 스크롤 이벤트

| 방식 | 장점 | 단점 |
| :--- | :--- | :--- |
| **Intersection Observer** | 브라우저 최적화, 성능 우수, 간단한 구현 | 일부 브라우저 호환성 (폴리필 필요) |
| **스크롤 이벤트** | 모든 브라우저 지원 | 성능 오버헤드, 수동 최적화 필요 |

### 실무 적용

- 대용량 리스트 표시 (500개 이상)
- 뉴스피드 무한 스크롤
- 이미지 갤러리
- 댓글 목록
- 검색 결과 페이지

---

## 20. Combobox/Modal UI 패턴: 검색 가능한 대용량 리스트 선택

**위치**: `components/CoinSelectModal.tsx`

### 핵심 개념

대용량 리스트(500개 이상)에서 항목을 선택할 때, 드롭다운보다 모달을 사용하여 검색, 필터링, 키보드 네비게이션 등의 고급 기능을 제공하는 UI 패턴입니다. 특히 즐겨찾기 우선 표시, 무한 스크롤, 키보드 접근성을 모두 지원합니다.

### 구현 코드

```typescript
// components/CoinSelectModal.tsx

export default function CoinSelectModal({
  isOpen,
  onClose,
  onSelect,
  coins,
  selectedSymbol,
}: CoinSelectModalProps) {
  const { isFavorite } = useFavoriteStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(50);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 필터링 및 정렬된 코인 목록
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) {
      // 검색어가 없으면 즐겨찾기 우선, 그 다음 전체
      const favoriteCoins = coins.filter((coin) => isFavorite(coin.symbol));
      const otherCoins = coins.filter((coin) => !isFavorite(coin.symbol));
      return [...favoriteCoins, ...otherCoins];
    }

    // 검색어가 있으면 필터링
    const query = searchQuery.trim().toUpperCase();
    return coins.filter((coin) => {
      const symbolMatch = coin.symbol.toUpperCase().includes(query);
      const nameMatch = coin.nameKO?.toUpperCase().includes(query) || false;
      return symbolMatch || nameMatch;
    });
  }, [coins, searchQuery, isFavorite]);

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const nextIndex = prev < displayedCoins.length - 1 ? prev + 1 : prev;
          // 하단에 가까우면 더 로드
          if (nextIndex >= displayCount - 5 && hasMore) {
            setDisplayCount((current) => Math.min(current + 50, filteredCoins.length));
          }
          return nextIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (displayedCoins[highlightedIndex]) {
          onSelect(displayedCoins[highlightedIndex].symbol);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayedCoins, highlightedIndex, displayCount, hasMore, filteredCoins.length, onSelect, onClose]);

  // 모달이 열릴 때 검색 입력에 포커스
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
}
```

### 핵심 기능

#### 1. 즐겨찾기 우선 표시

```typescript
const filteredCoins = useMemo(() => {
  if (!searchQuery.trim()) {
    const favoriteCoins = coins.filter((coin) => isFavorite(coin.symbol));
    const otherCoins = coins.filter((coin) => !isFavorite(coin.symbol));
    return [...favoriteCoins, ...otherCoins]; // 즐겨찾기 먼저
  }
  // 검색 중일 때는 필터링만
}, [coins, searchQuery, isFavorite]);
```

**장점:**
- 자주 사용하는 항목을 상단에 표시
- 사용자 경험 향상

#### 2. 다중 필드 검색

```typescript
const query = searchQuery.trim().toUpperCase();
return coins.filter((coin) => {
  const symbolMatch = coin.symbol.toUpperCase().includes(query);
  const nameMatch = coin.nameKO?.toUpperCase().includes(query) || false;
  return symbolMatch || nameMatch; // 심볼 또는 한국어 이름으로 검색
});
```

**장점:**
- 다양한 필드로 검색 가능
- 사용자 편의성 향상

#### 3. 키보드 네비게이션

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    // 다음 항목으로 이동
    setHighlightedIndex((prev) => prev + 1);
  } else if (e.key === 'ArrowUp') {
    // 이전 항목으로 이동
    setHighlightedIndex((prev) => prev - 1);
  } else if (e.key === 'Enter') {
    // 선택
    onSelect(displayedCoins[highlightedIndex].symbol);
  } else if (e.key === 'Escape') {
    // 닫기
    onClose();
  }
};
```

**접근성:**
- 키보드만으로 모든 기능 사용 가능
- 마우스 없이도 빠른 선택

#### 4. 자동 포커스

```typescript
useEffect(() => {
  if (isOpen && searchInputRef.current) {
    searchInputRef.current.focus(); // 모달 열릴 때 자동 포커스
  }
}, [isOpen]);
```

**장점:**
- 모달이 열리면 즉시 검색 가능
- 사용자 경험 향상

### 학습 가치

- **대용량 리스트 처리**: 500개 이상 항목을 효율적으로 표시
- **검색 및 필터링**: 실시간 검색으로 빠른 항목 찾기
- **키보드 접근성**: 키보드만으로 모든 기능 사용
- **사용자 경험**: 즐겨찾기 우선, 자동 포커스 등

### 실무 적용

- 대용량 선택 UI (국가, 도시, 제품 등)
- 검색 가능한 드롭다운
- 자동완성 입력 필드
- 파일 선택 다이얼로그
- 태그 선택 UI

---

## 21. useCallback을 활용한 함수 메모이제이션 및 의존성 체인 관리

**위치**: `app/chart/ChartClient.tsx`

### 핵심 개념

React Hook의 의존성 배열에서 함수 참조가 변경되면 `useEffect`가 불필요하게 재실행됩니다. `useCallback`을 사용하여 함수를 메모이제이션하고, 의존성 체인을 올바르게 관리하여 성능을 최적화하고 무한 루프를 방지합니다.

### 문제 상황

```typescript
// ❌ 문제: 함수가 매번 재생성되어 useEffect가 무한 루프
const loadChartData = async (symbol: string, interval: string) => {
  // ...
  setupWebSocket(symbol);
};

useEffect(() => {
  loadChartData(selectedSymbol, selectedInterval);
}, [selectedSymbol, selectedInterval, loadChartData]); // loadChartData가 매번 변경됨
```

### 해결 방법

```typescript
// app/chart/ChartClient.tsx

// 1단계: 유틸리티 함수 (의존성 없음)
const convertKlineToCandlestickFromKline = (kline: {...}) => {
  return { time: ..., open: ..., ... };
};

// 2단계: 상태 업데이트 함수 (useCallback으로 감싸기)
const updateChartDataWithRealtimeKline = useCallback((kline: {...}) => {
  setChartData((prevData) => {
    // ...
  });
}, []); // 의존성 없음 (setState 함수는 안정적)

// 3단계: WebSocket 설정 (updateChartDataWithRealtimeKline 의존)
const setupWebSocket = useCallback((symbol: string) => {
  wsClientRef.current = new BinanceWebSocketClient({
    onKlineMessage: (message) => {
      const kline = adaptBinanceKlineStream(message);
      updateChartDataWithRealtimeKline(kline); // 메모이제이션된 함수 사용
    },
  });
  wsClientRef.current.subscribe([symbol], 'kline');
  wsClientRef.current.connect();
}, [updateChartDataWithRealtimeKline]); // 의존성 명시

// 4단계: 데이터 로드 (setupWebSocket 의존)
const loadChartData = useCallback(async (symbol: string, interval: string) => {
  // ...
  setupWebSocket(symbol); // 메모이제이션된 함수 사용
}, [setupWebSocket]); // 의존성 명시

// 5단계: useEffect (loadChartData 의존)
useEffect(() => {
  loadChartData(selectedSymbol, selectedInterval);
}, [selectedSymbol, selectedInterval, loadChartData]); // 안정적인 의존성
```

### 의존성 체인 관리

```
convertKlineToCandlestickFromKline (의존성 없음)
    ↓
updateChartDataWithRealtimeKline (의존성: [])
    ↓
setupWebSocket (의존성: [updateChartDataWithRealtimeKline])
    ↓
loadChartData (의존성: [setupWebSocket])
    ↓
useEffect (의존성: [selectedSymbol, selectedInterval, loadChartData])
```

**원칙:**
1. **하위 함수부터 정의**: 의존성이 없는 함수를 먼저 정의
2. **의존성 명시**: `useCallback`의 의존성 배열에 모든 의존성 포함
3. **체인 관리**: 의존성 체인을 따라 순서대로 정의

### 함수 정의 순서의 중요성

```typescript
// ✅ 올바른 순서: 의존성이 있는 함수가 아래에 정의
const updateChartData = useCallback(...); // 1단계
const setupWebSocket = useCallback(..., [updateChartData]); // 2단계 (updateChartData 사용)
const loadChartData = useCallback(..., [setupWebSocket]); // 3단계 (setupWebSocket 사용)

// ❌ 잘못된 순서: 의존성이 있는 함수가 위에 정의
const loadChartData = useCallback(..., [setupWebSocket]); // setupWebSocket이 아직 정의되지 않음
const setupWebSocket = useCallback(..., [updateChartData]);
```

### 학습 가치

- **성능 최적화**: 불필요한 함수 재생성 방지
- **무한 루프 방지**: 안정적인 의존성으로 useEffect 재실행 최소화
- **코드 안정성**: 의존성 체인을 명확히 관리
- **React Hook 규칙**: ESLint 경고 해결

### useCallback vs useMemo

| Hook | 용도 | 반환값 |
| :--- | :--- | :--- |
| **useCallback** | 함수 메모이제이션 | 메모이제이션된 함수 |
| **useMemo** | 값 메모이제이션 | 메모이제이션된 값 |

### 실무 적용

- 복잡한 의존성 체인 관리
- 성능 최적화가 필요한 컴포넌트
- 무한 루프 방지
- React Hook 규칙 준수

---

## 🎯 실무 적용 시나리오

### 시나리오 1: 실시간 주식 대시보드
- **배치 업데이트**: 초당 수백 개 주가 업데이트 처리
- **지수 백오프**: 연결 끊김 시 자동 재연결
- **Map 데이터 구조**: 빠른 주식 코드 조회

### 시나리오 2: 채팅 애플리케이션
- **디바운스**: 메시지 입력 시 서버 요청 최적화
- **배치 업데이트**: 여러 메시지를 한 번에 렌더링
- **Server Components**: 초기 메시지 목록 서버 렌더링

### 시나리오 3: 외부 API 통합
- **어댑터 패턴**: 다양한 API 형식을 통일된 형식으로 변환
- **Rate Limit 처리**: API 제한을 준수하며 안정적으로 호출
- **리포지토리 패턴**: API 변경 시 영향 범위 최소화

### 시나리오 4: 실시간 대시보드
- **커스텀 훅**: WebSocket 연결을 재사용 가능한 훅으로 추상화
- **ref 패턴**: 의존성 문제 없이 최신 함수 참조 유지
- **반응형 디자인**: 다양한 디바이스에서 최적의 사용자 경험 제공
- **가격 변경 감지**: useRef로 이전 값 추적하여 변경 감지
- **애니메이션 스로틀링**: 100ms 간격 제한으로 과도한 애니메이션 방지

### 시나리오 5: 즐겨찾기 기능
- **Zustand Persist**: localStorage에 즐겨찾기 자동 저장 및 복원
- **디바운스 패턴**: 연속된 즐겨찾기 변경을 하나로 묶어 WebSocket 재구독 최적화
- **동적 구독 관리**: 대규모 변경은 전체 재구독, 소규모 변경은 차등 구독
- **이전 상태 추적**: useRef로 이전 구독 목록 추적하여 효율적인 변경 감지

---

## 📖 추가 학습 자료

### 관련 문서
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Zustand 공식 문서](https://zustand-demo.pmnd.rs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

### 디자인 패턴
- [Adapter Pattern](https://refactoring.guru/design-patterns/adapter)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)

---

## 💡 핵심 요약

1. **성능 최적화**: 배치 업데이트, Map 데이터 구조, ref를 통한 의존성 최적화, 애니메이션 스로틀링, 디바운스 패턴, 무한 스크롤, useCallback 메모이제이션
2. **안정성**: 지수 백오프, Rate Limit 처리, 디바운스, WebSocket 재연결, 동적 구독 관리, 데이터 간격 감지 및 메우기
3. **유지보수성**: 어댑터 패턴, 리포지토리 패턴, 커스텀 훅 추상화, 외부 라이브러리 통합 패턴
4. **사용자 경험**: 반응형 디자인, Server Components, 실시간 업데이트, 가격 변경 하이라이트, 영구 저장, 검색 가능한 모달, 키보드 네비게이션
5. **최신 기술**: Next.js Server Components, TypeScript, Tailwind CSS, Zustand Persist, Lightweight Charts, Intersection Observer API
6. **상태 관리**: Set과 Map을 활용한 복합 상태 관리, 이전 값 추적 패턴, localStorage 영구 저장, 실시간 데이터와 과거 데이터 병합
7. **데이터 처리**: 실시간 데이터 병합, 데이터 간격 감지 및 메우기, 시간 기준 정렬 및 중복 제거

이러한 패턴들을 이해하고 적용하면, 고성능이고 유지보수하기 쉬운 애플리케이션을 구축할 수 있습니다.

