# React Hooks 심화 가이드

React Hooks의 고급 사용법과 실무에서 자주 마주치는 문제들을 해결하는 방법을 다룹니다.

---

## 📚 목차

1. [useEffect 의존성 관리](#1-useeffect-의존성-관리)
2. [useRef로 인스턴스/값 보존](#2-useref로-인스턴스값-보존)
3. [커스텀 훅 패턴](#3-커스텀-훅-패턴)
4. [자주 하는 실수와 해결 방법](#4-자주-하는-실수와-해결-방법)
5. [성능 최적화 팁](#5-성능-최적화-팁)
6. [실무 예제](#6-실무-예제)

---

## 1. useEffect 의존성 관리

### 1.1 의존성 배열의 중요성

`useEffect`의 의존성 배열은 React가 언제 effect를 다시 실행할지 결정합니다.

```typescript
// ✅ 올바른 사용
useEffect(() => {
  fetchData(userId);
}, [userId]); // userId가 변경될 때만 실행

// ❌ 잘못된 사용
useEffect(() => {
  fetchData(userId);
}, []); // ESLint 경고: 의존성 누락
```

### 1.2 의존성 배열 규칙

#### 규칙 1: 모든 외부 값을 의존성에 포함

```typescript
function Component({ userId, onSuccess }) {
  useEffect(() => {
    // userId와 onSuccess를 사용하므로 의존성에 포함해야 함
    fetchUser(userId).then(onSuccess);
  }, [userId, onSuccess]); // ✅ 모든 의존성 포함
}
```

#### 규칙 2: 함수는 useCallback으로 메모이제이션

```typescript
// ❌ 문제: 매 렌더링마다 새로운 함수 생성
function Component({ userId }) {
  const handleSuccess = (data) => {
    console.log(data);
  };

  useEffect(() => {
    fetchUser(userId).then(handleSuccess);
  }, [userId, handleSuccess]); // handleSuccess가 매번 변경됨
}

// ✅ 해결: useCallback 사용
function Component({ userId }) {
  const handleSuccess = useCallback((data) => {
    console.log(data);
  }, []); // 의존성이 없으면 빈 배열

  useEffect(() => {
    fetchUser(userId).then(handleSuccess);
  }, [userId, handleSuccess]); // 이제 안정적
}
```

### 1.3 의존성 문제 해결 패턴

#### 패턴 1: useRef로 최신 값 참조

```typescript
function Component({ onUpdate }) {
  // ref에 최신 함수 저장
  const onUpdateRef = useRef(onUpdate);
  
  // ref 업데이트 (의존성은 있지만 effect 재실행 없음)
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // ref를 통해 항상 최신 함수 호출
    const timer = setInterval(() => {
      onUpdateRef.current();
    }, 1000);

    return () => clearInterval(timer);
  }, []); // 빈 배열 가능!
}
```

#### 패턴 2: 함수를 effect 내부로 이동

```typescript
// ❌ 문제
function Component({ userId }) {
  const fetchUser = async () => {
    const data = await api.getUser(userId);
    setUser(data);
  };

  useEffect(() => {
    fetchUser();
  }, [userId, fetchUser]); // fetchUser가 매번 변경
}

// ✅ 해결: 함수를 effect 내부로
function Component({ userId }) {
  useEffect(() => {
    const fetchUser = async () => {
      const data = await api.getUser(userId);
      setUser(data);
    };
    
    fetchUser();
  }, [userId]); // userId만 의존성
}
```

---

## 2. useRef로 인스턴스/값 보존

### 2.1 useRef의 특징

`useRef`는 컴포넌트가 리렌더링되어도 값을 유지하며, 값 변경 시 리렌더링을 트리거하지 않습니다.

```typescript
function Component() {
  const countRef = useRef(0);
  const [count, setCount] = useState(0);

  const incrementRef = () => {
    countRef.current += 1;
    console.log('Ref:', countRef.current); // 값은 변경되지만 리렌더링 없음
  };

  const incrementState = () => {
    setCount(count + 1); // 리렌더링 발생
  };

  return (
    <div>
      <p>Ref: {countRef.current}</p> {/* 항상 0으로 표시 (리렌더링 안 됨) */}
      <p>State: {count}</p> {/* 정상적으로 업데이트 */}
      <button onClick={incrementRef}>Increment Ref</button>
      <button onClick={incrementState}>Increment State</button>
    </div>
  );
}
```

### 2.2 useRef 사용 사례

#### 사례 1: DOM 요소 참조

```typescript
function InputComponent() {
  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={focusInput}>Focus Input</button>
    </div>
  );
}
```

#### 사례 2: 이전 값 저장

```typescript
function Component({ value }) {
  const prevValueRef = useRef<number>();

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const prevValue = prevValueRef.current;
  
  return (
    <div>
      <p>현재: {value}</p>
      <p>이전: {prevValue ?? '없음'}</p>
    </div>
  );
}
```

#### 사례 3: 외부 라이브러리 인스턴스 저장

```typescript
function ChartComponent({ data }) {
  const chartRef = useRef<Chart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 차트 인스턴스 생성 (한 번만)
    chartRef.current = new Chart(containerRef.current, {
      // 설정
    });

    return () => {
      // 클린업
      chartRef.current?.destroy();
    };
  }, []); // 빈 배열: 마운트 시 한 번만 실행

  useEffect(() => {
    // 데이터만 업데이트 (인스턴스 재생성 없음)
    chartRef.current?.update(data);
  }, [data]);

  return <div ref={containerRef} />;
}
```

#### 사례 4: 최신 함수 참조 유지 (의존성 문제 해결)

```typescript
function WebSocketComponent({ onMessage, onError }) {
  const wsRef = useRef<WebSocket | null>(null);
  
  // 핸들러를 ref로 저장
  const handlersRef = useRef({ onMessage, onError });
  
  // ref 업데이트 (의존성은 있지만 effect 재실행 없음)
  useEffect(() => {
    handlersRef.current = { onMessage, onError };
  }, [onMessage, onError]);

  useEffect(() => {
    // WebSocket 연결 (한 번만)
    wsRef.current = new WebSocket('wss://example.com');
    
    wsRef.current.onmessage = (event) => {
      // ref를 통해 항상 최신 함수 호출
      handlersRef.current.onMessage(event.data);
    };
    
    wsRef.current.onerror = (error) => {
      handlersRef.current.onError(error);
    };

    return () => {
      wsRef.current?.close();
    };
  }, []); // 빈 배열 가능!

  return <div>WebSocket Component</div>;
}
```

### 2.3 useRef vs useState 비교

| 특징 | useRef | useState |
| :--- | :--- | :--- |
| **리렌더링** | 없음 | 있음 |
| **값 변경 감지** | 없음 | 있음 |
| **최신 값 보장** | 항상 | 항상 |
| **동기 업데이트** | 즉시 | 비동기 (배치) |
| **용도** | DOM 참조, 인스턴스 저장, 이전 값 | UI 상태 관리 |

### 2.4 언제 useRef를 사용해야 할까?

✅ **useRef를 사용해야 하는 경우:**
- DOM 요소에 직접 접근이 필요할 때
- 외부 라이브러리 인스턴스를 저장할 때
- 이전 값을 저장해야 할 때
- 타이머 ID, 애니메이션 ID 등을 저장할 때
- useEffect 의존성 문제를 해결할 때

❌ **useState를 사용해야 하는 경우:**
- UI에 표시되는 값
- 값 변경 시 리렌더링이 필요한 경우
- 컴포넌트 간 상태 공유가 필요한 경우

---

## 3. 커스텀 훅 패턴

### 3.1 커스텀 훅이란?

로직을 재사용 가능한 함수로 추출한 것입니다. `use`로 시작하는 함수입니다.

```typescript
// 커스텀 훅
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount((prev) => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, reset };
}

// 사용
function Component() {
  const { count, increment, decrement, reset } = useCounter(10);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

### 3.2 커스텀 훅 설계 원칙

#### 원칙 1: 단일 책임

```typescript
// ❌ 나쁜 예: 여러 책임을 가진 훅
function useUserAndPosts(userId) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  // ...
}

// ✅ 좋은 예: 각각 단일 책임
function useUser(userId) {
  // 사용자 데이터만 관리
}

function usePosts(userId) {
  // 포스트 데이터만 관리
}
```

#### 원칙 2: 관심사 분리

```typescript
// WebSocket 로직을 컴포넌트에서 분리
function useWebSocket(url, options) {
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // WebSocket 연결 로직
  }, [url]);

  return { status, send: (data) => wsRef.current?.send(data) };
}

// 컴포넌트는 UI에만 집중
function ChatComponent() {
  const { status, send } = useWebSocket('wss://chat.example.com');
  
  return <div>Status: {status}</div>;
}
```

#### 원칙 3: 명확한 API 제공

```typescript
function useBinanceWebSocket(options: UseBinanceWebSocketOptions = {}) {
  // 내부 구현은 복잡해도
  // 외부 API는 간단하고 명확하게
  return {
    status,        // 현재 상태
    connect,       // 연결 함수
    disconnect,    // 연결 해제 함수
    getStatus,     // 상태 조회 함수
  };
}
```

### 3.3 실무 커스텀 훅 예제

#### 예제 1: API 데이터 페칭 훅

```typescript
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const result = await response.json();
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
```

#### 예제 2: 로컬 스토리지 훅

```typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function 
        ? value(storedValue) 
        : value;
      
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}
```

#### 예제 3: 디바운스 훅

```typescript
function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 사용 예시
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      // 검색 API 호출
      searchAPI(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
}
```

---

## 4. 자주 하는 실수와 해결 방법

### 4.1 실수 1: 의존성 배열 누락

```typescript
// ❌ 실수
function Component({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []); // userId가 변경되어도 실행 안 됨
}

// ✅ 해결
function Component({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, [userId]); // userId 변경 시 실행
}
```

### 4.2 실수 2: 무한 루프

```typescript
// ❌ 실수: 객체를 의존성에 포함
function Component() {
  const [user, setUser] = useState({ id: 1, name: 'John' });

  useEffect(() => {
    // user 객체가 매번 새로 생성되어 무한 루프
    updateUser(user);
  }, [user]); // user는 매번 새로운 참조
}

// ✅ 해결 1: 필요한 값만 의존성에 포함
function Component() {
  const [user, setUser] = useState({ id: 1, name: 'John' });

  useEffect(() => {
    updateUser(user);
  }, [user.id, user.name]); // 원시값만 포함
}

// ✅ 해결 2: useMemo로 객체 메모이제이션
function Component() {
  const [user, setUser] = useState({ id: 1, name: 'John' });
  const memoizedUser = useMemo(() => user, [user.id, user.name]);

  useEffect(() => {
    updateUser(memoizedUser);
  }, [memoizedUser]);
}
```

### 4.3 실수 3: 클린업 함수 누락

```typescript
// ❌ 실수: 타이머나 구독을 정리하지 않음
function Component() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Tick');
    }, 1000);
    // 클린업 없음 → 메모리 누수
  }, []);
}

// ✅ 해결: 클린업 함수 제공
function Component() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Tick');
    }, 1000);

    return () => {
      clearInterval(timer); // 클린업
    };
  }, []);
}
```

### 4.4 실수 4: 비동기 함수 처리

```typescript
// ❌ 실수: 비동기 함수를 직접 사용
function Component({ userId }) {
  useEffect(() => {
    const data = await fetchUser(userId); // 에러!
    setUser(data);
  }, [userId]);
}

// ✅ 해결: 비동기 함수를 내부에서 정의
function Component({ userId }) {
  useEffect(() => {
    async function loadUser() {
      const data = await fetchUser(userId);
      setUser(data);
    }
    
    loadUser();
  }, [userId]);
}

// ✅ 또는 즉시 실행 함수 사용
function Component({ userId }) {
  useEffect(() => {
    (async () => {
      const data = await fetchUser(userId);
      setUser(data);
    })();
  }, [userId]);
}
```

### 4.5 실수 5: 조건부 훅 사용

```typescript
// ❌ 실수: 조건부로 훅 호출
function Component({ condition }) {
  if (condition) {
    const [state, setState] = useState(0); // 에러!
  }
}

// ✅ 해결: 항상 같은 순서로 훅 호출
function Component({ condition }) {
  const [state, setState] = useState(0);
  
  useEffect(() => {
    if (condition) {
      // 조건부 로직
    }
  }, [condition]);
}
```

---

## 5. 성능 최적화 팁

### 5.1 useMemo로 값 메모이제이션

```typescript
function Component({ items, filter }) {
  // ❌ 매 렌더링마다 재계산
  const filteredItems = items.filter(item => item.category === filter);

  // ✅ useMemo로 메모이제이션
  const filteredItems = useMemo(() => {
    return items.filter(item => item.category === filter);
  }, [items, filter]);

  return <div>{/* ... */}</div>;
}
```

### 5.2 useCallback으로 함수 메모이제이션

```typescript
function Component({ onSave }) {
  // ❌ 매 렌더링마다 새로운 함수 생성
  const handleClick = () => {
    onSave(data);
  };

  // ✅ useCallback으로 메모이제이션
  const handleClick = useCallback(() => {
    onSave(data);
  }, [onSave, data]);

  return <button onClick={handleClick}>Save</button>;
}
```

### 5.3 React.memo로 컴포넌트 메모이제이션

```typescript
// ❌ 매번 리렌더링
function ChildComponent({ name, age }) {
  return <div>{name} is {age} years old</div>;
}

// ✅ props가 변경될 때만 리렌더링
const ChildComponent = React.memo(function ChildComponent({ name, age }) {
  return <div>{name} is {age} years old</div>;
});
```

### 5.4 불필요한 effect 분리

```typescript
// ❌ 하나의 effect에 모든 로직
function Component({ userId, theme }) {
  useEffect(() => {
    fetchUser(userId);
    document.body.className = theme;
  }, [userId, theme]); // 둘 중 하나만 변경되어도 둘 다 실행
}

// ✅ 관심사별로 분리
function Component({ userId, theme }) {
  useEffect(() => {
    fetchUser(userId);
  }, [userId]); // userId 변경 시만

  useEffect(() => {
    document.body.className = theme;
  }, [theme]); // theme 변경 시만
}
```

---

## 6. 실무 예제

### 예제 1: WebSocket 커스텀 훅 (프로젝트 실제 코드)

```typescript
export function useBinanceWebSocket(options: UseBinanceWebSocketOptions = {}) {
  const { symbols = [], onStatusChange, onError, autoConnect = true } = options;
  const { updateTicker } = useTickerStore();
  const clientRef = useRef<BinanceWebSocketClient | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // 핸들러를 ref로 저장하여 의존성 문제 해결
  const handlersRef = useRef({ updateTicker, onStatusChange, onError });

  // ref 업데이트
  useEffect(() => {
    handlersRef.current = { updateTicker, onStatusChange, onError };
  }, [updateTicker, onStatusChange, onError]);

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

**핵심 포인트:**
- `useRef`로 클라이언트 인스턴스 저장 (재생성 방지)
- `handlersRef`로 최신 함수 참조 유지 (의존성 문제 해결)
- `useEffect`로 생명주기 관리 (자동 연결/해제)
- 관심사 분리 (WebSocket 로직을 컴포넌트에서 분리)

---

## 📝 체크리스트

커스텀 훅을 만들 때 다음을 확인하세요:

- [ ] 모든 의존성을 의존성 배열에 포함했는가?
- [ ] 클린업 함수를 제공했는가?
- [ ] 불필요한 재실행을 방지했는가?
- [ ] useRef를 적절히 활용했는가?
- [ ] useCallback/useMemo로 최적화했는가?
- [ ] 타입 안정성을 확보했는가?

---

## 🎯 핵심 요약

1. **의존성 배열**: 모든 외부 값을 포함하되, ref를 활용하여 최적화
2. **useRef**: 리렌더링 없이 값을 저장하고, 최신 함수 참조 유지
3. **커스텀 훅**: 로직을 재사용 가능한 함수로 추출하여 관심사 분리
4. **성능 최적화**: useMemo, useCallback, React.memo 적절히 활용
5. **클린업**: 타이머, 구독, 연결 등을 반드시 정리

이러한 패턴들을 이해하고 적용하면, 안정적이고 성능이 좋은 React 애플리케이션을 구축할 수 있습니다.

