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

1. **성능 최적화**: 배치 업데이트, Map 데이터 구조
2. **안정성**: 지수 백오프, Rate Limit 처리, 디바운스
3. **유지보수성**: 어댑터 패턴, 리포지토리 패턴
4. **최신 기술**: Next.js Server Components, TypeScript

이러한 패턴들을 이해하고 적용하면, 고성능이고 유지보수하기 쉬운 애플리케이션을 구축할 수 있습니다.

