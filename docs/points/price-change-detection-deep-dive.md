# 가격 변경 감지 및 애니메이션 스로틀링 심화 가이드

실시간 데이터 변경을 감지하고 시각적 피드백을 제공하는 고급 패턴을 다룹니다.

---

## 📚 목차

1. [가격 변경 감지 패턴](#1-가격-변경-감지-패턴)
2. [애니메이션 스로틀링](#2-애니메이션-스로틀링)
3. [requestAnimationFrame과 setTimeout의 조합](#3-requestanimationframe과-settimeout의-조합)
4. [Set과 Map을 활용한 복합 상태 관리](#4-set과-map을-활용한-복합-상태-관리)
5. [실무 활용 사례](#5-실무-활용-사례)
6. [성능 최적화 팁](#6-성능-최적화-팁)
7. [자주 하는 실수와 해결 방법](#7-자주-하는-실수와-해결-방법)
8. [실무 예제](#8-실무-예제)

---

## 1. 가격 변경 감지 패턴

### 1.1 문제 상황

실시간 데이터가 업데이트될 때, 변경 사항을 감지하여 시각적 피드백을 제공해야 합니다. 하지만 다음과 같은 문제가 있습니다:

```typescript
// ❌ 문제: 매번 리렌더링 발생
function Component() {
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState(100);

  useEffect(() => {
    if (previousPrice !== null && previousPrice !== currentPrice) {
      // 가격 변경 감지
      showHighlight();
    }
    setPreviousPrice(currentPrice); // 리렌더링 발생!
  }, [currentPrice, previousPrice]);
}
```

**문제점:**
- `useState`로 이전 값을 저장하면 값 변경 시 리렌더링 발생
- 불필요한 리렌더링으로 성능 저하
- 여러 항목을 관리하기 어려움

### 1.2 해결: useRef를 사용한 이전 값 추적

`useRef`는 값 변경 시 리렌더링을 트리거하지 않으므로, 이전 값을 추적하는 데 적합합니다.

```typescript
// ✅ 해결: useRef로 이전 값 추적
function Component() {
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const [currentPrice, setCurrentPrice] = useState(100);

  useEffect(() => {
    const previousPrice = previousPricesRef.current.get('BTCUSDT');
    
    if (previousPrice !== undefined && previousPrice !== currentPrice) {
      // 가격 변경 감지 (리렌더링 없음!)
      showHighlight();
    }
    
    // 현재 가격을 이전 가격으로 저장 (리렌더링 없음!)
    previousPricesRef.current.set('BTCUSDT', currentPrice);
  }, [currentPrice]);
}
```

**장점:**
- 리렌더링 없이 이전 값 추적 가능
- Map을 사용하여 여러 항목의 이전 값 관리
- 메모리 효율적

### 1.3 프로젝트 적용 예제

```typescript
// components/CoinListClient.tsx
const previousPricesRef = useRef<Map<string, number>>(new Map());

useEffect(() => {
  const tickerArray = Array.from(tickers.values());
  
  tickerArray.forEach((ticker) => {
    const previousPrice = previousPricesRef.current.get(ticker.symbol);
    
    // 가격이 변경되었는지 확인
    if (previousPrice !== undefined && previousPrice !== ticker.price) {
      // 가격 변경 감지!
      const direction = ticker.price > previousPrice ? 'up' : 'down';
      triggerHighlight(ticker.symbol, direction);
    }
    
    // 현재 가격을 이전 가격으로 저장
    previousPricesRef.current.set(ticker.symbol, ticker.price);
  });
}, [tickers]);
```

### 1.4 useRef vs useState 비교

| 특징 | useRef | useState |
| :--- | :--- | :--- |
| 리렌더링 | 없음 | 있음 |
| 값 변경 감지 | 없음 | 있음 |
| 이전 값 추적 | ✅ 적합 | ❌ 부적합 |
| 여러 값 관리 | Map 사용 가능 | 복잡함 |
| 성능 | 우수 | 상대적으로 느림 |

### 1.5 언제 useRef를 사용해야 할까?

✅ **useRef를 사용해야 하는 경우:**
- 이전 값과 비교가 필요할 때
- 리렌더링 없이 값을 저장해야 할 때
- 여러 항목의 이전 값을 관리해야 할 때
- 타이머 ID, 애니메이션 ID 등을 저장할 때

❌ **useState를 사용해야 하는 경우:**
- UI에 표시되는 값
- 값 변경 시 리렌더링이 필요한 경우
- 컴포넌트 간 상태 공유가 필요한 경우

---

## 2.  

### 2.1 문제 상황

고빈도 데이터 업데이트에서 매번 애니메이션을 트리거하면 다음과 같은 문제가 발생합니다:

```typescript
// ❌ 문제: 과도한 애니메이션
useEffect(() => {
  tickers.forEach((ticker) => {
    if (previousPrice !== ticker.price) {
      // 매번 하이라이트 트리거 → 화면 깜빡임
      triggerHighlight(ticker.symbol);
    }
  });
}, [tickers]); // 초당 수십 번 실행 가능
```

**문제점:**
- 초당 수십~수백 번 애니메이션 트리거
- 화면이 계속 깜빡여 사용자 경험 저하
- CPU 사용량 증가
- 배터리 소모 증가

### 2.2 해결: 시간 기반 스로틀링

특정 시간 간격(예: 100ms) 내에는 애니메이션을 한 번만 트리거하도록 제한합니다.

```typescript
// ✅ 해결: 시간 기반 스로틀링
const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());

useEffect(() => {
  const now = Date.now();
  
  tickers.forEach((ticker) => {
    const lastHighlightTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
    const timeSinceLastHighlight = now - lastHighlightTime;
    
    // 100ms 이상 경과한 경우에만 하이라이트
    if (timeSinceLastHighlight >= 100) {
      triggerHighlight(ticker.symbol);
      lastHighlightTimeRef.current.set(ticker.symbol, now);
    }
  });
}, [tickers]);
```

**장점:**
- 과도한 애니메이션 방지
- 각 항목별로 독립적인 스로틀링 관리
- 사용자 경험 개선

### 2.3 스로틀링 간격 선택

| 간격 | 사용 시기 | 장단점 |
| :--- | :--- | :--- |
| **50ms** | 매우 빠른 업데이트 | 빠른 반응, 하지만 여전히 깜빡일 수 있음 |
| **100ms** | 일반적인 실시간 데이터 | ✅ 권장: 균형잡힌 반응성과 안정성 |
| **200ms** | 느린 업데이트 | 안정적이지만 반응성이 떨어짐 |
| **500ms** | 매우 느린 업데이트 | 거의 깜빡임 없지만 반응성 매우 낮음 |

### 2.4 프로젝트 적용 예제

```typescript
// components/CoinListClient.tsx
const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());

useEffect(() => {
  const tickerArray = Array.from(tickers.values());
  const now = Date.now();
  
  tickerArray.forEach((ticker) => {
    const previousPrice = previousPricesRef.current.get(ticker.symbol);
    const lastHighlightTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
    const timeSinceLastHighlight = now - lastHighlightTime;
    
    // 가격이 변경되었고, 100ms 이상 경과한 경우에만 하이라이트
    if (previousPrice !== undefined && previousPrice !== ticker.price) {
      if (timeSinceLastHighlight >= 100) {
        const direction = ticker.price > previousPrice ? 'up' : 'down';
        triggerHighlight(ticker.symbol, direction);
        lastHighlightTimeRef.current.set(ticker.symbol, now);
      }
    }
  });
}, [tickers]);
```

### 2.5 스로틀링 vs 디바운싱

| 패턴 | 동작 | 사용 시기 |
| :--- | :--- | :--- |
| **스로틀링** | 일정 간격마다 실행 | 애니메이션, 스크롤 이벤트 |
| **디바운싱** | 마지막 이벤트 후 일정 시간 대기 | 검색 입력, API 호출 |

```typescript
// 스로틀링: 100ms마다 최대 1번 실행
if (timeSinceLastExecution >= 100) {
  execute();
}

// 디바운싱: 마지막 이벤트 후 300ms 대기
clearTimeout(timer);
timer = setTimeout(() => {
  execute();
}, 300);
```

---

## 3. requestAnimationFrame과 setTimeout의 조합

### 3.1 각 API의 역할

#### requestAnimationFrame
- **목적**: 브라우저 렌더링 사이클과 동기화
- **실행 시점**: 다음 프레임 시작 전
- **용도**: DOM 변경, 애니메이션 업데이트

#### setTimeout
- **목적**: 일정 시간 후 실행
- **실행 시점**: 지정된 시간 후
- **용도**: 지연 실행, 자동 제거

### 3.2 조합 패턴

두 API를 조합하여 성능 최적화와 자동 제거를 동시에 구현합니다.

```typescript
// ✅ 조합 패턴
const rafIdRef = useRef<number | null>(null);

useEffect(() => {
  // requestAnimationFrame: 배치 처리 및 성능 최적화
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      // 가격 변경 감지 및 하이라이트 처리
      const now = Date.now();
      tickers.forEach((ticker) => {
        if (shouldHighlight(ticker)) {
          triggerHighlight(ticker.symbol);
          
          // setTimeout: 300ms 후 자동 제거
          setTimeout(() => {
            removeHighlight(ticker.symbol);
          }, 300);
        }
      });
      
      rafIdRef.current = null;
    });
  }
  
  return () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
  };
}, [tickers]);
```

### 3.3 왜 조합하는가?

#### requestAnimationFrame만 사용하는 경우

```typescript
// ❌ 문제: 자동 제거가 어려움
requestAnimationFrame(() => {
  triggerHighlight();
  // 언제 제거할까? 다음 프레임? 몇 프레임 후?
});
```

#### setTimeout만 사용하는 경우

```typescript
// ❌ 문제: 브라우저 렌더링과 동기화되지 않음
setTimeout(() => {
  triggerHighlight();
  setTimeout(() => {
    removeHighlight();
  }, 300);
}, 0); // 정확한 타이밍 보장 안 됨
```

#### 조합 사용

```typescript
// ✅ 해결: 두 API의 장점 결합
requestAnimationFrame(() => {
  // 브라우저 렌더링과 동기화된 처리
  triggerHighlight();
  
  setTimeout(() => {
    // 정확한 시간 후 자동 제거
    removeHighlight();
  }, 300);
});
```

### 3.4 프로젝트 적용 예제

```typescript
// components/CoinListClient.tsx
const rafIdRef = useRef<number | null>(null);

useEffect(() => {
  const tickerArray = Array.from(tickers.values());
  
  // requestAnimationFrame: 배치 처리
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      const newHighlightedSymbols = new Set<string>();
      
      tickerArray.forEach((ticker) => {
        if (shouldHighlight(ticker, now)) {
          newHighlightedSymbols.add(ticker.symbol);
          
          // setTimeout: 300ms 후 자동 제거
          setTimeout(() => {
            setHighlightedSymbols((prev) => {
              const next = new Set(prev);
              next.delete(ticker.symbol);
              return next;
            });
          }, 300);
        }
      });
      
      // 상태 업데이트
      if (newHighlightedSymbols.size > 0) {
        setHighlightedSymbols((prev) => {
          const merged = new Set(prev);
          newHighlightedSymbols.forEach((symbol) => merged.add(symbol));
          return merged;
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

---

## 4. Set과 Map을 활용한 복합 상태 관리

### 4.1 문제 상황

하이라이트 상태를 관리할 때 다음과 같은 접근 방법들이 있습니다:

```typescript
// ❌ 방법 1: 배열 사용 (비효율적)
const [highlightedSymbols, setHighlightedSymbols] = useState<string[]>([]);

// 문제점:
// - includes() 조회: O(n)
// - 중복 체크 필요
// - 삭제 시 filter() 사용: O(n)

// ❌ 방법 2: 단일 객체 사용 (복잡함)
const [highlightState, setHighlightState] = useState<{
  symbols: string[];
  directions: Record<string, 'up' | 'down'>;
}>({ symbols: [], directions: {} });

// 문제점:
// - 상태 업데이트 복잡
// - 동기화 어려움
```

### 4.2 해결: Set과 Map 분리 사용

Set과 Map을 각각의 목적에 맞게 사용합니다.

```typescript
// ✅ 해결: Set과 Map 분리 사용
// Set: 하이라이트된 심볼 목록 (빠른 조회)
const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());

// Map: 각 심볼의 방향 정보 (키-값 쌍)
const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
```

**장점:**
- Set: O(1) 조회 성능, 중복 자동 제거
- Map: 키-값 쌍 관리, 빠른 조회
- 상태 분리로 관리 용이

### 4.3 Set과 Map의 특징

#### Set
- **용도**: 중복 없는 값 집합
- **조회**: `has()` - O(1)
- **추가**: `add()` - O(1)
- **삭제**: `delete()` - O(1)
- **크기**: `size` 속성

```typescript
const symbols = new Set<string>();

// 추가
symbols.add('BTCUSDT');
symbols.add('ETHUSDT');

// 조회
if (symbols.has('BTCUSDT')) {
  // 하이라이트됨
}

// 삭제
symbols.delete('BTCUSDT');

// 크기
console.log(symbols.size); // 1
```

#### Map
- **용도**: 키-값 쌍 저장
- **조회**: `get()` - O(1)
- **추가/수정**: `set()` - O(1)
- **삭제**: `delete()` - O(1)
- **순회**: `forEach()`, `for...of`

```typescript
const directions = new Map<string, 'up' | 'down'>();

// 추가/수정
directions.set('BTCUSDT', 'up');
directions.set('ETHUSDT', 'down');

// 조회
const direction = directions.get('BTCUSDT'); // 'up'

// 삭제
directions.delete('BTCUSDT');

// 순회
directions.forEach((direction, symbol) => {
  console.log(`${symbol}: ${direction}`);
});
```

### 4.4 프로젝트 적용 예제

```typescript
// components/CoinListClient.tsx
// Set: 하이라이트된 심볼 목록
const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());

// Map: 각 심볼의 방향 정보
const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());

useEffect(() => {
  const newHighlightedSymbols = new Set<string>();
  const newDirections = new Map<string, PriceChangeDirection>();
  
  tickers.forEach((ticker) => {
    if (shouldHighlight(ticker)) {
      const direction = ticker.price > previousPrice ? 'up' : 'down';
      
      // Set에 추가
      newHighlightedSymbols.add(ticker.symbol);
      
      // Map에 방향 저장
      newDirections.set(ticker.symbol, direction);
    }
  });
  
  // Set 상태 업데이트
  if (newHighlightedSymbols.size > 0) {
    setHighlightedSymbols((prev) => {
      const merged = new Set(prev);
      newHighlightedSymbols.forEach((symbol) => merged.add(symbol));
      return merged;
    });
  }
  
  // Map 업데이트
  newDirections.forEach((direction, symbol) => {
    highlightDirectionsRef.current.set(symbol, direction);
  });
}, [tickers]);

// 렌더링 시 사용
{Array.from(tickers.values()).map((ticker) => {
  const isHighlighted = highlightedSymbols.has(ticker.symbol);
  const direction = highlightDirectionsRef.current.get(ticker.symbol);
  
  return (
    <tr className={isHighlighted ? `highlight-${direction}` : ''}>
      {/* ... */}
    </tr>
  );
})}
```

### 4.5 Set vs Array vs Map 비교

| 자료구조 | 조회 | 추가 | 삭제 | 중복 | 키-값 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Set** | O(1) | O(1) | O(1) | 자동 제거 | ❌ |
| **Array** | O(n) | O(1) | O(n) | 허용 | ❌ |
| **Map** | O(1) | O(1) | O(1) | 키 중복 불가 | ✅ |

---

## 5. 실무 활용 사례

### 5.1 실시간 주식/암호화폐 가격 업데이트

```typescript
function StockPriceList({ stocks }: { stocks: Stock[] }) {
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const [highlightedStocks, setHighlightedStocks] = useState<Set<string>>(new Set());
  const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const now = Date.now();
      const newHighlights = new Set<string>();
      
      stocks.forEach((stock) => {
        const previousPrice = previousPricesRef.current.get(stock.symbol);
        const lastTime = lastHighlightTimeRef.current.get(stock.symbol) || 0;
        
        if (previousPrice !== undefined && previousPrice !== stock.price) {
          if (now - lastTime >= 100) {
            newHighlights.add(stock.symbol);
            lastHighlightTimeRef.current.set(stock.symbol, now);
            
            setTimeout(() => {
              setHighlightedStocks((prev) => {
                const next = new Set(prev);
                next.delete(stock.symbol);
                return next;
              });
            }, 300);
          }
        }
        
        previousPricesRef.current.set(stock.symbol, stock.price);
      });
      
      if (newHighlights.size > 0) {
        setHighlightedStocks((prev) => {
          const merged = new Set(prev);
          newHighlights.forEach((symbol) => merged.add(symbol));
          return merged;
        });
      }
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [stocks]);
  
  return (
    <div>
      {stocks.map((stock) => (
        <div
          key={stock.symbol}
          className={highlightedStocks.has(stock.symbol) ? 'highlight' : ''}
        >
          {stock.symbol}: ${stock.price}
        </div>
      ))}
    </div>
  );
}
```

### 5.2 게임 점수 업데이트

```typescript
function ScoreBoard({ scores }: { scores: Score[] }) {
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  const [animatedScores, setAnimatedScores] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const newAnimations = new Set<string>();
      
      scores.forEach((score) => {
        const previous = previousScoresRef.current.get(score.playerId);
        
        if (previous !== undefined && previous !== score.points) {
          newAnimations.add(score.playerId);
          
          setTimeout(() => {
            setAnimatedScores((prev) => {
              const next = new Set(prev);
              next.delete(score.playerId);
              return next;
            });
          }, 500);
        }
        
        previousScoresRef.current.set(score.playerId, score.points);
      });
      
      if (newAnimations.size > 0) {
        setAnimatedScores((prev) => {
          const merged = new Set(prev);
          newAnimations.forEach((id) => merged.add(id));
          return merged;
        });
      }
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [scores]);
  
  return (
    <div>
      {scores.map((score) => (
        <div
          key={score.playerId}
          className={animatedScores.has(score.playerId) ? 'score-updated' : ''}
        >
          {score.playerName}: {score.points}
        </div>
      ))}
    </div>
  );
}
```

### 5.3 대시보드 지표 업데이트

```typescript
function MetricsDashboard({ metrics }: { metrics: Metric[] }) {
  const previousValuesRef = useRef<Map<string, number>>(new Map());
  const [highlightedMetrics, setHighlightedMetrics] = useState<Set<string>>(new Set());
  const directionsRef = useRef<Map<string, 'up' | 'down'>>(new Map());
  
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const newHighlights = new Set<string>();
      const newDirections = new Map<string, 'up' | 'down'>();
      
      metrics.forEach((metric) => {
        const previous = previousValuesRef.current.get(metric.id);
        
        if (previous !== undefined && previous !== metric.value) {
          const direction = metric.value > previous ? 'up' : 'down';
          newHighlights.add(metric.id);
          newDirections.set(metric.id, direction);
          
          setTimeout(() => {
            setHighlightedMetrics((prev) => {
              const next = new Set(prev);
              next.delete(metric.id);
              return next;
            });
            directionsRef.current.delete(metric.id);
          }, 300);
        }
        
        previousValuesRef.current.set(metric.id, metric.value);
      });
      
      if (newHighlights.size > 0) {
        setHighlightedMetrics((prev) => {
          const merged = new Set(prev);
          newHighlights.forEach((id) => merged.add(id));
          return merged;
        });
        newDirections.forEach((direction, id) => {
          directionsRef.current.set(id, direction);
        });
      }
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [metrics]);
  
  return (
    <div className="metrics-grid">
      {metrics.map((metric) => {
        const isHighlighted = highlightedMetrics.has(metric.id);
        const direction = directionsRef.current.get(metric.id);
        
        return (
          <div
            key={metric.id}
            className={`metric-card ${isHighlighted ? `highlight-${direction}` : ''}`}
          >
            <h3>{metric.name}</h3>
            <p className="value">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}
```

---

## 6. 성능 최적화 팁

### 6.1 requestAnimationFrame 중복 방지

```typescript
// ✅ 올바른 방법: 중복 방지
const rafIdRef = useRef<number | null>(null);

useEffect(() => {
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      // 처리 로직
      rafIdRef.current = null;
    });
  }
}, [dependencies]);

// ❌ 잘못된 방법: 중복 스케줄링
useEffect(() => {
  requestAnimationFrame(() => {
    // 처리 로직
  });
}, [dependencies]); // 매번 새로운 RAF 요청
```

### 6.2 메모리 누수 방지

```typescript
// ✅ 올바른 방법: 클린업
useEffect(() => {
  const rafId = requestAnimationFrame(() => {
    // 처리 로직
  });
  
  return () => {
    cancelAnimationFrame(rafId);
  };
}, [dependencies]);

// ❌ 잘못된 방법: 클린업 없음
useEffect(() => {
  requestAnimationFrame(() => {
    // 처리 로직
  });
  // 클린업 없음 → 메모리 누수 가능
}, [dependencies]);
```

### 6.3 setTimeout 클린업

```typescript
// ✅ 올바른 방법: 타이머 ID 저장 및 클린업
useEffect(() => {
  const timerIds: NodeJS.Timeout[] = [];
  
  items.forEach((item) => {
    const timerId = setTimeout(() => {
      removeHighlight(item.id);
    }, 300);
    timerIds.push(timerId);
  });
  
  return () => {
    timerIds.forEach((id) => clearTimeout(id));
  };
}, [items]);

// ❌ 잘못된 방법: 클린업 없음
useEffect(() => {
  items.forEach((item) => {
    setTimeout(() => {
      removeHighlight(item.id);
    }, 300);
    // 클린업 없음 → 컴포넌트 언마운트 후에도 실행 가능
  });
}, [items]);
```

### 6.4 Map/Set 초기화

```typescript
// ✅ 올바른 방법: 컴포넌트 재마운트 시 초기화
useEffect(() => {
  // 초기화
  previousPricesRef.current = new Map();
  lastHighlightTimeRef.current = new Map();
  
  return () => {
    // 클린업
    previousPricesRef.current.clear();
    lastHighlightTimeRef.current.clear();
  };
}, []); // 마운트 시 한 번만 실행
```

---

## 7. 자주 하는 실수와 해결 방법

### 7.1 실수: useState로 이전 값 저장

```typescript
// ❌ 실수
const [previousPrice, setPreviousPrice] = useState<number | null>(null);

useEffect(() => {
  if (previousPrice !== null && previousPrice !== currentPrice) {
    triggerHighlight();
  }
  setPreviousPrice(currentPrice); // 리렌더링 발생!
}, [currentPrice, previousPrice]);

// ✅ 해결
const previousPriceRef = useRef<number | null>(null);

useEffect(() => {
  if (previousPriceRef.current !== null && previousPriceRef.current !== currentPrice) {
    triggerHighlight();
  }
  previousPriceRef.current = currentPrice; // 리렌더링 없음!
}, [currentPrice]);
```

### 7.2 실수: 스로틀링 없이 애니메이션 트리거

```typescript
// ❌ 실수
useEffect(() => {
  tickers.forEach((ticker) => {
    if (previousPrice !== ticker.price) {
      triggerHighlight(); // 매번 트리거 → 과도한 애니메이션
    }
  });
}, [tickers]);

// ✅ 해결
const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());

useEffect(() => {
  const now = Date.now();
  tickers.forEach((ticker) => {
    const lastTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
    if (now - lastTime >= 100) {
      triggerHighlight();
      lastHighlightTimeRef.current.set(ticker.symbol, now);
    }
  });
}, [tickers]);
```

### 7.3 실수: requestAnimationFrame 중복 스케줄링

```typescript
// ❌ 실수
useEffect(() => {
  requestAnimationFrame(() => {
    // 처리 로직
  });
}, [dependencies]); // 매번 새로운 RAF 요청

// ✅ 해결
const rafIdRef = useRef<number | null>(null);

useEffect(() => {
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      // 처리 로직
      rafIdRef.current = null;
    });
  }
}, [dependencies]);
```

### 7.4 실수: setTimeout 클린업 누락

```typescript
// ❌ 실수
useEffect(() => {
  items.forEach((item) => {
    setTimeout(() => {
      removeHighlight(item.id);
    }, 300);
    // 클린업 없음
  });
}, [items]);

// ✅ 해결
useEffect(() => {
  const timerIds: NodeJS.Timeout[] = [];
  
  items.forEach((item) => {
    const timerId = setTimeout(() => {
      removeHighlight(item.id);
    }, 300);
    timerIds.push(timerId);
  });
  
  return () => {
    timerIds.forEach((id) => clearTimeout(id));
  };
}, [items]);
```

### 7.5 실수: Array 대신 Set 사용하지 않음

```typescript
// ❌ 실수
const [highlightedSymbols, setHighlightedSymbols] = useState<string[]>([]);

// 조회: O(n)
if (highlightedSymbols.includes(symbol)) {
  // ...
}

// 삭제: O(n)
setHighlightedSymbols((prev) => prev.filter((s) => s !== symbol));

// ✅ 해결
const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());

// 조회: O(1)
if (highlightedSymbols.has(symbol)) {
  // ...
}

// 삭제: O(1)
setHighlightedSymbols((prev) => {
  const next = new Set(prev);
  next.delete(symbol);
  return next;
});
```

---

## 8. 실무 예제

### 8.1 완전한 구현 예제

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

type PriceChangeDirection = 'up' | 'down' | null;

interface Ticker {
  symbol: string;
  price: number;
}

interface PriceChangeDetectionProps {
  tickers: Ticker[];
}

export function PriceChangeDetection({ tickers }: PriceChangeDetectionProps) {
  // 이전 가격 추적
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // 하이라이트 상태 관리
  const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());
  const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
  const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  
  // 초기 가격 저장
  useEffect(() => {
    tickers.forEach((ticker) => {
      if (!previousPricesRef.current.has(ticker.symbol)) {
        previousPricesRef.current.set(ticker.symbol, ticker.price);
      }
    });
  }, [tickers]);
  
  // 가격 변경 감지 및 하이라이트 처리
  useEffect(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const now = Date.now();
        const newHighlightedSymbols = new Set<string>();
        const newDirections = new Map<string, PriceChangeDirection>();
        
        tickers.forEach((ticker) => {
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
  
  // 하이라이트 클래스 가져오기
  const getHighlightClass = useCallback((symbol: string): string => {
    if (!highlightedSymbols.has(symbol)) {
      return '';
    }
    
    const direction = highlightDirectionsRef.current.get(symbol);
    if (direction === 'up') {
      return 'bg-green-500/20 transition-colors duration-300';
    } else if (direction === 'down') {
      return 'bg-red-500/20 transition-colors duration-300';
    }
    return '';
  }, [highlightedSymbols]);
  
  return (
    <div>
      {tickers.map((ticker) => {
        const highlightClass = getHighlightClass(ticker.symbol);
        const isHighlighted = highlightedSymbols.has(ticker.symbol);
        const direction = highlightDirectionsRef.current.get(ticker.symbol);
        
        return (
          <div
            key={ticker.symbol}
            className={`ticker-item ${highlightClass}`}
          >
            <span className="symbol">{ticker.symbol}</span>
            <span
              className={`price ${
                isHighlighted
                  ? direction === 'up'
                    ? 'text-green-400'
                    : 'text-red-400'
                  : 'text-white'
              }`}
            >
              ${ticker.price.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

### 8.2 커스텀 훅으로 추상화

```typescript
// hooks/usePriceChangeDetection.ts
import { useEffect, useRef, useState } from 'react';

type PriceChangeDirection = 'up' | 'down' | null;

interface UsePriceChangeDetectionOptions {
  throttleMs?: number;
  highlightDurationMs?: number;
}

interface HighlightState {
  symbols: Set<string>;
  directions: Map<string, PriceChangeDirection>;
}

export function usePriceChangeDetection<T extends { symbol: string; price: number }>(
  items: T[],
  options: UsePriceChangeDetectionOptions = {}
) {
  const { throttleMs = 100, highlightDurationMs = 300 } = options;
  
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());
  const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
  const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const now = Date.now();
        const newHighlightedSymbols = new Set<string>();
        const newDirections = new Map<string, PriceChangeDirection>();
        
        items.forEach((item) => {
          const previousPrice = previousPricesRef.current.get(item.symbol);
          const lastHighlightTime = lastHighlightTimeRef.current.get(item.symbol) || 0;
          
          if (previousPrice !== undefined && previousPrice !== item.price) {
            const timeSinceLastHighlight = now - lastHighlightTime;
            
            if (timeSinceLastHighlight >= throttleMs) {
              const direction: PriceChangeDirection = item.price > previousPrice ? 'up' : 'down';
              newHighlightedSymbols.add(item.symbol);
              newDirections.set(item.symbol, direction);
              lastHighlightTimeRef.current.set(item.symbol, now);
              
              setTimeout(() => {
                setHighlightedSymbols((prev) => {
                  const next = new Set(prev);
                  next.delete(item.symbol);
                  return next;
                });
                highlightDirectionsRef.current.delete(item.symbol);
              }, highlightDurationMs);
            }
          }
          
          previousPricesRef.current.set(item.symbol, item.price);
        });
        
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
  }, [items, throttleMs, highlightDurationMs]);
  
  return {
    highlightedSymbols,
    getDirection: (symbol: string) => highlightDirectionsRef.current.get(symbol) ?? null,
    isHighlighted: (symbol: string) => highlightedSymbols.has(symbol),
  };
}

// 사용 예제
function Component({ tickers }: { tickers: Ticker[] }) {
  const { highlightedSymbols, getDirection, isHighlighted } = usePriceChangeDetection(tickers, {
    throttleMs: 100,
    highlightDurationMs: 300,
  });
  
  return (
    <div>
      {tickers.map((ticker) => (
        <div
          key={ticker.symbol}
          className={isHighlighted(ticker.symbol) ? `highlight-${getDirection(ticker.symbol)}` : ''}
        >
          {ticker.symbol}: ${ticker.price}
        </div>
      ))}
    </div>
  );
}
```

---

## 📝 체크리스트

가격 변경 감지 및 애니메이션 스로틀링을 구현할 때 다음을 확인하세요:

- [ ] `useRef`를 사용하여 이전 값 추적 (리렌더링 방지)
- [ ] 애니메이션 스로틀링 적용 (100ms 권장)
- [ ] `requestAnimationFrame`으로 배치 처리
- [ ] `setTimeout`으로 자동 제거 (300ms 권장)
- [ ] `requestAnimationFrame` 중복 방지 (`rafIdRef` 체크)
- [ ] 클린업 함수 제공 (`cancelAnimationFrame`, `clearTimeout`)
- [ ] Set과 Map을 활용한 효율적인 상태 관리
- [ ] 메모리 누수 방지 (컴포넌트 언마운트 시 정리)

---

## 🎯 핵심 요약

1. **이전 값 추적**: `useRef`로 리렌더링 없이 이전 값 비교
2. **애니메이션 스로틀링**: 100ms 간격 제한으로 과도한 애니메이션 방지
3. **RAF + setTimeout**: 배치 처리와 자동 제거를 동시에 구현
4. **Set + Map**: 효율적인 복합 상태 관리
5. **성능 최적화**: 중복 방지, 클린업, 메모리 관리
6. **사용자 경험**: 적절한 스로틀링과 하이라이트 지속 시간으로 자연스러운 피드백

이러한 패턴들을 이해하고 적용하면, 고성능이고 사용자 친화적인 실시간 데이터 시각화를 구현할 수 있습니다.

---

## 📚 참고 자료

- [MDN: useRef](https://react.dev/reference/react/useRef)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [MDN: setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout)
- [MDN: Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [MDN: Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [React: useRef Hook](https://react.dev/reference/react/useRef)

