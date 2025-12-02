# 아키텍처 문서

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [아키텍처 다이어그램](#아키텍처-다이어그램)
3. [계층 구조](#계층-구조)
4. [핵심 패턴](#핵심-패턴)
5. [데이터 흐름](#데이터-흐름)
6. [기술 스택](#기술-스택)
7. [성능 최적화 전략](#성능-최적화-전략)

---

## 시스템 개요

실시간 암호화폐 대시보드는 **Next.js 16** 기반의 고성능 웹 애플리케이션으로, Binance API를 활용하여 실시간 암호화폐 가격 정보를 제공합니다.

### 핵심 설계 원칙

1. **서버 우선 (Server-First)**: Next.js의 SSR/SSG를 활용한 초기 로딩 성능 최적화
2. **실시간 우선 (Real-time First)**: WebSocket을 통한 고빈도 데이터 업데이트
3. **강건성 (Resilience)**: Degraded Mode, 재연결 전략, Rate Limit 대응
4. **확장성 (Scalability)**: 어댑터 패턴, 리포지토리 패턴으로 외부 의존성 격리
5. **성능 (Performance)**: 가상화, 메모이제이션, 배치 업데이트

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트 (브라우저)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   React UI   │  │   Zustand    │  │  WebSocket    │    │
│  │  Components  │◄─┤    Store     │◄─┤   Client      │    │
│  └──────────────┘  └──────────────┘  └──────┬───────┘    │
│         │                  │                │            │
│         │                  │                │            │
│         └──────────────────┴────────────────┘            │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                            │ HTTP / WebSocket
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    Next.js 서버                           │
│                           │                              │
│  ┌────────────────────────┴──────────────────────────┐  │
│  │              API Routes (프록시)                   │  │
│  │  ┌──────────────┐      ┌──────────────┐          │  │
│  │  │ /api/coins   │      │ /api/klines  │          │  │
│  │  └──────────────┘      └──────────────┘          │  │
│  └──────────────────────────────────────────────────┘  │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                            │ REST API
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    Binance API                            │
│  ┌────────────────────────┴──────────────────────────┐  │
│  │  REST API: /api/v3/ticker/24hr, /api/v3/klines   │  │
│  │  WebSocket: wss://stream.binance.com:9443/stream │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 계층 구조

### 1. 프레젠테이션 계층 (Presentation Layer)

**위치**: `app/`, `components/`

- **Server Components**: 초기 데이터 페칭 및 SSR
- **Client Components**: 인터랙티브 UI 및 실시간 업데이트
- **주요 컴포넌트**:
  - `CoinListClient`: 코인 목록 표시 및 정렬/필터링
  - `CandlestickChart`: 캔들스틱 차트 렌더링
  - `CoinSelectModal`: 코인 선택 모달 (검색, 무한 스크롤)
  - `PerformanceStats`: 성능 통계 표시

### 2. 상태 관리 계층 (State Management Layer)

**위치**: `stores/`, `hooks/`

- **Zustand Store**: 전역 상태 관리
  - `tickerStore`: 티커 데이터 (Map 기반 정규화 구조)
  - `favoriteStore`: 즐겨찾기 목록 (localStorage 영구 저장)
- **Custom Hooks**: 비즈니스 로직 캡슐화
  - `useBinanceWebSocket`: WebSocket 연결 및 구독 관리
  - `usePollingMode`: REST API 폴링 (Degraded Mode)
  - `usePerformanceStats`: 성능 통계 수집

### 3. 데이터 접근 계층 (Data Access Layer)

**위치**: `adapters/`, `repositories/`, `lib/websocket/`

- **Adapter Pattern**: 외부 API 데이터를 도메인 타입으로 변환
  - `binance.ts`: Binance REST API 어댑터
- **Repository Pattern**: 데이터 소스 추상화
  - `tickerRepository.ts`: 티커 데이터 접근 인터페이스
- **WebSocket Client**: 실시간 데이터 스트림 관리
  - `binanceWebSocket.ts`: Binance WebSocket 클라이언트

### 4. API 계층 (API Layer)

**위치**: `app/api/`

- **Next.js API Routes**: 서버 측 프록시
  - `/api/coins`: 코인 목록 조회 (Rate Limit 처리)
  - `/api/klines`: OHLCV 데이터 조회 (Rate Limit 처리)

### 5. 유틸리티 계층 (Utility Layer)

**위치**: `utils/`

- **Throttle/Debounce**: 성능 최적화
- **API Cache**: 응답 캐싱 (Rate Limit 대응)
- **Coin Names**: 한국어 코인명 매핑

---

## 핵심 패턴

### 1. 어댑터 패턴 (Adapter Pattern)

**목적**: 외부 API 형식 변경으로부터 코드베이스 격리

**구현**:
```typescript
// adapters/binance.ts
export function adaptBinanceTicker(binanceData: BinanceTickerResponse): Ticker {
  return {
    symbol: binanceData.symbol,
    price: parseFloat(binanceData.lastPrice),
    priceChange: parseFloat(binanceData.priceChangePercent),
    // ... 도메인 타입으로 변환
  };
}
```

**장점**:
- Binance API 변경 시 어댑터만 수정
- 도메인 타입과 외부 API 타입 분리
- 테스트 용이성 (Mock 데이터 사용)

### 2. 리포지토리 패턴 (Repository Pattern)

**목적**: 상태 관리 계층 추상화로 라이브러리 비종속성 확보

**구현**:
```typescript
// repositories/tickerRepository.ts
export interface TickerRepository {
  getTicker(symbol: string): Ticker | undefined;
  getAllTickers(): Ticker[];
  updateTicker(ticker: Ticker): void;
  // ... 추상 인터페이스
}
```

**장점**:
- Zustand를 다른 상태 관리 라이브러리로 교체 가능
- 비즈니스 로직과 상태 관리 로직 분리
- 테스트 시 Mock Repository 사용 가능

### 3. 함수형 코어 (Functional Core)

**목적**: 순수 함수를 통한 테스트 용이성 및 안정성

**예시**:
- `adaptBinanceTicker`: 순수 함수 (입력 → 출력)
- `convertKlineToCandlestick`: 순수 함수 (데이터 변환)
- `detectAndFillGaps`: 순수 함수 (데이터 검증)

**장점**:
- 부작용(Side Effect) 없음
- 예측 가능한 동작
- 단위 테스트 작성 용이

### 4. 디바운스/스로틀링 패턴

**목적**: 고빈도 이벤트 처리 최적화

**적용 위치**:
- WebSocket 재연결: 즐겨찾기 변경 시 디바운스
- 스크롤 이벤트: 무한 스크롤 스로틀링
- API 요청: Rate Limit 대응

---

## 데이터 흐름

### 1. 초기 데이터 로딩

```
1. 사용자 접속
   ↓
2. Server Component (app/page.tsx)
   - fetchInitialCoins() 호출
   ↓
3. Next.js API Route (/api/coins)
   - Binance REST API 호출
   - Rate Limit 처리
   - 캐시 헤더 설정
   ↓
4. Client Component (CoinListClient)
   - 초기 데이터 하이드레이션
   - WebSocket 연결 시작
```

### 2. 실시간 데이터 업데이트

```
1. Binance WebSocket
   - 실시간 티커 메시지 수신
   ↓
2. BinanceWebSocketClient
   - 메시지 파싱
   - 어댑터를 통한 도메인 타입 변환
   ↓
3. Zustand Store (tickerStore)
   - Map 기반 정규화 구조로 저장
   - requestAnimationFrame을 통한 배치 업데이트
   ↓
4. React Components
   - Store 구독으로 자동 리렌더링
   - TanStack Virtual을 통한 효율적 렌더링
```

### 3. 즐겨찾기 변경 흐름

```
1. 사용자 클릭 (FavoriteButton)
   ↓
2. favoriteStore.toggleFavorite()
   - localStorage 업데이트
   ↓
3. CoinListClient
   - favorites 배열 변경 감지
   - 디바운스된 재구독 트리거
   ↓
4. useBinanceWebSocket
   - 변경 규모 감지 (대규모/소규모)
   - 대규모: updateSubscription() (전체 재구독)
   - 소규모: subscribe/unsubscribe() (차등 구독)
   ↓
5. BinanceWebSocketClient
   - WebSocket 재연결 (필요 시)
   - 새 스트림 구독
```

### 4. 차트 데이터 흐름

```
1. 사용자 코인 선택
   ↓
2. ChartClient
   - REST API로 과거 Kline 데이터 페치
   - 차트 초기화
   ↓
3. WebSocket Kline 스트림 구독
   - 실시간 캔들 업데이트
   ↓
4. 데이터 병합
   - 과거 데이터 + 실시간 데이터
   - Gap 감지 및 보완
   ↓
5. Lightweight Charts
   - 차트 업데이트
```

---

## 기술 스택

### 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.0.3 | SSR/SSG, API Routes, 파일 기반 라우팅 |
| React | 19.2.0 | 선언적 UI 구성 |
| TypeScript | 5.x | 타입 안정성 |
| Tailwind CSS | 4.x | 유틸리티 기반 스타일링 |

### 상태 관리 및 데이터

| 기술 | 버전 | 용도 |
|------|------|------|
| Zustand | 5.0.8 | 고빈도 실시간 데이터 관리 |
| TanStack Virtual | 3.13.12 | 리스트 가상화 |
| Lightweight Charts | 5.0.9 | 캔들스틱 차트 |

### 개발 도구

| 기술 | 버전 | 용도 |
|------|------|------|
| Vitest | 4.0.9 | 단위 테스트 |
| ESLint | 9.x | 코드 품질 검사 |
| Lighthouse | 13.0.1 | 성능 측정 |

---

## 성능 최적화 전략

### 1. 렌더링 최적화

- **React.memo**: 불필요한 리렌더링 방지
- **useMemo**: 계산 비용이 높은 값 메모이제이션
- **useCallback**: 함수 메모이제이션
- **TanStack Virtual**: 대량 리스트 가상화

### 2. 데이터 처리 최적화

- **배치 업데이트**: `requestAnimationFrame`을 통한 배치 처리
- **정규화된 데이터 구조**: Map 기반 저장으로 O(1) 조회
- **API 캐싱**: 중복 요청 방지

### 3. 네트워크 최적화

- **WebSocket**: 실시간 데이터 전송 (폴링 대비 효율적)
- **REST API 프록시**: Rate Limit 중앙 관리
- **Degraded Mode**: WebSocket 실패 시 폴링으로 전환

### 4. 번들 크기 최적화

- **Package Imports 최적화**: `optimizePackageImports` 설정
- **Dynamic Imports**: 필요 시에만 로드
- **Tree Shaking**: 사용하지 않는 코드 제거

---

## 확장성 고려사항

### 1. 다중 거래소 지원

어댑터 패턴을 활용하여 다른 거래소(예: Coinbase, Kraken) 추가 가능:

```typescript
// adapters/coinbase.ts
export function adaptCoinbaseTicker(data: CoinbaseTickerResponse): Ticker {
  // Coinbase API 형식에 맞는 변환 로직
}
```

### 2. 상태 관리 라이브러리 교체

리포지토리 패턴으로 Zustand를 다른 라이브러리로 교체 가능:

```typescript
// repositories/tickerRepository.ts
// 인터페이스는 동일, 구현만 변경
```

### 3. 차트 라이브러리 교체

Lightweight Charts를 다른 라이브러리로 교체 시 `CandlestickChart` 컴포넌트만 수정

---

## 보안 고려사항

### 1. API Key 관리

- REST API Key는 서버 측에만 저장 (Next.js API Routes)
- 클라이언트에서 직접 Binance API 호출 시 Key 노출 방지

### 2. Rate Limit 대응

- 서버 측에서 중앙 집중식 Rate Limit 관리
- `Retry-After` 헤더 감지 및 재시도 로직
- API 응답 캐싱으로 요청 수 감소

### 3. WebSocket 보안

- WSS (WebSocket Secure) 사용
- 연결 상태 모니터링 및 자동 재연결

---

## 참고 문서

- [제품 요구사항 정의서](./prd.md)
- [실시간 전략 문서](./realtime-strategy.md)
- [성능 분석 문서](./performance.md)
- [이슈 및 해결책](./issues-and-solutions.md)

