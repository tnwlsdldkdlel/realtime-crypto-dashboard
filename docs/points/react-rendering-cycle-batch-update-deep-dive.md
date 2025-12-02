# React 렌더링 사이클과 배치 업데이트 딥다이브

## 📋 목차

1. [개요](#개요)
2. [React 렌더링 사이클 이해](#react-렌더링-사이클-이해)
3. [Redux와 React의 강한 결합](#redux와-react의-강한-결합)
4. [배치 업데이트의 필요성](#배치-업데이트의-필요성)
5. [Zustand의 해결책](#zustand의-해결책)
6. [실제 구현 분석](#실제-구현-분석)
7. [성능 비교](#성능-비교)
8. [실무 적용 가이드](#실무-적용-가이드)

---

## 개요

고빈도 실시간 데이터를 처리하는 웹 애플리케이션에서, 상태 관리 라이브러리의 선택은 성능에 큰 영향을 미칩니다. 특히 **Redux**와 같은 전통적인 상태 관리 라이브러리는 React의 렌더링 사이클과 밀접하게 연결되어 있어, 배치 업데이트를 구현하기 어렵습니다.

이 문서는 Redux의 한계와 Zustand를 통한 해결책을 상세히 분석합니다.

---

## React 렌더링 사이클 이해

### React의 렌더링 프로세스

```
상태 변경 (setState, dispatch 등)
  ↓
React가 변경 감지
  ↓
가상 DOM 재계산
  ↓
실제 DOM 업데이트 (필요한 경우)
  ↓
컴포넌트 리렌더링 완료
```

### React의 자동 배치 (Automatic Batching)

React 18부터는 **자동 배치** 기능이 도입되었습니다:

```typescript
// React 18: 이벤트 핸들러 내에서 자동 배치
function handleClick() {
  setState1(1); // 배치됨
  setState2(2); // 배치됨
  setState3(3); // 배치됨
  // → 한 번만 리렌더링
}
```

**하지만 한계가 있습니다:**

```typescript
// WebSocket 콜백은 이벤트 핸들러가 아님
websocket.onmessage = (event) => {
  dispatch(updateTicker(event.data)); // → 즉시 리렌더링
  // 자동 배치가 적용되지 않음
};
```

---

## Redux와 React의 강한 결합

### Redux의 동작 방식

```
Action Dispatch
  ↓
Reducer 실행
  ↓
Store 업데이트
  ↓
구독 컴포넌트 리렌더링 (즉시)
```

### Redux의 문제점

#### 1. 즉시 리렌더링

```typescript
// Redux Toolkit 예시
const tickerSlice = createSlice({
  name: 'ticker',
  initialState: { tickers: {} },
  reducers: {
    updateTicker: (state, action) => {
      state.tickers[action.payload.symbol] = action.payload;
      // ↑ 이 순간 즉시 React 컴포넌트가 리렌더링됨
    }
  }
});

// WebSocket 메시지 처리
websocket.onmessage = (event) => {
  const ticker = parseMessage(event.data);
  dispatch(tickerSlice.actions.updateTicker(ticker));
  // → 각 dispatch마다 즉시 리렌더링 발생
};
```

**문제점:**
- 초당 100개 메시지 → 초당 100번 리렌더링
- React의 배치 업데이트가 적용되지 않음
- 성능 저하 발생

#### 2. React Hook에 의존

```typescript
// Redux는 React Hook에 의존
const ticker = useSelector((state) => state.tickers[symbol]);
// ↑ 상태 변경 시 즉시 리렌더링됨

// 배치 업데이트를 위한 추가 작업이 어려움
```

#### 3. Redux의 설계 철학

Redux는 "Single Source of Truth"와 "상태 변경은 즉시 반영"을 원칙으로 합니다:

- 상태 변경은 즉시 반영되어야 함
- 배치 처리를 위한 내장 메커니즘이 제한적
- Reducer는 동기 함수 (비동기 배치 처리 어려움)

---

## 배치 업데이트의 필요성

### 고빈도 업데이트 시나리오

**실시간 암호화폐 대시보드의 경우:**

- 초당 수백 개의 WebSocket 메시지 수신
- 각 메시지마다 상태 업데이트 필요
- 100개 코인 목록 표시

**문제:**
- 각 업데이트마다 리렌더링 → 성능 저하
- 불필요한 DOM 조작 → 사용자 경험 저하
- CPU 사용률 증가

### 배치 업데이트의 효과

**배치 업데이트 전:**
```
메시지 1 → 리렌더링 1
메시지 2 → 리렌더링 2
...
메시지 100 → 리렌더링 100

초당 100번 리렌더링 ❌
```

**배치 업데이트 후:**
```
메시지 1-100 → 버퍼에 저장
requestAnimationFrame → 한 번에 처리
→ 리렌더링 1회

초당 ~60번 리렌더링 (프레임당 1회) ✅
```

---

## Zustand의 해결책

### Zustand의 핵심 특징

1. **React 외부에서 상태 관리**
   - Store가 React와 독립적으로 동작
   - React 렌더링 사이클을 우회 가능

2. **유연한 업데이트 제어**
   - 버퍼링, 배치 처리, 스로틀링 등 자유롭게 구현 가능
   - `requestAnimationFrame` 등으로 타이밍 제어

3. **선택적 구독**
   - 필요한 데이터만 구독하여 불필요한 리렌더링 최소화

---

## 실제 구현 분석

### 프로젝트의 배치 업데이트 구현

**위치**: `stores/tickerStore.ts`

#### 1. React 외부 버퍼 관리

```typescript
/**
 * 배치 업데이트를 위한 임시 버퍼
 * React 컴포넌트 외부에서 관리
 */
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;
let storeSetState: ((fn: (state: TickerStore) => Partial<TickerStore>) => void) | null = null;
```

**핵심 포인트:**
- `updateBuffer`는 React 컴포넌트 외부에 존재
- React의 렌더링 사이클과 완전히 분리
- 여러 업데이트를 모아서 처리 가능

#### 2. requestAnimationFrame으로 배치 스케줄링

```typescript
/**
 * 배치 업데이트 스케줄링
 */
function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}
```

**동작 원리:**
- `requestAnimationFrame`은 브라우저의 다음 리페인트 전에 실행
- 초당 약 60회 실행 (60 FPS)
- 여러 업데이트를 한 프레임에 모아서 처리

#### 3. 배치 처리 및 상태 업데이트

```typescript
/**
 * requestAnimationFrame을 사용한 배치 업데이트
 */
function flushUpdates() {
  if (updateBuffer.length === 0 || !storeSetState) return;

  const updates = [...updateBuffer]; // 모든 업데이트 수집
  updateBuffer = []; // 버퍼 초기화

  // 한 번만 상태 업데이트 → 한 번만 리렌더링
  storeSetState((state) => {
    const newTickers = new Map(state.tickers);
    updates.forEach((ticker) => {
      // 기존 티커의 nameKO를 유지
      const existingTicker = state.tickers.get(ticker.symbol);
      if (existingTicker?.nameKO && !ticker.nameKO) {
        ticker.nameKO = existingTicker.nameKO;
      }
      newTickers.set(ticker.symbol, ticker);
    });
    return { tickers: newTickers };
  });

  rafId = null;
}
```

**핵심 포인트:**
- 여러 업데이트를 한 번에 처리
- `storeSetState`는 한 번만 호출 → 한 번만 리렌더링
- Map 기반 업데이트로 O(1) 성능

#### 4. WebSocket 메시지 처리

```typescript
updateTicker: (ticker: Ticker) => {
  updateBuffer.push(ticker); // 버퍼에만 추가 (리렌더링 없음)
  scheduleUpdate(); // 다음 프레임에 배치 처리
}
```

**동작 흐름:**
1. WebSocket 메시지 수신
2. `updateTicker` 호출
3. 버퍼에 추가 (리렌더링 없음)
4. `requestAnimationFrame` 스케줄링
5. 다음 프레임에 배치 처리
6. 한 번만 상태 업데이트 → 한 번만 리렌더링

---

## 성능 비교

### 시나리오: 초당 100개의 WebSocket 메시지

#### Redux 방식

```
시간: 0ms
메시지 1 → dispatch → Reducer → Store 업데이트 → 리렌더링 1

시간: 10ms
메시지 2 → dispatch → Reducer → Store 업데이트 → 리렌더링 2

시간: 20ms
메시지 3 → dispatch → Reducer → Store 업데이트 → 리렌더링 3

...

시간: 1000ms
메시지 100 → dispatch → Reducer → Store 업데이트 → 리렌더링 100

결과: 초당 100번 리렌더링 ❌
```

**성능 지표:**
- 리렌더링 횟수: 초당 100회
- CPU 사용률: 높음
- 프레임 드롭: 발생 가능

#### Zustand 방식 (이 프로젝트)

```
시간: 0ms
메시지 1 → updateBuffer.push() (리렌더링 없음)

시간: 10ms
메시지 2 → updateBuffer.push() (리렌더링 없음)

시간: 20ms
메시지 3 → updateBuffer.push() (리렌더링 없음)

...

시간: 16.67ms (첫 번째 프레임)
requestAnimationFrame 콜백 실행
  → flushUpdates()
  → 버퍼의 모든 업데이트 처리
  → 한 번만 상태 업데이트
  → 한 번만 리렌더링

시간: 33.33ms (두 번째 프레임)
requestAnimationFrame 콜백 실행
  → flushUpdates()
  → 한 번만 리렌더링

...

결과: 초당 ~60번 리렌더링 (프레임당 1회) ✅
```

**성능 지표:**
- 리렌더링 횟수: 초당 ~60회 (프레임당 1회)
- CPU 사용률: 낮음
- 프레임 드롭: 없음

### 성능 비교표

| 항목 | Redux | Zustand (배치) | 개선율 |
|------|-------|----------------|--------|
| **리렌더링 횟수** | 초당 100회 | 초당 ~60회 | 40% 감소 |
| **CPU 사용률** | 높음 | 낮음 | - |
| **프레임 드롭** | 발생 가능 | 없음 | - |
| **메모리 사용량** | 비슷 | 비슷 | - |

---

## 실무 적용 가이드

### 언제 배치 업데이트가 필요한가?

1. **고빈도 데이터 업데이트**
   - 초당 수십 개 이상의 업데이트
   - 실시간 주식/암호화폐 가격
   - 게임 점수 업데이트

2. **대량 데이터 처리**
   - 수백 개 이상의 항목 업데이트
   - 리스트 가상화와 함께 사용

3. **성능 최적화가 중요한 경우**
   - 모바일 환경
   - 저사양 기기 지원

### 배치 업데이트 구현 패턴

#### 패턴 1: requestAnimationFrame 사용 (권장)

```typescript
let updateBuffer: T[] = [];
let rafId: number | null = null;

function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      flushUpdates();
      rafId = null;
    });
  }
}

function flushUpdates() {
  const updates = [...updateBuffer];
  updateBuffer = [];
  
  // 한 번에 모든 업데이트 처리
  storeSetState((state) => {
    // 업데이트 로직
    return newState;
  });
}
```

**장점:**
- 브라우저의 리페인트 사이클과 동기화
- 부드러운 애니메이션
- 프레임 드롭 최소화

#### 패턴 2: setTimeout 사용

```typescript
let updateBuffer: T[] = [];
let timeoutId: NodeJS.Timeout | null = null;

function scheduleUpdate() {
  if (timeoutId === null) {
    timeoutId = setTimeout(() => {
      flushUpdates();
      timeoutId = null;
    }, 16); // ~60 FPS
  }
}
```

**장점:**
- 간단한 구현
- Node.js 환경에서도 사용 가능

**단점:**
- 브라우저 리페인트와 동기화되지 않음
- 정확한 타이밍 보장 어려움

#### 패턴 3: 스로틀링 사용

```typescript
let lastUpdateTime = 0;
const THROTTLE_MS = 16; // ~60 FPS

function scheduleUpdate() {
  const now = Date.now();
  if (now - lastUpdateTime >= THROTTLE_MS) {
    flushUpdates();
    lastUpdateTime = now;
  }
}
```

**장점:**
- 간단한 구현
- 업데이트 빈도 제어 가능

**단점:**
- 정확한 타이밍 보장 어려움

### 주의사항

1. **초기 데이터 로딩 시 배치 스킵**

```typescript
updateTickers: (tickers: Ticker[]) => {
  // 초기 데이터 설정 시에는 즉시 반영 (배치 업데이트 스킵)
  if (get().tickers.size === 0 && tickers.length > 50) {
    const newTickers = new Map<string, Ticker>();
    tickers.forEach((ticker) => {
      newTickers.set(ticker.symbol, ticker);
    });
    set({ tickers: newTickers });
    return;
  }
  // 실시간 업데이트는 배치 처리
  updateBuffer.push(...tickers);
  scheduleUpdate();
}
```

**이유:**
- 초기 데이터는 사용자가 기다리고 있음
- 즉시 표시하는 것이 UX에 유리

2. **메모리 누수 방지**

```typescript
// 컴포넌트 언마운트 시 버퍼 정리
useEffect(() => {
  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    updateBuffer = [];
  };
}, []);
```

3. **버퍼 크기 제한**

```typescript
const MAX_BUFFER_SIZE = 1000;

function scheduleUpdate() {
  if (updateBuffer.length >= MAX_BUFFER_SIZE) {
    // 버퍼가 너무 크면 즉시 처리
    flushUpdates();
  } else {
    // 일반적인 경우 배치 처리
    if (rafId === null) {
      rafId = requestAnimationFrame(() => flushUpdates());
    }
  }
}
```

---

## Redux에서 배치 업데이트 구현 시도

### 시도 1: Redux Thunk 사용

```typescript
// ❌ 여전히 각 dispatch마다 리렌더링
const updateTickerBatch = (tickers: Ticker[]) => {
  return (dispatch) => {
    tickers.forEach((ticker) => {
      dispatch(updateTicker(ticker)); // 각각 리렌더링
    });
  };
};
```

**문제점:**
- 여전히 각 dispatch마다 리렌더링
- 배치 효과 없음

### 시도 2: Redux Toolkit의 `createListenerMiddleware` 사용

```typescript
// ⚠️ 복잡하고 제한적
const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: updateTicker,
  effect: async (action, listenerApi) => {
    // 배치 처리 시도
    // 하지만 여전히 React와 강하게 결합됨
  },
});
```

**문제점:**
- 복잡한 구현
- React 렌더링 사이클을 완전히 우회하기 어려움

### 결론: Redux의 구조적 한계

Redux는 다음과 같은 구조적 한계로 인해 배치 업데이트가 어렵습니다:

1. **React Hook에 의존**: `useSelector`는 React Hook
2. **즉시 반영 원칙**: 상태 변경은 즉시 반영되어야 함
3. **동기 Reducer**: 비동기 배치 처리가 어려움

---

## Zustand의 장점 요약

### 1. React 외부에서 상태 관리

```typescript
// Zustand Store는 React와 독립적
const useTickerStore = create((set, get) => {
  // React 컴포넌트 없이도 동작 가능
  return {
    tickers: new Map(),
    updateTicker: (ticker) => {
      // React 렌더링 사이클과 무관하게 처리
    }
  };
});
```

### 2. 유연한 업데이트 제어

```typescript
// 배치 업데이트, 스로틀링, 디바운스 등 자유롭게 구현
updateTicker: (ticker: Ticker) => {
  updateBuffer.push(ticker);
  scheduleUpdate(); // requestAnimationFrame으로 제어
}
```

### 3. 선택적 구독

```typescript
// 필요한 데이터만 구독
const ticker = useTickerStore((state) => state.tickers.get('BTCUSDT'));
// → BTCUSDT만 변경될 때만 리렌더링
```

---

## 실전 예제

### 예제 1: 실시간 주식 가격 대시보드

```typescript
// stores/stockStore.ts
let updateBuffer: Stock[] = [];
let rafId: number | null = null;

function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}

function flushUpdates() {
  const updates = [...updateBuffer];
  updateBuffer = [];
  
  storeSetState((state) => {
    const newStocks = new Map(state.stocks);
    updates.forEach((stock) => {
      newStocks.set(stock.symbol, stock);
    });
    return { stocks: newStocks };
  });
  
  rafId = null;
}

export const useStockStore = create((set, get) => {
  return {
    stocks: new Map(),
    updateStock: (stock: Stock) => {
      updateBuffer.push(stock);
      scheduleUpdate();
    }
  };
});
```

### 예제 2: 게임 점수 업데이트

```typescript
// stores/scoreStore.ts
let scoreBuffer: number[] = [];
let rafId: number | null = null;

function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      const totalScore = scoreBuffer.reduce((sum, score) => sum + score, 0);
      scoreBuffer = [];
      
      storeSetState((state) => ({
        score: state.score + totalScore
      }));
      
      rafId = null;
    });
  }
}

export const useScoreStore = create((set) => {
  return {
    score: 0,
    addScore: (points: number) => {
      scoreBuffer.push(points);
      scheduleUpdate();
    }
  };
});
```

---

## 학습 체크리스트

- [ ] React 렌더링 사이클의 동작 원리 이해
- [ ] Redux와 React의 강한 결합 이해
- [ ] 배치 업데이트의 필요성 이해
- [ ] `requestAnimationFrame`의 동작 원리 이해
- [ ] Zustand의 React 외부 상태 관리 이해
- [ ] 배치 업데이트 구현 패턴 숙지
- [ ] 성능 최적화 전략 이해

---

## 참고 자료

- [React 공식 문서 - 렌더링과 커밋](https://react.dev/learn/render-and-commit)
- [Redux 공식 문서](https://redux.js.org/)
- [Zustand 공식 문서](https://zustand-demo.pmnd.rs/)
- [requestAnimationFrame MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [프로젝트 tickerStore 구현](./../../stores/tickerStore.ts)

---

## 관련 문서

- [requestAnimationFrame 딥다이브](./requestanimationframe-deep-dive.md)
- [useCallback 의존성 체인 딥다이브](./usecallback-dependency-chain-deep-dive.md)
- [학습 포인트](./learning-points.md)

