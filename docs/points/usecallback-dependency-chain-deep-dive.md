# useCallback을 활용한 함수 메모이제이션 및 의존성 체인 관리 딥다이브

차트 구현 과정에서 React Hook의 의존성 배열 문제로 인해 무한 루프와 불필요한 재렌더링이 발생했습니다. 이 문서는 `useCallback`을 활용하여 함수를 메모이제이션하고, 의존성 체인을 올바르게 관리하는 방법을 상세히 설명합니다.

---

## 1. useCallback이란?

`useCallback`은 React Hook 중 하나로, 함수를 메모이제이션하여 **의존성이 변경되지 않는 한 동일한 함수 참조를 유지**합니다.

### 기본 문법

```typescript
const memoizedCallback = useCallback(
  () => {
    // 함수 본문
  },
  [deps] // 의존성 배열
);
```

### useCallback vs 일반 함수

```typescript
// ❌ 일반 함수: 매 렌더링마다 새로운 함수 생성
const handleClick = () => {
  console.log('clicked');
};

// ✅ useCallback: 의존성이 변경되지 않으면 동일한 함수 참조 유지
const handleClick = useCallback(() => {
  console.log('clicked');
}, []); // 의존성 없음 → 항상 동일한 함수
```

### useCallback vs useMemo

| Hook | 용도 | 반환값 |
| :--- | :--- | :--- |
| **useCallback** | 함수 메모이제이션 | 메모이제이션된 함수 |
| **useMemo** | 값 메모이제이션 | 메모이제이션된 값 |

```typescript
// useCallback: 함수를 메모이제이션
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);

// useMemo: 값을 메모이제이션
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```

---

## 2. 문제 상황: 무한 루프와 불필요한 재렌더링

### 2.1 문제 코드

```typescript
// app/chart/ChartClient.tsx (문제가 있던 코드)

const updateChartDataWithRealtimeKline = (kline: {...}) => {
  setChartData((prevData) => {
    // ...
  });
};

const setupWebSocket = (symbol: string) => {
  wsClientRef.current = new BinanceWebSocketClient({
    onKlineMessage: (message) => {
      const kline = adaptBinanceKlineStream(message);
      updateChartDataWithRealtimeKline(kline); // 매번 새로운 함수 참조
    },
  });
  // ...
};

const loadChartData = async (symbol: string, interval: string) => {
  // ...
  setupWebSocket(symbol); // 매번 새로운 함수 참조
};

useEffect(() => {
  loadChartData(selectedSymbol, selectedInterval);
}, [selectedSymbol, selectedInterval, loadChartData]); // loadChartData가 매번 변경됨
```

### 2.2 문제점 분석

1. **함수 재생성**: 매 렌더링마다 새로운 함수가 생성됨
2. **의존성 변경**: `loadChartData`가 매번 새로운 참조이므로 `useEffect`가 계속 재실행됨
3. **무한 루프**: `useEffect` 실행 → 상태 변경 → 리렌더링 → 함수 재생성 → `useEffect` 재실행 → ...

### 2.3 실제 발생한 문제

의존성 체인 순서에 따라 문제가 연쇄적으로 발생했습니다:

```
1. 컴포넌트 렌더링
   ↓
2. updateChartDataWithRealtimeKline 함수 생성 (새로운 참조)
   ↓
3. setupWebSocket 함수 생성 (updateChartDataWithRealtimeKline이 변경되어 재생성)
   ↓
4. loadChartData 함수 생성 (setupWebSocket이 변경되어 재생성)
   ↓
5. useEffect 실행 (loadChartData 의존성 변경 감지)
   ↓
6. 차트 데이터 로드 → 상태 변경
   ↓
7. 컴포넌트 리렌더링
   ↓
8. updateChartDataWithRealtimeKline 함수 재생성 (새로운 참조)
   ↓
9. setupWebSocket 함수 재생성 (updateChartDataWithRealtimeKline 변경으로 인해)
   ↓
10. loadChartData 함수 재생성 (setupWebSocket 변경으로 인해)
   ↓
11. useEffect 재실행 (loadChartData 변경 감지)
   ↓
12. 무한 루프 반복...
```

**핵심 문제**: 하위 함수(`updateChartDataWithRealtimeKline`)가 매번 재생성되면서, 의존성 체인을 따라 상위 함수들(`setupWebSocket` → `loadChartData`)도 모두 재생성되고, 결국 `useEffect`가 무한 루프에 빠지게 됩니다.

---

## 3. 해결 방법: useCallback과 의존성 체인 관리

### 3.1 올바른 구현 코드

```typescript
// app/chart/ChartClient.tsx

// 1단계: 유틸리티 함수 (의존성 없음)
const convertKlineToCandlestickFromKline = (kline: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}): CandlestickData => {
  return {
    time: (kline.openTime / 1000) as Time,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
  };
};

// 2단계: 상태 업데이트 함수 (useCallback으로 감싸기)
const updateChartDataWithRealtimeKline = useCallback((kline: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}) => {
  setChartData((prevData) => {
    const newData = [...prevData];
    const klineTime = kline.openTime / 1000;
    
    const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
    const candlestickData = convertKlineToCandlestickFromKline(kline);
    
    if (existingIndex >= 0) {
      newData[existingIndex] = candlestickData;
    } else {
      newData.push(candlestickData);
      newData.sort((a, b) => (a.time as number) - (b.time as number));
    }
    
    chartDataRef.current = newData;
    return newData;
  });
}, []); // 의존성 없음 (setState 함수는 안정적)

// 3단계: WebSocket 설정 (updateChartDataWithRealtimeKline 의존)
const setupWebSocket = useCallback((symbol: string) => {
  if (wsClientRef.current) {
    wsClientRef.current.disconnect();
    wsClientRef.current = null;
  }

  wsClientRef.current = new BinanceWebSocketClient({
    onKlineMessage: (message: BinanceKlineStreamMessage) => {
      try {
        if (message.data.s === symbol) {
          const kline = adaptBinanceKlineStream(message);
          updateChartDataWithRealtimeKline(kline); // 메모이제이션된 함수 사용
        }
      } catch (error) {
        console.error('Failed to process kline message:', error);
      }
    },
    onStatusChange: (status) => {
      if (status === 'error') {
        console.error('WebSocket connection error');
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
  });

  wsClientRef.current.subscribe([symbol], 'kline');
  wsClientRef.current.connect();
}, [updateChartDataWithRealtimeKline]); // 의존성 명시

// 4단계: 데이터 로드 (setupWebSocket 의존)
const loadChartData = useCallback(async (symbol: string, interval: string) => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch(
      `/api/klines?symbol=${symbol}&interval=${interval}&limit=500`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch chart data');
    }

    const klines: BinanceKlineResponse[] = await response.json();
    
    if (!Array.isArray(klines) || klines.length === 0) {
      throw new Error('No chart data available');
    }
    
    let candlestickData = klines.map(convertKlineToCandlestick);
    
    // 데이터 간격 감지 및 메우기
    candlestickData = await detectAndFillGaps(candlestickData, symbol, interval);
    
    setChartData(candlestickData);
    chartDataRef.current = candlestickData;

    // WebSocket 연결 및 Kline 스트림 구독 (1분봉만 실시간 지원)
    if (interval === '1m') {
      setupWebSocket(symbol); // 메모이제이션된 함수 사용
    } else {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
    }
  } catch (err) {
    console.error('Error loading chart data:', err);
    setError(err instanceof Error ? err.message : '차트 데이터를 불러오는데 실패했습니다');
  } finally {
    setLoading(false);
  }
}, [setupWebSocket]); // 의존성 명시

// 5단계: useEffect (loadChartData 의존)
useEffect(() => {
  loadChartData(selectedSymbol, selectedInterval);
}, [selectedSymbol, selectedInterval, loadChartData]); // 안정적인 의존성
```

### 3.2 의존성 체인 시각화

의존성 체인은 함수들이 서로 의존하는 관계를 나타냅니다. 하위 함수부터 상위 함수 순서로 정의해야 합니다.

```
1단계: convertKlineToCandlestickFromKline
    → 의존성 없음 (순수 함수)

2단계: updateChartDataWithRealtimeKline
    → 의존성: [] (setState는 안정적)

3단계: setupWebSocket
    → 의존성: [updateChartDataWithRealtimeKline]
    → updateChartDataWithRealtimeKline 사용

4단계: loadChartData
    → 의존성: [setupWebSocket]
    → setupWebSocket 사용

5단계: useEffect
    → 의존성: [selectedSymbol, selectedInterval, loadChartData]
    → loadChartData 사용
```

**핵심 원칙:**
- 하위 함수(의존성이 적은 함수)부터 먼저 정의
- 각 함수는 자신이 사용하는 함수를 의존성 배열에 명시
- 체인을 따라 순서대로 정의하면 안정적인 의존성 관리 가능

---

## 4. 함수 정의 순서의 중요성

### 4.1 올바른 순서: 하위 함수부터 정의

```typescript
// ✅ 올바른 순서: 의존성이 없는 함수를 먼저 정의

// 1단계: 의존성 없는 유틸리티 함수
const convertKline = (kline) => { ... };

// 2단계: 의존성 없는 상태 업데이트 함수
const updateData = useCallback((data) => {
  setState(data);
}, []); // 의존성 없음

// 3단계: updateData를 사용하는 함수
const setupWS = useCallback((symbol) => {
  updateData(...); // 위에서 정의된 함수 사용
}, [updateData]); // 의존성 명시

// 4단계: setupWS를 사용하는 함수
const loadData = useCallback(async (symbol) => {
  setupWS(symbol); // 위에서 정의된 함수 사용
}, [setupWS]); // 의존성 명시
```

### 4.2 잘못된 순서: 상위 함수를 먼저 정의

```typescript
// ❌ 잘못된 순서: 의존성이 있는 함수를 먼저 정의

// 4단계를 먼저 정의 (의존성 문제)
const loadData = useCallback(async (symbol) => {
  setupWS(symbol); // setupWS가 아직 정의되지 않음!
}, [setupWS]); // 에러 발생

// 3단계를 나중에 정의
const setupWS = useCallback((symbol) => {
  updateData(...); // updateData가 아직 정의되지 않음!
}, [updateData]); // 에러 발생
```

### 4.3 왜 순서가 중요한가?

1. **호이스팅 한계**: `useCallback`은 호이스팅되지 않음
2. **의존성 체크**: TypeScript와 ESLint가 의존성을 체크할 때 순서가 중요
3. **가독성**: 의존성 체인을 따라 읽으면 이해하기 쉬움
4. **디버깅**: 순서가 맞지 않으면 에러 메시지가 명확하지 않음

#### 호이스팅(Hoisting)이란?

**호이스팅**은 JavaScript에서 변수와 함수 선언이 코드 실행 전에 스코프의 최상단으로 "끌어올려지는" 현상입니다.

##### 함수 선언의 호이스팅

```typescript
// ✅ 함수 선언은 호이스팅됨
console.log(sayHello()); // "Hello" 출력 (에러 없음)

function sayHello() {
  return "Hello";
}

// 실제로는 다음과 같이 동작:
// function sayHello() { ... }  // 호이스팅됨
// console.log(sayHello());     // 실행
```

##### 함수 표현식의 호이스팅

```typescript
// ❌ 함수 표현식은 호이스팅되지 않음
console.log(sayHello()); // TypeError: sayHello is not a function

const sayHello = function() {
  return "Hello";
};

// 실제 동작:
// const sayHello;              // 변수만 호이스팅 (undefined)
// console.log(sayHello());     // undefined() 호출 시도 → 에러
// sayHello = function() { ... }; // 나중에 할당
```

##### useCallback과 호이스팅

```typescript
// ❌ useCallback은 호이스팅되지 않음
useEffect(() => {
  loadData(); // ReferenceError: Cannot access 'loadData' before initialization
}, [loadData]);

const loadData = useCallback(() => {
  // ...
}, []);

// ✅ 올바른 순서: useCallback을 먼저 정의
const loadData = useCallback(() => {
  // ...
}, []);

useEffect(() => {
  loadData(); // 정상 동작
}, [loadData]);
```

##### 호이스팅 vs useCallback 비교

| 구분 | 함수 선언 | 함수 표현식 | useCallback |
| :--- | :--- | :--- | :--- |
| **호이스팅** | ✅ 됨 | ❌ 안 됨 (변수만 호이스팅) | ❌ 안 됨 |
| **선언 전 사용** | ✅ 가능 | ❌ 불가능 | ❌ 불가능 |
| **예시** | `function foo() {}` | `const foo = () => {}` | `const foo = useCallback(() => {}, [])` |

**결론**: `useCallback`은 함수 표현식과 동일하게 호이스팅되지 않으므로, 사용하기 전에 반드시 정의해야 합니다. 따라서 의존성 체인에 따라 하위 함수부터 순서대로 정의하는 것이 중요합니다.

---

## 5. 의존성 배열 관리 원칙

### 5.1 원칙 1: 모든 의존성 명시

```typescript
// ❌ 잘못된 예: 의존성 누락
const setupWebSocket = useCallback((symbol: string) => {
  updateChartDataWithRealtimeKline(kline); // 의존성 누락
}, []); // updateChartDataWithRealtimeKline이 변경되어도 재생성 안 됨

// ✅ 올바른 예: 모든 의존성 명시
const setupWebSocket = useCallback((symbol: string) => {
  updateChartDataWithRealtimeKline(kline);
}, [updateChartDataWithRealtimeKline]); // 의존성 명시
```

### 5.2 원칙 2: 불필요한 의존성 제거

```typescript
// ❌ 잘못된 예: 불필요한 의존성 포함
const updateData = useCallback((data) => {
  setState(data);
}, [someUnusedValue]); // 사용하지 않는 값

// ✅ 올바른 예: 실제 사용하는 의존성만 포함
const updateData = useCallback((data) => {
  setState(data);
}, []); // setState는 안정적이므로 의존성 없음
```

### 5.3 원칙 3: setState는 의존성에 포함하지 않음

```typescript
// ✅ setState는 React가 보장하는 안정적인 함수
const updateData = useCallback((data) => {
  setState(data);
}, []); // setState는 의존성에 포함하지 않음

// ❌ 하지만 setState의 결과를 사용하면 의존성에 포함
const updateData = useCallback((data) => {
  const currentState = getState(); // getState는 의존성에 포함해야 함
  setState({ ...currentState, ...data });
}, [getState]); // getState는 의존성에 포함
```

---

## 6. 실무 팁과 주의사항

### 6.1 언제 useCallback을 사용해야 할까?

#### ✅ 사용해야 하는 경우

1. **의존성 배열에 함수가 포함된 경우**
   ```typescript
   useEffect(() => {
     handleClick();
   }, [handleClick]); // handleClick을 useCallback으로 메모이제이션
   ```

2. **자식 컴포넌트에 함수를 props로 전달하는 경우**
   ```typescript
   const handleClick = useCallback(() => {
     // ...
   }, [dependency]);
   
   return <ChildComponent onClick={handleClick} />;
   ```

3. **복잡한 의존성 체인이 있는 경우**
   ```typescript
   const funcA = useCallback(() => { ... }, []);
   const funcB = useCallback(() => { funcA(); }, [funcA]);
   const funcC = useCallback(() => { funcB(); }, [funcB]);
   ```

#### ❌ 사용하지 않아도 되는 경우

1. **의존성 배열에 함수가 없는 경우**
   ```typescript
   const handleClick = () => {
     console.log('clicked');
   };
   
   useEffect(() => {
     handleClick();
   }, [someValue]); // handleClick이 의존성에 없으므로 useCallback 불필요
   ```

2. **간단한 이벤트 핸들러**
   ```typescript
   // 간단한 경우는 useCallback 없이도 괜찮음
   const handleClick = () => {
     setCount(count + 1);
   };
   ```

### 6.2 ESLint 규칙 활용

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // ...
}, []); // 의도적으로 의존성 제외 (주의해서 사용)
```

**주의사항:**
- ESLint 경고를 무시하기 전에 정말 필요한지 확인
- 대부분의 경우 의존성을 추가하는 것이 올바른 해결책

### 6.3 useRef를 활용한 의존성 문제 해결

```typescript
// useCallback 대신 useRef를 사용하는 경우도 있음
const handlersRef = useRef({
  updateData,
  onError,
});

useEffect(() => {
  handlersRef.current = {
    updateData,
    onError,
  };
}, [updateData, onError]);

// ref를 통해 항상 최신 함수 접근
const setupWS = useCallback(() => {
  wsClient.onMessage = (data) => {
    handlersRef.current.updateData(data); // 최신 함수 사용
  };
}, []); // 의존성 없음
```

### 6.4 성능 측정

```typescript
// useCallback 사용 전후 성능 측정
console.time('render');
// 컴포넌트 렌더링
console.timeEnd('render');

// React DevTools Profiler 활용
// - useCallback 사용 전: 불필요한 재렌더링 발생
// - useCallback 사용 후: 재렌더링 최소화
```

---

## 7. 일반적인 실수와 해결 방법

### 7.1 실수 1: 의존성 배열을 비워두기

```typescript
// ❌ 잘못된 예: 의존성을 사용하지만 배열을 비워둠
const loadData = useCallback(async (symbol: string) => {
  const data = await fetchData(symbol);
  setData(data);
}, []); // symbol을 사용하지만 의존성에 없음

// ✅ 올바른 예: 사용하는 값을 의존성에 포함
const loadData = useCallback(async (symbol: string) => {
  const data = await fetchData(symbol);
  setData(data);
}, [symbol]); // symbol을 의존성에 포함
```

### 7.2 실수 2: 모든 함수를 useCallback으로 감싸기

```typescript
// ❌ 불필요한 useCallback 사용
const handleClick = useCallback(() => {
  console.log('clicked');
}, []); // 의존성 배열에 없고, 자식 컴포넌트에도 전달하지 않음

// ✅ 간단한 경우는 일반 함수로 충분
const handleClick = () => {
  console.log('clicked');
};
```

### 7.3 실수 3: 의존성 체인 순서 무시

```typescript
// ❌ 잘못된 순서
const loadData = useCallback(() => {
  setupWS(); // setupWS가 아직 정의되지 않음
}, [setupWS]);

const setupWS = useCallback(() => {
  // ...
}, []);

// ✅ 올바른 순서
const setupWS = useCallback(() => {
  // ...
}, []);

const loadData = useCallback(() => {
  setupWS(); // setupWS가 이미 정의됨
}, [setupWS]);
```

---

## 8. 프로젝트 적용 사례

### 8.1 ChartClient 컴포넌트

**문제:**
- `loadChartData` 함수가 매번 재생성되어 `useEffect`가 무한 루프 발생
- WebSocket이 불필요하게 재연결됨

**해결:**
- 모든 함수를 `useCallback`으로 메모이제이션
- 의존성 체인을 올바르게 관리
- 함수 정의 순서를 의존성 체인에 맞게 정렬

**결과:**
- 무한 루프 해결
- 불필요한 재렌더링 방지
- WebSocket 연결 안정화

### 8.2 성능 개선 효과

| 항목 | useCallback 사용 전 | useCallback 사용 후 |
| :--- | :--- | :--- |
| useEffect 실행 횟수 | 무한 루프 | 정상 (의존성 변경 시만) |
| 함수 재생성 횟수 | 매 렌더링마다 | 의존성 변경 시만 |
| WebSocket 재연결 | 불필요하게 자주 | 필요 시에만 |
| 렌더링 성능 | 느림 | 빠름 |

---

## 9. 학습 체크리스트

### 기본 개념
- [ ] `useCallback`의 기본 문법과 용도 이해
- [ ] `useCallback` vs `useMemo` 차이점 이해
- [ ] 의존성 배열의 역할 이해

### 실무 적용
- [ ] 언제 `useCallback`을 사용해야 하는지 판단
- [ ] 의존성 체인을 올바르게 관리
- [ ] 함수 정의 순서를 의존성 체인에 맞게 정렬
- [ ] ESLint 경고를 올바르게 해결

### 고급 활용
- [ ] `useRef`와 `useCallback`의 조합 활용
- [ ] 복잡한 의존성 체인 관리
- [ ] 성능 측정 및 최적화

---

## 10. 참고 자료

### 공식 문서
- [React useCallback 공식 문서](https://react.dev/reference/react/useCallback)
- [React Hooks 규칙](https://react.dev/reference/rules/rules-of-hooks)
- [ESLint React Hooks 플러그인](https://www.npmjs.com/package/eslint-plugin-react-hooks)

### 관련 학습 포인트
- [React ref를 사용한 의존성 문제 해결](./learning-points.md#10-react-ref를-사용한-의존성-문제-해결)
- [커스텀 훅을 통한 WebSocket 관리](./learning-points.md#9-커스텀-훅을-통한-websocket-관리)

---

## 11. 요약

### 핵심 원칙

1. **의존성 명시**: `useCallback`의 의존성 배열에 모든 의존성 포함
2. **함수 정의 순서**: 의존성이 없는 함수부터 정의
3. **의존성 체인 관리**: 체인을 따라 순서대로 정의
4. **불필요한 사용 지양**: 필요한 경우에만 `useCallback` 사용

### 실무 팁

- ESLint 규칙을 활용하여 의존성 누락 방지
- `useRef`와 조합하여 복잡한 의존성 문제 해결
- 성능 측정을 통해 실제 효과 확인

### 학습 가치

- **성능 최적화**: 불필요한 함수 재생성 방지
- **무한 루프 방지**: 안정적인 의존성으로 `useEffect` 재실행 최소화
- **코드 안정성**: 의존성 체인을 명확히 관리
- **React Hook 규칙**: ESLint 경고 해결 및 React 모범 사례 준수

이러한 패턴을 이해하고 적용하면, 고성능이고 안정적인 React 애플리케이션을 구축할 수 있습니다.

