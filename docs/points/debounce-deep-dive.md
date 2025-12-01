# 디바운스( Debounce ) 딥다이브

즐겨찾기 기능을 구현하면서 **두 가지 레이어**의 디바운스를 도입했습니다. 이 문서는 디바운스의 기본 개념부터 프로젝트에 적용된 사례, 구현 코드, 실무 팁까지 전부 정리한 학습용 가이드입니다.

---

## 1. 디바운스란?

연속으로 발생하는 이벤트들을 묶어서 **마지막 이벤트 이후 일정 시간이 지난 뒤 한 번만 실행**하도록 만드는 패턴입니다.

| 비교 | 디바운스 | 스로틀 |
| :--- | :--- | :--- |
| 실행 시점 | 마지막 이벤트 후 일정 시간 경과 | 일정 주기마다 최대 1회 |
| 사용 사례 | 검색 입력, 자동 저장, WebSocket 재구독 | 스크롤, 리사이즈, 마우스 이동 |
| 프로젝트 적용 | 즐겨찾기 변경에 따른 재구독, WebSocket 재연결 | 가격 하이라이트 스로틀 (100ms) |

---

## 2. 적용 레이어

| 구분 | 위치 | 목적 | 지연 시간 |
| :--- | :--- | :--- | :--- |
| **디바운스된 재연결** | `lib/websocket/binanceWebSocket.ts` | 구독 변경이 몰릴 때 WebSocket을 반복 재연결하지 않도록 보호 | 300ms |
| **WebSocket 재구독 디바운스** | `components/CoinListClient.tsx` | 즐겨찾기 연속 클릭 시 실제 구독 목록 변경 횟수를 줄임 | 300ms |

두 레이어가 동시에 존재해야 **구독·연결 모두에서 불필요한 작업을 줄여** 서버/클라이언트 모두 이득을 얻습니다.

---

## 3. 구현 코드

### 3.1 연결 레벨 디바운스 (WebSocket 내부)

```typescript
// lib/websocket/binanceWebSocket.ts
private reconnect(): void {
  this.disconnect();
  // 디바운스: 300ms 후 재연결
  setTimeout(() => {
    this.connect();
  }, 300);
}

subscribe(symbols: string[], type: StreamType): void {
  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`);
  streams.forEach((stream) => this.subscribedStreams.add(stream));

  // 이미 열린 소켓이면 디바운스된 재연결만 수행
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.reconnect();
  } else {
    this.connect();
  }
}
```

**포인트**
1. `subscribe()`가 여러 번 호출돼도 결국 300ms 이후 한 번만 `connect()` 호출
2. Binance WebSocket은 스트림 목록이 URL에 포함되므로 재연결이 필요 → 디바운스로 끊김 최소화
3. `disconnect()` → 타이머 → `connect()` 순서로 안전하게 처리

### 3.2 구독 목록 디바운스 (React 컴포넌트 레벨)

```typescript
// components/CoinListClient.tsx
const [debouncedSymbols, setDebouncedSymbols] = useState<string[]>(allSymbols);
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }

  debounceTimerRef.current = setTimeout(() => {
    setDebouncedSymbols(allSymbols);
    debounceTimerRef.current = null;
  }, 300);

  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };
}, [allSymbols]);

const symbols = debouncedSymbols;
const { status: wsStatus } = useBinanceWebSocket({ symbols });
```

**포인트**
1. `favorites` 배열이 바뀌어도 300ms 동안 더 변화가 없을 때만 WebSocket에 전달
2. `useRef`에 타이머 ID 저장 → 리렌더링과 무관하게 관리
3. 클린업에서 반드시 `clearTimeout()` 호출해 메모리 누수 방지

---

## 4. 왜 디바운스를 도입했을까? (문제 상황)

### 4.1 디바운스 도입 전의 문제점

#### 문제 1: 즐겨찾기 연속 클릭 시 WebSocket 재연결 폭증

**시나리오**: 사용자가 즐겨찾기 버튼을 빠르게 5번 클릭

**[디바운스 없을 때]**
```
클릭 1: BTC 추가 → favorites 변경 → allSymbols 변경 → WebSocket 재구독 (재연결 1회)
클릭 2: ETH 추가 → favorites 변경 → allSymbols 변경 → WebSocket 재구독 (재연결 2회)
클릭 3: SOL 추가 → favorites 변경 → allSymbols 변경 → WebSocket 재구독 (재연결 3회)
클릭 4: ADA 추가 → favorites 변경 → allSymbols 변경 → WebSocket 재구독 (재연결 4회)
클릭 5: DOT 추가 → favorites 변경 → allSymbols 변경 → WebSocket 재구독 (재연결 5회)

결과: 5초 만에 WebSocket이 5번 재연결됨
```

**발생한 문제들:**
- ⚠️ **연결 끊김 체감**: 사용자가 "연결 끊김" 상태를 자주 목격
- ⚠️ **서버 부하 증가**: Binance 서버에 불필요한 연결 요청 폭증
- ⚠️ **데이터 손실**: 재연결 중 가격 업데이트를 놓칠 수 있음
- ⚠️ **배터리 소모**: 모바일 기기에서 네트워크 작업이 과도하게 발생

#### 문제 2: Binance WebSocket의 구조적 제약

Binance WebSocket API는 **Combined Streams** 방식을 사용합니다:

```typescript
// 연결 시점에 URL에 스트림 목록이 포함되어야 함
wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker

// ❌ 연결 후 동적으로 스트림 추가/제거하는 API가 없음
// ✅ 구독 변경 = 재연결 필수
```

즐겨찾기가 변경될 때마다:
1. 기존 WebSocket 연결 해제 (`disconnect()`)
2. 새로운 스트림 목록으로 재연결 (`connect()`)

이 과정이 반복되면 사용자 경험이 크게 저하됩니다.

#### 문제 3: 이중 재연결 문제

대규모 변경 시나리오 (예: 전체 코인 100개 → 즐겨찾기 1개):

```typescript
// 기존 방식
unsubscribe(99개) → reconnect()  // 1차 재연결
subscribe(1개) → reconnect()     // 2차 재연결

// 결과: 불필요한 재연결이 2번 발생
```

### 4.2 디바운스 도입 후 개선

**[디바운스 있을 때]**
```
클릭 1: BTC 추가 → favorites 변경 → 타이머 시작 (300ms)
클릭 2: ETH 추가 → favorites 변경 → 타이머 리셋 (300ms)
클릭 3: SOL 추가 → favorites 변경 → 타이머 리셋 (300ms)
클릭 4: ADA 추가 → favorites 변경 → 타이머 리셋 (300ms)
클릭 5: DOT 추가 → favorites 변경 → 타이머 리셋 (300ms)
(300ms 대기)
→ WebSocket 재구독 (재연결 1회만!)

결과: 5번 클릭해도 WebSocket은 1번만 재연결
```

**개선 효과:**
- ✅ **연결 안정성**: 사용자가 체감하는 끊김이 거의 없어짐
- ✅ **서버 부하 감소**: 재연결 횟수가 80% 이상 감소
- ✅ **데이터 일관성**: 재연결 중 데이터 손실 최소화
- ✅ **배터리 효율**: 불필요한 네트워크 작업 대폭 감소

### 4.3 왜 두 레이어의 디바운스가 필요한가?

| 레이어 | 문제 | 해결 |
| :--- | :--- | :--- |
| **컴포넌트 레벨** | 즐겨찾기 연속 클릭 시 `allSymbols`가 매번 변경되어 WebSocket 훅이 반복 호출 | `debouncedSymbols`로 실제 구독 변경 횟수 감소 |
| **WebSocket 레벨** | 구독 변경이 몰릴 때 `reconnect()`가 연속 호출되어 연결이 반복 끊김 | `reconnect()` 내부 디바운스로 재연결 호출 병합 |

**두 레이어가 모두 필요한 이유:**
- 컴포넌트 레벨만 있으면: `reconnect()` 호출은 줄지만, 여전히 여러 번 호출될 수 있음
- WebSocket 레벨만 있으면: `subscribe()` 호출 자체는 줄지 않아 내부 상태 업데이트가 과도하게 발생
- **두 레이어 함께**: 구독 변경과 재연결 모두에서 불필요한 작업을 최소화

결과적으로 "구독 변경"과 "실제 재연결" 사이에서 **두 겹의 완충 장치**가 생겨, 데이터 일관성과 사용자 경험 모두 크게 개선되었습니다.

---

## 5. 실무 팁 & 체크리스트

1. **타이머 저장은 useRef**로 (타이머가 바뀌어도 리렌더링 필요 없음)
2. **클린업 필수**: 컴포넌트 언마운트 또는 deps 변경 시 `clearTimeout`
3. **적절한 지연 시간 선택**: UX와 성능을 모두 고려 (300ms~500ms 권장)
4. **디바운스 위치 명확화**: 데이터 변경을 묶는지, 연결을 묶는지 구분
5. **디바운스 vs 스로틀**: “마지막 실행”이 필요하면 디바운스, “주기적 실행”이 필요하면 스로틀
6. **테스트 시나리오 작성**: 연속 클릭, 빠른 필터링 등 엣지 케이스 포함

---

## 6. 요약

- **디바운스 핵심**: 마지막 이벤트 후 일정 시간 기다렸다가 한 번만 실행
- **프로젝트 적용**: `CoinListClient`에서 구독 목록, `binanceWebSocket`에서 재연결을 각각 디바운스
- **이점**: 서버 부하 감소, 체감 끊김 최소화, 즐겨찾기 UX 개선
- **기억할 점**: 타이머 관리는 ref로, 클린업을 잊지 말자, 레이어별 목적을 분리하자

이 가이드를 숙지하면 즐겨찾기 같은 인터랙션이 많은 기능에서도 안정적이고 부드러운 실시간 경험을 설계할 수 있습니다.


