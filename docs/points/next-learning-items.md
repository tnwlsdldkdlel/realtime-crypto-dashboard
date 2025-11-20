# 필수 기술별 다음 학습 항목

이 문서는 프로젝트에서 이미 학습한 필수 기술들을 바탕으로 다음에 학습할 항목들을 정리합니다.

---

## 📚 목차

1. [React Hooks 심화](#1-react-hooks-심화)
2. [성능 최적화](#2-성능-최적화)
3. [WebSocket 실전](#3-websocket-실전)
4. [Next.js App Router](#4-nextjs-app-router)
5. [디자인 패턴](#5-디자인-패턴)

---

## 1. React Hooks 심화

### 1.1 현재 학습 상태

✅ **이미 학습한 내용:**
- `useEffect` 의존성 관리
- `useRef`로 인스턴스/값 보존
- 커스텀 훅 패턴 기본
- 의존성 문제 해결 (ref 활용)

### 1.2 다음 학습 항목

#### 1.2.1 useMemo vs useCallback 차이와 활용

**학습 목표:**
- `useMemo`와 `useCallback`의 차이점 이해
- 언제 어떤 것을 사용해야 하는지 판단
- 실제 성능 개선 효과 측정

**핵심 개념:**
```typescript
// useMemo: 값 메모이제이션
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// useCallback: 함수 메모이제이션
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

**학습 내용:**
- 값 계산 비용이 높을 때 `useMemo` 사용
- 자식 컴포넌트에 함수를 props로 전달할 때 `useCallback` 사용
- 의존성 배열 관리
- 오남용 시 주의사항

**실무 적용:**
- 리스트 필터링/정렬 결과 메모이제이션
- 이벤트 핸들러 최적화
- 복잡한 계산 결과 캐싱

---

#### 1.2.2 React.memo 최적화 전략

**학습 목표:**
- `React.memo`를 사용한 컴포넌트 메모이제이션
- 언제 사용해야 하는지 판단
- props 비교 함수 커스터마이징

**핵심 개념:**
```typescript
// 기본 사용
const MemoizedComponent = React.memo(Component);

// 커스텀 비교 함수
const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
  // true 반환 시 리렌더링 스킵
  return prevProps.id === nextProps.id;
});
```

**학습 내용:**
- 얕은 비교(shallow comparison) 동작 원리
- 객체/배열 props 주의사항
- 언제 사용하면 안 되는지
- 성능 프로파일링으로 효과 측정

**실무 적용:**
- 자주 리렌더링되는 부모의 자식 컴포넌트
- 큰 리스트의 아이템 컴포넌트
- 복잡한 계산을 하는 컴포넌트

---

#### 1.2.3 커스텀 훅 설계 원칙 심화

**학습 목표:**
- 복잡한 로직을 커스텀 훅으로 추상화
- 훅 조합(Composition) 패턴
- 에러 처리 및 로딩 상태 관리

**핵심 개념:**
```typescript
// 훅 조합 예시
function useDataWithErrorHandling<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetcher()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
```

**학습 내용:**
- 단일 책임 원칙 적용
- 훅 간 의존성 관리
- 재사용성과 유연성 균형
- 타입 안정성 확보

**실무 적용:**
- API 데이터 페칭 훅
- 폼 상태 관리 훅
- 인증 상태 관리 훅
- 로컬 스토리지 동기화 훅

---

## 2. 성능 최적화

### 2.1 현재 학습 상태

✅ **이미 학습한 내용:**
- `requestAnimationFrame` 배치 업데이트
- Map을 사용한 정규화된 데이터 구조
- 불필요한 리렌더링 방지 (ref 활용)

### 2.2 다음 학습 항목

#### 2.2.1 React 성능 프로파일링

**학습 목표:**
- React DevTools Profiler 사용법
- 성능 병목 지점 식별
- 리렌더링 원인 분석

**핵심 도구:**
- React DevTools Profiler
- Chrome DevTools Performance
- `why-did-you-render` 라이브러리

**학습 내용:**
- 프로파일링 방법론
- 렌더링 시간 분석
- 불필요한 리렌더링 추적
- 성능 개선 전/후 비교

**실무 적용:**
- 대용량 리스트 렌더링 최적화
- 복잡한 폼 컴포넌트 최적화
- 실시간 데이터 업데이트 최적화

---

#### 2.2.2 불필요한 리렌더링 방지 전략

**학습 목표:**
- 리렌더링 트리거 원인 파악
- Context API 최적화
- 상태 구조 최적화

**핵심 개념:**
```typescript
// Context 분리로 리렌더링 최소화
const ThemeContext = createContext();
const UserContext = createContext();

// 상태 구조 최적화
// ❌ 나쁜 예: 큰 객체 하나에 모든 상태
const [state, setState] = useState({ user, theme, data, ... });

// ✅ 좋은 예: 관심사별로 분리
const [user, setUser] = useState();
const [theme, setTheme] = useState();
const [data, setData] = useState();
```

**학습 내용:**
- Context API 사용 시 주의사항
- 상태 구조 설계 원칙
- 선택적 구독 패턴
- 상태 업데이트 배치 처리

**실무 적용:**
- 전역 상태 관리 최적화
- 다중 Context 사용
- 상태 업데이트 최소화

---

#### 2.2.3 메모이제이션 전략 (언제 사용할까?)

**학습 목표:**
- 메모이제이션의 비용과 이점 이해
- 언제 사용해야 하는지 판단 기준
- 오남용 방지

**핵심 개념:**
```typescript
// ✅ 사용해야 하는 경우
// 1. 계산 비용이 높은 경우
const expensiveResult = useMemo(() => {
  return heavyComputation(data);
}, [data]);

// 2. 참조 동일성이 중요한 경우
const memoizedCallback = useCallback(() => {
  // 자식 컴포넌트에 전달
}, [deps]);

// ❌ 사용하지 말아야 하는 경우
// 1. 계산이 간단한 경우
const simple = useMemo(() => a + b, [a, b]); // 오버헤드만 증가

// 2. 의존성이 자주 변경되는 경우
const memoized = useMemo(() => compute(x), [x]); // x가 자주 변경되면 의미 없음
```

**학습 내용:**
- 메모이제이션 오버헤드 이해
- 의존성 배열 관리
- 성능 측정 및 비교
- 일반적인 실수와 해결 방법

**실무 적용:**
- 복잡한 필터링/정렬 로직
- 그래프/차트 데이터 변환
- 큰 리스트 렌더링

---

## 3. WebSocket 실전

### 3.1 현재 학습 상태

✅ **이미 학습한 내용:**
- WebSocket 기본 연결 및 재연결
- 지수 백오프 재연결 전략
- 디바운스된 재연결
- 커스텀 훅을 통한 WebSocket 관리

### 3.2 다음 학습 항목

#### 3.2.1 WebSocket 에러 핸들링 심화

**학습 목표:**
- 다양한 에러 상황 처리
- 에러 분류 및 복구 전략
- 사용자 피드백 제공

**핵심 개념:**
```typescript
// 에러 분류
enum WebSocketErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
}

// 에러별 복구 전략
function handleError(error: WebSocketError) {
  switch (error.type) {
    case WebSocketErrorType.NETWORK_ERROR:
      // 네트워크 에러: 재연결 시도
      scheduleReconnect();
      break;
    case WebSocketErrorType.RATE_LIMIT:
      // Rate Limit: 지연 후 재연결
      scheduleReconnectWithDelay(error.retryAfter);
      break;
    case WebSocketErrorType.INVALID_MESSAGE:
      // 잘못된 메시지: 로깅만 하고 계속 진행
      logError(error);
      break;
  }
}
```

**학습 내용:**
- 에러 타입 분류
- 에러 복구 전략
- 에러 로깅 및 모니터링
- 사용자 친화적 에러 메시지

**실무 적용:**
- 네트워크 불안정 환경 대응
- 서버 에러 처리
- Rate Limit 대응
- 메시지 파싱 에러 처리

---

#### 3.2.2 Degraded Mode (폴백 전략)

**학습 목표:**
- WebSocket 실패 시 REST API 폴백
- 점진적 기능 저하 (Graceful Degradation)
- 사용자 경험 유지

**핵심 개념:**
```typescript
// Degraded Mode 구현
class RealtimeDataManager {
  private mode: 'websocket' | 'polling' = 'websocket';
  private pollingInterval: number | null = null;

  async connect() {
    try {
      await this.connectWebSocket();
      this.mode = 'websocket';
    } catch (error) {
      console.warn('WebSocket failed, falling back to polling');
      this.fallbackToPolling();
      this.mode = 'polling';
    }
  }

  private fallbackToPolling() {
    this.pollingInterval = setInterval(() => {
      this.fetchDataViaREST();
    }, 5000); // 5초마다 폴링
  }

  async reconnect() {
    if (this.mode === 'polling') {
      // 폴링 중에도 WebSocket 재연결 시도
      try {
        await this.connectWebSocket();
        this.stopPolling();
        this.mode = 'websocket';
      } catch (error) {
        // 계속 폴링 유지
      }
    }
  }
}
```

**학습 내용:**
- 폴백 전략 설계
- 폴링 주기 최적화
- 자동 복구 메커니즘
- 사용자에게 모드 전환 알림

**실무 적용:**
- 네트워크 불안정 환경
- 방화벽/프록시 환경
- 모바일 네트워크 대응
- 서버 장애 시 대응

---

#### 3.2.3 연결 상태 관리 및 UI 피드백

**학습 목표:**
- 연결 상태를 명확하게 표시
- 재연결 진행 상황 피드백
- 사용자 액션 유도

**핵심 개념:**
```typescript
// 연결 상태 타입
type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// 상태별 UI 피드백
function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case 'connected':
      return <Badge color="green">연결됨</Badge>;
    case 'connecting':
      return <Badge color="yellow">연결 중...</Badge>;
    case 'reconnecting':
      return <Badge color="orange">재연결 중... (시도 {attempt})</Badge>;
    case 'error':
      return (
        <Badge color="red">
          연결 실패 <Button onClick={retry}>재시도</Button>
        </Badge>
      );
    default:
      return <Badge color="gray">연결 안 됨</Badge>;
  }
}
```

**학습 내용:**
- 상태 머신 패턴
- 사용자 피드백 디자인
- 재연결 진행 상황 표시
- 수동 재연결 옵션 제공

**실무 적용:**
- 실시간 대시보드
- 채팅 애플리케이션
- 게임 상태 표시
- 트레이딩 플랫폼

---

## 4. Next.js App Router

### 4.1 현재 학습 상태

✅ **이미 학습한 내용:**
- Server Components와 Client Components 분리
- 서버 사이드 데이터 페칭
- 기본 라우팅

### 4.2 다음 학습 항목

#### 4.2.1 데이터 페칭 전략 (SSR, SSG, ISR)

**학습 목표:**
- 각 렌더링 전략의 차이 이해
- 언제 어떤 전략을 사용할지 판단
- 성능과 최신성의 균형

**핵심 개념:**
```typescript
// SSR: 매 요청마다 서버에서 렌더링
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store', // SSR
  });
  return <div>{data}</div>;
}

// SSG: 빌드 시 한 번만 생성
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'force-cache', // SSG
  });
  return <div>{data}</div>;
}

// ISR: 주기적으로 재생성
export const revalidate = 60; // 60초마다 재생성

export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data}</div>;
}
```

**학습 내용:**
- 각 전략의 장단점
- 사용 사례별 선택 기준
- 캐싱 전략
- 성능 최적화

**실무 적용:**
- 블로그/뉴스 사이트 (SSG)
- 대시보드 (SSR)
- 제품 페이지 (ISR)
- 사용자별 콘텐츠 (SSR)

---

#### 4.2.2 라우팅 및 네비게이션

**학습 목표:**
- Next.js App Router 라우팅 시스템 이해
- 동적 라우팅
- 라우트 그룹 및 병렬 라우트

**핵심 개념:**
```typescript
// 동적 라우팅
// app/coins/[symbol]/page.tsx
export default async function CoinPage({
  params,
}: {
  params: { symbol: string };
}) {
  const coin = await fetchCoin(params.symbol);
  return <CoinDetail coin={coin} />;
}

// 라우트 그룹
// app/(dashboard)/layout.tsx
// app/(dashboard)/coins/page.tsx

// 병렬 라우트
// app/@analytics/page.tsx
// app/@notifications/page.tsx
```

**학습 내용:**
- 파일 기반 라우팅
- 동적 세그먼트
- 라우트 핸들러 (API Routes)
- 미들웨어 활용

**실무 적용:**
- 다중 레이아웃
- 조건부 라우팅
- 인증/인가 처리
- 다국어 지원

---

#### 4.2.3 캐싱 전략

**학습 목표:**
- Next.js 캐싱 메커니즘 이해
- 데이터 캐싱 최적화
- 캐시 무효화 전략

**핵심 개념:**
```typescript
// Request Memoization
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // 1시간 캐시
  });
  return res.json();
}

// Data Cache
const data = await fetch('https://api.example.com/data', {
  cache: 'force-cache', // 영구 캐시
  // 또는
  cache: 'no-store', // 캐시 안 함
});

// Full Route Cache (SSG)
export const revalidate = 60; // ISR

// Router Cache
// 자동으로 관리됨
```

**학습 내용:**
- 캐시 계층 이해
- 캐시 전략 선택
- 캐시 무효화
- 성능 측정

**실무 적용:**
- API 응답 캐싱
- 정적 콘텐츠 최적화
- 실시간 데이터 처리
- CDN 활용

---

## 5. 디자인 패턴

### 5.1 현재 학습 상태

✅ **이미 학습한 내용:**
- 어댑터 패턴 (Adapter Pattern)
- 리포지토리 패턴 (Repository Pattern)

### 5.2 다음 학습 항목

#### 5.2.1 Observer 패턴

**학습 목표:**
- Observer 패턴의 개념과 활용
- React에서의 Observer 패턴 (Context, Zustand)
- 이벤트 기반 아키텍처

**핵심 개념:**
```typescript
// Observer 패턴 구현
class Subject {
  private observers: Observer[] = [];

  subscribe(observer: Observer) {
    this.observers.push(observer);
  }

  unsubscribe(observer: Observer) {
    this.observers = this.observers.filter(o => o !== observer);
  }

  notify(data: any) {
    this.observers.forEach(observer => observer.update(data));
  }
}

// React에서의 Observer (Zustand)
const useStore = create((set) => ({
  data: null,
  setData: (data) => set({ data }), // 모든 구독자에게 알림
}));
```

**학습 내용:**
- Observer 패턴의 구조
- React 상태 관리와의 관계
- 이벤트 버스 패턴
- Pub/Sub 패턴

**실무 적용:**
- 상태 관리 라이브러리
- 이벤트 시스템
- 실시간 업데이트
- 컴포넌트 간 통신

---

#### 5.2.2 Strategy 패턴

**학습 목표:**
- Strategy 패턴으로 알고리즘 교체 가능하게 만들기
- 조건부 로직을 Strategy로 리팩토링
- 확장 가능한 아키텍처 설계

**핵심 개념:**
```typescript
// Strategy 패턴
interface SortingStrategy {
  sort(data: Ticker[]): Ticker[];
}

class PriceSortStrategy implements SortingStrategy {
  sort(data: Ticker[]) {
    return [...data].sort((a, b) => a.price - b.price);
  }
}

class VolumeSortStrategy implements SortingStrategy {
  sort(data: Ticker[]) {
    return [...data].sort((a, b) => b.volume - a.volume);
  }
}

class TickerList {
  private strategy: SortingStrategy;

  setStrategy(strategy: SortingStrategy) {
    this.strategy = strategy;
  }

  sort(data: Ticker[]) {
    return this.strategy.sort(data);
  }
}
```

**학습 내용:**
- Strategy 패턴의 구조
- if/else를 Strategy로 리팩토링
- 런타임 전략 교체
- 확장성과 유지보수성

**실무 적용:**
- 정렬/필터링 로직
- 결제 수단 처리
- 데이터 변환 로직
- 렌더링 전략

---

#### 5.2.3 패턴 선택 기준

**학습 목표:**
- 상황에 맞는 패턴 선택
- 패턴 조합
- 오버엔지니어링 방지

**핵심 개념:**
```typescript
// 패턴 선택 기준

// 1. 어댑터 패턴
// - 외부 API 형식 변환이 필요할 때
// - 레거시 시스템 연동 시

// 2. 리포지토리 패턴
// - 데이터 소스를 교체할 가능성이 있을 때
// - 테스트 용이성이 중요할 때

// 3. Observer 패턴
// - 여러 컴포넌트가 같은 상태를 구독할 때
// - 이벤트 기반 아키텍처가 필요할 때

// 4. Strategy 패턴
// - 알고리즘을 런타임에 교체해야 할 때
// - 조건부 로직이 복잡할 때
```

**학습 내용:**
- 각 패턴의 사용 시기
- 패턴 조합 전략
- YAGNI 원칙 (You Aren't Gonna Need It)
- 실용적 접근

**실무 적용:**
- 프로젝트 초기 설계
- 리팩토링 시점 판단
- 기술 부채 관리
- 팀 협업

---

#### 5.2.4 실무 적용 사례

**학습 목표:**
- 실제 프로젝트에서 패턴 적용
- 패턴 적용 전/후 비교
- 일반적인 실수와 해결

**핵심 개념:**
```typescript
// 실무 예시: 다중 API 어댑터
interface ExchangeAdapter {
  fetchTicker(symbol: string): Promise<Ticker>;
  subscribeTicker(symbol: string): void;
}

class BinanceAdapter implements ExchangeAdapter {
  // Binance API 구현
}

class CoinbaseAdapter implements ExchangeAdapter {
  // Coinbase API 구현
}

// Strategy로 교체 가능
class ExchangeService {
  private adapter: ExchangeAdapter;

  setExchange(adapter: ExchangeAdapter) {
    this.adapter = adapter;
  }
}
```

**학습 내용:**
- 패턴 적용 시나리오
- 리팩토링 과정
- 성능 영향 분석
- 팀 협업 고려사항

**실무 적용:**
- 다중 데이터 소스 통합
- 플러그인 시스템
- A/B 테스트 인프라
- 마이크로서비스 아키텍처

---

## 🎯 학습 우선순위

### 높은 우선순위 (즉시 학습 권장)

1. **React Hooks 심화**
   - `useMemo` vs `useCallback` (성능 최적화의 기초)
   - `React.memo` 최적화 전략 (실무에서 자주 사용)

2. **성능 최적화**
   - React 성능 프로파일링 (문제 발견의 첫 단계)
   - 불필요한 리렌더링 방지 (실무에서 가장 중요)

3. **WebSocket 실전**
   - 에러 핸들링 심화 (안정성 확보)
   - Degraded Mode (사용자 경험)

### 중간 우선순위

4. **Next.js App Router**
   - 데이터 페칭 전략 (SSR, SSG, ISR)
   - 캐싱 전략 (성능 최적화)

5. **디자인 패턴**
   - Observer 패턴 (상태 관리 이해)
   - Strategy 패턴 (코드 확장성)

### 낮은 우선순위 (필요 시 학습)

6. **고급 패턴**
   - 패턴 조합
   - 아키텍처 설계

---

## 📚 학습 방법

### 1. 이론 학습
- 각 항목에 대한 개념 이해
- 공식 문서 및 튜토리얼 읽기
- 예제 코드 분석

### 2. 실습
- 프로젝트에 직접 적용
- 작은 기능부터 시작
- 성능 측정 및 비교

### 3. 리뷰
- 코드 리뷰 받기
- 개선점 찾기
- 문서화

---

## 💡 핵심 요약

1. **React Hooks 심화**: `useMemo`, `useCallback`, `React.memo`를 올바르게 사용하여 성능 최적화
2. **성능 최적화**: 프로파일링으로 문제를 발견하고, 메모이제이션으로 해결
3. **WebSocket 실전**: 에러 핸들링과 폴백 전략으로 안정적인 실시간 통신
4. **Next.js App Router**: 적절한 렌더링 전략과 캐싱으로 성능 최적화
5. **디자인 패턴**: 상황에 맞는 패턴 선택으로 확장 가능한 코드 작성

이러한 항목들을 순차적으로 학습하면, 더욱 견고하고 성능이 좋은 애플리케이션을 구축할 수 있습니다.

