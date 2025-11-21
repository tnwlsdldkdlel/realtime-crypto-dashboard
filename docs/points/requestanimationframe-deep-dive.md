# requestAnimationFrame 심화 가이드

`requestAnimationFrame`을 활용한 성능 최적화와 배치 업데이트 패턴을 다룹니다.

---

## 📚 목차

1. [requestAnimationFrame 기본 개념](#1-requestanimationframe-기본-개념)
2. [브라우저 렌더링 사이클과의 관계](#2-브라우저-렌더링-사이클과의-관계)
3. [배치 업데이트 패턴](#3-배치-업데이트-패턴)
4. [실무 활용 사례](#4-실무-활용-사례)
5. [성능 최적화 팁](#5-성능-최적화-팁)
6. [자주 하는 실수와 해결 방법](#6-자주-하는-실수와-해결-방법)
7. [실무 예제](#7-실무-예제)

---

## 1. requestAnimationFrame 기본 개념

### 1.1 requestAnimationFrame이란?

`requestAnimationFrame`은 브라우저에게 **다음 렌더링 사이클(다음 프레임)** 을 시작하기 직전에 실행할 함수를 등록하는 API입니다. 따라서 브라우저의 렌더링 주기(보통 60fps, 약 16.67ms)와 정확히 동기화됩니다.

```typescript
// 기본 사용법
const rafId = requestAnimationFrame(() => {
  // 다음 프레임에서 실행될 코드
  console.log('Animation frame');
});

// 취소
cancelAnimationFrame(rafId);
```

### 1.2 왜 requestAnimationFrame을 사용할까?

#### 문제: setTimeout/setInterval의 한계

```typescript
// ❌ 문제: 브라우저 렌더링과 동기화되지 않음
setInterval(() => {
  updateAnimation();
}, 16); // 60fps를 목표로 하지만 정확하지 않음

// 문제점:
// 1. 다른 탭으로 전환하거나 다른 애플리케이션으로 전환하여 탭이 백그라운드로 이동해도 계속 실행 (배터리 낭비)
// 2. 화면 주사율과 맞지 않을 수 있음 (60Hz, 120Hz, 144Hz 등)
// 3. 불필요한 렌더링 발생 가능
```

#### 해결: requestAnimationFrame

```typescript
// ✅ 해결: 브라우저 렌더링과 완벽히 동기화
function animate() {
  updateAnimation();
  requestAnimationFrame(animate); // 다음 프레임 요청
}

requestAnimationFrame(animate);

// 장점:
// 1. 다른 탭으로 전환하거나 다른 애플리케이션으로 전환하여 탭이 백그라운드로 이동하면 자동으로 일시정지 (배터리 절약)
// 2. 화면 주사율에 맞춰 자동 조정 (60Hz, 120Hz, 144Hz 등)
// 3. 브라우저 렌더링과 동기화되어 부드러운 애니메이션
```

### 1.3 requestAnimationFrame의 특징

| 특징 | 설명 |
| :--- | :--- |
| **자동 일시정지** | 다른 탭으로 전환하거나 다른 애플리케이션으로 전환하여 탭이 백그라운드로 이동하면 자동으로 일시정지 |
| **주사율 자동 조정** | 60Hz, 120Hz, 144Hz 등 화면 주사율에 맞춤 |
| **렌더링 동기화** | 브라우저 리페인트 전에 실행되어 부드러운 애니메이션 |
| **배터리 효율** | 불필요한 실행을 방지하여 배터리 절약 |

### 1.4 프로젝트 적용 배경

이 프로젝트에서는 `stores/tickerStore.ts`에서 초당 수백 건의 WebSocket 티커 메시지를 처리해야 합니다. 각 메시지마다 상태를 업데이트하면 리렌더링이 폭증하므로, `requestAnimationFrame`을 이용해 동일 프레임 안에서 들어온 업데이트를 한 번에 처리하도록 배치(Batch)했습니다.

```typescript
// stores/tickerStore.ts
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;

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

function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}
```

**적용 이유**
- 고빈도 WebSocket 업데이트를 한 프레임에 합쳐 리렌더링 횟수 최소화
- 브라우저 렌더링 타이밍과 맞춰 UI 반영 → 끊김 없는 숫자 갱신
- 초기 데이터는 즉시 반영하고, 실시간 데이터만 배치 처리해 UX 균형 유지

---

## 2. 브라우저 렌더링 사이클과의 관계

### 2.1 브라우저 렌더링 파이프라인

브라우저는 다음 순서로 화면을 그립니다:

```
1. JavaScript 실행
   ↓
2. Style 계산 (CSS)
   ↓
3. Layout (Reflow)
   ↓
4. Paint
   ↓
5. Composite
   ↓
6. 화면에 표시
```

### 2.2 requestAnimationFrame 실행 시점

`requestAnimationFrame` 콜백은 **Style 계산이 시작되기 직전**, 즉 전체 렌더링 파이프라인이 돌기 전에 실행됩니다:

```
1. requestAnimationFrame 콜백 실행 ← 여기!
   ↓
2. Style 계산 (CSS)
   ↓
3. Layout (Reflow)
   ↓
4. Paint
   ↓
5. Composite
   ↓
6. 화면에 표시
```

이 시점에 DOM 변경을 하면, 브라우저가 다음 프레임에서 변경사항을 반영할 수 있습니다.

### 2.3 실제 동작 예제

```typescript
// DOM 변경이 렌더링 사이클과 동기화됨
function animate() {
  // 이 시점에 DOM 변경
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  
  // 다음 프레임 요청
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
// → 브라우저가 다음 프레임에서 변경사항을 반영
```

---

## 3. 배치 업데이트 패턴

### 3.1 배치 업데이트가 필요한 이유

고빈도 데이터 업데이트(예: WebSocket 메시지)를 매번 상태 업데이트하면 성능 문제가 발생합니다.

```typescript
// ❌ 문제: 매번 상태 업데이트 → 리렌더링 폭증
websocket.onmessage = (message) => {
  const ticker = parseMessage(message);
  setTicker(ticker); // 매번 리렌더링 발생
  // 초당 100개 메시지 = 초당 100번 리렌더링!
};
```

### 3.2 배치 업데이트 패턴 구현

#### 기본 구조

```typescript
// 배치 업데이트를 위한 버퍼
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;

// 배치 업데이트 실행
function flushUpdates() {
  if (updateBuffer.length === 0) return;
  
  // 버퍼의 모든 업데이트를 한 번에 처리
  const updates = [...updateBuffer];
  updateBuffer = []; // 버퍼 비우기
  
  // 한 번만 상태 업데이트
  setTickers((prev) => {
    const newTickers = new Map(prev);
    updates.forEach((ticker) => {
      newTickers.set(ticker.symbol, ticker);
    });
    return newTickers;
  });
  
  rafId = null;
}

// 업데이트 스케줄링
function scheduleUpdate() {
  if (rafId === null) {
    // 다음 프레임에서 배치 업데이트 실행
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}

// 사용
websocket.onmessage = (message) => {
  const ticker = parseMessage(message);
  updateBuffer.push(ticker); // 버퍼에 추가
  scheduleUpdate(); // 다음 프레임에 배치 처리
};
```

### 3.3 배치 업데이트의 장점

1. **리렌더링 횟수 감소**: 초당 수백 개 업데이트를 초당 60번(60fps)으로 제한
2. **브라우저 동기화**: 렌더링 사이클과 맞춰 불필요한 렌더링 방지
3. **성능 향상**: CPU 사용량 감소, 부드러운 UI

### 3.4 중복 요청 방지

```typescript
let rafId: number | null = null;

function scheduleUpdate() {
  // 이미 스케줄링된 경우 중복 요청 방지
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      flushUpdates();
      rafId = null; // 실행 후 초기화
    });
  }
}

// 여러 번 호출되어도 한 번만 스케줄링됨
scheduleUpdate(); // rafId = 1
scheduleUpdate(); // 이미 스케줄링됨, 무시
scheduleUpdate(); // 이미 스케줄링됨, 무시
// → 다음 프레임에 한 번만 실행
```

---

## 4. 실무 활용 사례

### 4.1 실시간 데이터 시각화

```typescript
// 실시간 주식/암호화폐 가격 업데이트
function useRealtimePriceUpdates() {
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const bufferRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  const flushUpdates = useCallback(() => {
    if (bufferRef.current.size === 0) return;

    const updates = new Map(bufferRef.current);
    bufferRef.current.clear();

    setPrices((prev) => {
      const newPrices = new Map(prev);
      updates.forEach((price, symbol) => {
        newPrices.set(symbol, price);
      });
      return newPrices;
    });

    rafIdRef.current = null;
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushUpdates);
    }
  }, [flushUpdates]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    bufferRef.current.set(symbol, price);
    scheduleUpdate();
  }, [scheduleUpdate]);

  return { prices, updatePrice };
}
```

### 4.2 애니메이션 최적화

```typescript
// 부드러운 스크롤 애니메이션
function smoothScroll(element: HTMLElement, targetY: number) {
  const startY = element.scrollTop;
  const distance = targetY - startY;
  const duration = 500; // 500ms
  let startTime: number | null = null;

  function animate(currentTime: number) {
    if (startTime === null) {
      startTime = currentTime;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing 함수 (easeInOutCubic)
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    element.scrollTop = startY + distance * ease;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}
```

### 4.3 게임 루프

```typescript
// 게임 상태 업데이트 루프
class GameLoop {
  private rafId: number | null = null;
  private lastTime = 0;

  start() {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      // 게임 상태 업데이트
      this.update(deltaTime);
      this.render();

      this.rafId = requestAnimationFrame(animate);
    };

    this.rafId = requestAnimationFrame(animate);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private update(deltaTime: number) {
    // 게임 로직 업데이트
  }

  private render() {
    // 렌더링
  }
}
```

### 4.4 센서 데이터 시각화

```typescript
// 고빈도 센서 데이터 시각화
function useSensorDataVisualization() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const bufferRef = useRef<DataPoint[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushUpdates = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    const updates = [...bufferRef.current];
    bufferRef.current = [];

    setDataPoints((prev) => {
      // 최근 1000개 데이터만 유지
      const newData = [...prev, ...updates];
      return newData.slice(-1000);
    });

    rafIdRef.current = null;
  }, []);

  const addDataPoint = useCallback((point: DataPoint) => {
    bufferRef.current.push(point);

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushUpdates);
    }
  }, [flushUpdates]);

  return { dataPoints, addDataPoint };
}
```

---

## 5. 성능 최적화 팁

### 5.1 중복 스케줄링 방지 (Throttling)

`requestAnimationFrame`은 호출한 횟수만큼 콜백이 예약됩니다. 한 프레임(16ms) 안에 데이터가 100번 들어와서 `requestAnimationFrame`을 100번 호출하면, 다음 프레임에 콜백 함수가 100번 실행됩니다. 이는 배칭(Batching)의 목적을 완전히 무색하게 만듭니다.

**해결책**: `rafId` 변수를 플래그(Flag)처럼 사용하여, 이미 예약된 프레임이 있다면 추가 요청을 무시합니다.

```typescript
// ✅ 좋은 예: 중복 방지 패턴
let rafId: number | null = null;

function scheduleUpdate() {
  // 이미 다음 프레임에 예약이 되어 있다면(rafId !== null), 아무것도 하지 않음
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      flushUpdates();
      rafId = null; // 실행이 끝나면 플래그 초기화 (다음 예약을 받을 준비)
    });
  }
}

// ❌ 나쁜 예: 매번 새로운 요청
function scheduleUpdate() {
  // 데이터가 들어올 때마다 예약 -> 다음 프레임에 flushUpdates가 수십 번 실행됨
  requestAnimationFrame(flushUpdates); 
}
```

### 5.2 버퍼 크기 제한 (Backpressure Handling)

웹소켓이나 센서 데이터가 폭주하여 소비 속도(렌더링)보다 생산 속도(데이터 수신)가 빠를 경우, 버퍼가 무한정 커질 수 있습니다. 이는 **메모리 부족(OOM)**을 유발하거나, 나중에 한 번에 처리할 때 **긴 프레임 드롭(Long Task)**을 발생시킵니다.

**해결책**: 버퍼에 "최대 용량"을 정해두고, 이를 넘으면 강제로 비우거나(Flush) 오래된 데이터를 버리는 전략을 취합니다.

```typescript
const MAX_BUFFER_SIZE = 1000;

function addToBuffer(item: Ticker) {
  // 안전장치: 버퍼가 위험 수위에 도달하면 rAF를 기다리지 않고 즉시 처리
  if (updateBuffer.length >= MAX_BUFFER_SIZE) {
    console.warn('Buffer overflow! Flushing immediately.');
    flushUpdates(); 
  }
  
  updateBuffer.push(item);
  scheduleUpdate();
}
```

### 5.3 초기 데이터는 즉시 반영 (First Paint Optimization)

배치 업데이트는 필연적으로 **최소 1 프레임(약 16ms)의 지연**을 발생시킵니다. 실시간 업데이트에서는 이 지연이 부드러움을 주지만, 사용자가 처음 페이지에 들어왔을 때 목록이 텅 비어 있다가 16ms 뒤에 깜빡이며 나타나는 것은 좋지 않은 경험(FOUC 유사)입니다.

**해결책**: 데이터가 하나도 없는 "초기 상태"일 때는 배칭을 건너뛰고 즉시 렌더링합니다.

```typescript
function updateTickers(tickers: Ticker[]) {
  // 현재 화면에 아무것도 없고(size === 0), 들어온 데이터가 충분히 많다면
  if (get().tickers.size === 0 && tickers.length > 50) {
    // [최적화] 큐를 거치지 않고 즉시 상태 업데이트 -> 첫 화면 렌더링 속도 향상
    set({ tickers: new Map(tickers.map(t => [t.symbol, t])) });
    return;
  }
  
  // 그 외의 경우(이미 데이터가 있거나 소량 업데이트)는 배칭 처리
  updateBuffer.push(...tickers);
  scheduleUpdate();
}
```

### 5.4 메모리 누수 방지 (Cleanup)

SPA(Single Page Application)에서는 페이지를 이동해도 자바스크립트 메모리가 유지됩니다. 컴포넌트가 언마운트(Unmount)되었는데도 `requestAnimationFrame` 콜백이 실행되려 하면, 존재하지 않는 컴포넌트의 상태를 업데이트하려다 에러가 발생하거나 메모리 누수가 생깁니다.

**해결책**: `useEffect`의 cleanup 함수에서 반드시 `cancelAnimationFrame`을 호출해야 합니다.

```typescript
useEffect(() => {
  // 애니메이션 시작
  const rafId = requestAnimationFrame(animate);

  // 클린업 함수: 컴포넌트가 사라지거나 다시 렌더링되기 전에 실행
  return () => {
    // 1. 예약된 프레임 취소
    cancelAnimationFrame(rafId);
    
    // 2. (선택) 처리되지 않고 남은 버퍼 비우기
    updateBuffer = []; 
  };
}, []);
```

---

## 6. 자주 하는 실수와 해결 방법

### 6.1 실수 1: 중복 스케줄링

```typescript
// ❌ 실수: 매번 새로운 requestAnimationFrame 호출
function updateData(data: Data) {
  updateBuffer.push(data);
  requestAnimationFrame(flushUpdates); // 중복 요청!
}

// ✅ 해결: 중복 방지 로직 추가
let rafId: number | null = null;

function updateData(data: Data) {
  updateBuffer.push(data);
  
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      flushUpdates();
      rafId = null;
    });
  }
}
```

### 6.2 실수 2: 클린업 누락

```typescript
// ❌ 실수: 클린업 없음
useEffect(() => {
  const rafId = requestAnimationFrame(animate);
  // 클린업 없음 → 메모리 누수 가능
}, []);

// ✅ 해결: 클린업 함수 제공
useEffect(() => {
  const rafId = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(rafId);
  };
}, []);
```

### 6.3 실수 3: 무거운 동기 작업 수행 (Blocking Main Thread)

`requestAnimationFrame` 콜백은 **브라우저가 화면을 그리기(Paint) 바로 직전**에 실행됩니다. 이 소중한 시간(약 16ms) 내에 무거운 계산(Heavy Computation)을 수행하면, 브라우저는 계산이 끝날 때까지 화면을 그리지 못하고 멈춰버립니다. 이를 **프레임 드롭(Frame Drop)** 또는 **Jank**라고 합니다.

**문제 상황**:
```typescript
// ❌ 실수: 렌더링 직전에 무거운 계산을 수행하여 프레임을 막음
function flushUpdates() {
  // 예: 수천 개의 데이터를 정렬하거나 복잡한 필터링 수행 (100ms 소요)
  const sortedData = heavySort(updateBuffer); 
  
  // 100ms 동안 화면이 멈춘 뒤에야 상태 업데이트 -> 사용자 경험 저하
  setState(sortedData);
}
```

**해결책 1: 작업 분할 (Time Slicing)**
무거운 작업을 잘게 쪼개서 `setTimeout`이나 `scheduler.postTask`를 통해 메인 스레드를 잠깐씩 양보하며 실행합니다.

```typescript
// ✅ 해결 1: 렌더링과 계산을 분리
function flushUpdates() {
  // 1. 일단 가벼운 상태 업데이트만 먼저 수행 (화면 갱신)
  const updates = [...updateBuffer];
  setState(updates);
  
  // 2. 무거운 계산은 다음 이벤트 루프로 미룸 (렌더링 차단 방지)
  setTimeout(() => {
    const result = heavyComputation(updates);
    // 계산이 끝나면 추가 업데이트
    setDerivedState(result);
  }, 0);
}
```

**해결책 2: Web Worker 사용**
계산 작업 자체를 메인 스레드가 아닌 별도의 백그라운드 스레드(Web Worker)로 옮깁니다.

```typescript
// ✅ 해결 2: Web Worker로 계산 격리
const worker = new Worker('worker.js');

function flushUpdates() {
  // 메인 스레드는 UI 렌더링만 담당
  setState(updates);
  
  // 무거운 계산은 워커에게 위임 (메인 스레드 영향 없음)
  worker.postMessage(updates);
}

worker.onmessage = (e) => {
  setDerivedState(e.data);
};
```

### 6.4 실수 4: 버퍼 무한 증가

```typescript
// ❌ 실수: 버퍼가 계속 증가
function updateData(data: Data) {
  updateBuffer.push(data); // 계속 쌓임
  scheduleUpdate();
}

// ✅ 해결: 버퍼 크기 제한
const MAX_BUFFER_SIZE = 1000;

function updateData(data: Data) {
  if (updateBuffer.length >= MAX_BUFFER_SIZE) {
    // 오래된 데이터 제거 또는 즉시 처리
    updateBuffer = updateBuffer.slice(-MAX_BUFFER_SIZE);
    flushUpdates();
  }
  updateBuffer.push(data);
  scheduleUpdate();
}
```

---

## 7. 실무 예제

### 예제 1: 프로젝트 실제 코드 (tickerStore.ts)

```typescript
/**
 * 배치 업데이트를 위한 임시 버퍼
 */
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;
let storeSetState: ((fn: (state: TickerStore) => Partial<TickerStore>) => void) | null = null;

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

export const useTickerStore = create<TickerStore>((set, get) => {
  storeSetState = set;

  return {
    tickers: new Map(),

    updateTicker: (ticker: Ticker) => {
      updateBuffer.push(ticker);
      scheduleUpdate();
    },

    updateTickers: (tickers: Ticker[]) => {
      // 초기 데이터는 즉시 반영
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
    },
  };
});
```

**핵심 포인트:**
- `rafId`로 중복 스케줄링 방지
- 버퍼를 사용하여 여러 업데이트를 배치 처리
- 초기 데이터는 즉시 반영, 실시간 업데이트만 배치 처리
- 브라우저 렌더링 사이클과 동기화

### 예제 2: React 훅으로 구현한 배치 업데이트

```typescript
function useBatchedUpdates<T>() {
  const [state, setState] = useState<T[]>([]);
  const bufferRef = useRef<T[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const flushUpdates = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    const updates = [...bufferRef.current];
    bufferRef.current = [];

    setState((prev) => [...prev, ...updates]);
    rafIdRef.current = null;
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushUpdates);
    }
  }, [flushUpdates]);

  const addUpdate = useCallback((item: T) => {
    bufferRef.current.push(item);
    scheduleUpdate();
  }, [scheduleUpdate]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { state, addUpdate };
}
```

### 예제 3: 커스텀 훅으로 애니메이션 제어

```typescript
function useAnimationFrame(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback]);
}

// 사용 예시
function AnimatedComponent() {
  const [x, setX] = useState(0);

  useAnimationFrame((deltaTime) => {
    setX((prev) => prev + deltaTime * 0.1);
  });

  return <div style={{ transform: `translateX(${x}px)` }}>Moving</div>;
}
```

---

## 📝 체크리스트

배치 업데이트를 구현할 때 다음을 확인하세요:

- [ ] 중복 스케줄링을 방지했는가? (`rafId` 체크)
- [ ] 클린업 함수를 제공했는가? (`cancelAnimationFrame`)
- [ ] 버퍼 크기 제한을 두었는가? (메모리 누수 방지)
- [ ] 초기 데이터는 즉시 반영하는가? (사용자 경험)
- [ ] 브라우저 렌더링 사이클과 동기화되었는가?
- [ ] 무거운 작업을 requestAnimationFrame 내에서 수행하지 않았는가?

---

## 🎯 핵심 요약

1. **requestAnimationFrame**: 브라우저 렌더링 사이클과 동기화된 애니메이션/업데이트
2. **배치 업데이트**: 고빈도 업데이트를 버퍼에 모아 한 번에 처리하여 성능 최적화
3. **중복 방지**: `rafId`로 중복 스케줄링 방지
4. **클린업**: 컴포넌트 언마운트 시 `cancelAnimationFrame` 호출
5. **초기 데이터**: 초기 로드는 즉시 반영, 실시간 업데이트만 배치 처리
6. **성능**: 리렌더링 횟수 감소, CPU 사용량 감소, 부드러운 UI

이러한 패턴들을 이해하고 적용하면, 고빈도 실시간 데이터를 효율적으로 처리하는 React 애플리케이션을 구축할 수 있습니다.

---

## 📚 참고 자료

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [Google: Optimize JavaScript Execution](https://web.dev/optimize-javascript-execution/)
- [React: Scheduling in React](https://react.dev/learn/render-and-commit)

