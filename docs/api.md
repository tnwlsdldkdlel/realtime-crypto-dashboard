# API 문서

## 📋 목차

1. [개요](#개요)
2. [REST API](#rest-api)
3. [WebSocket API](#websocket-api)
4. [에러 처리](#에러-처리)
5. [Rate Limit](#rate-limit)

---

## 개요

실시간 암호화폐 대시보드는 **Next.js API Routes**를 통해 Binance API를 프록시합니다. 클라이언트는 직접 Binance API를 호출하지 않고, Next.js 서버를 통해 안전하게 데이터를 가져옵니다.

### API 구조

```
클라이언트 → Next.js API Routes → Binance API
```

**장점**:
- API Key 보안 (서버 측에만 저장)
- Rate Limit 중앙 관리
- 에러 처리 및 재시도 로직 통합

---

## REST API

### 1. 코인 목록 조회

**엔드포인트**: `GET /api/coins`

**쿼리 파라미터**:
- `symbols` (선택): 쉼표로 구분된 심볼 목록
  - 예: `?symbols=BTCUSDT,ETHUSDT`

**응답 예시**:
```json
[
  {
    "symbol": "BTCUSDT",
    "lastPrice": "50000.00",
    "priceChange": "1000.00",
    "priceChangePercent": "2.04",
    "volume": "12345.67",
    "highPrice": "51000.00",
    "lowPrice": "49000.00"
  },
  ...
]
```

**캐시 정책**:
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- 60초 캐시, 30초 stale-while-revalidate

**에러 응답**:
```json
{
  "error": "Failed to fetch coins"
}
```
- 상태 코드: `500`

---

### 2. Kline (OHLCV) 데이터 조회

**엔드포인트**: `GET /api/klines`

**쿼리 파라미터**:
- `symbol` (필수): 거래 심볼 (예: `BTCUSDT`)
- `interval` (선택): 시간 간격 (기본값: `1m`)
  - 가능한 값: `1m`, `5m`, `15m`, `1h`, `4h`, `1d` 등
- `limit` (선택): 반환할 데이터 개수 (기본값: `500`)
- `startTime` (선택): 시작 시간 (Unix timestamp, 밀리초)
- `endTime` (선택): 종료 시간 (Unix timestamp, 밀리초)

**요청 예시**:
```
GET /api/klines?symbol=BTCUSDT&interval=1h&limit=100&startTime=1609459200000
```

**응답 예시**:
```json
[
  [
    1609459200000,  // openTime
    "50000.00",     // open
    "51000.00",     // high
    "49000.00",     // low
    "50500.00",     // close
    "12345.67",     // volume
    1609462800000,  // closeTime
    ...
  ],
  ...
]
```

**캐시 정책**:
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- 60초 캐시, 30초 stale-while-revalidate

**에러 응답**:
```json
{
  "error": "Symbol parameter is required"
}
```
- 상태 코드: `400` (필수 파라미터 누락)
- 상태 코드: `500` (서버 오류)

---

## WebSocket API

### 연결

**엔드포인트**: `wss://stream.binance.com:9443/stream`

**연결 URL 형식**:
```
wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker
```

**특징**:
- 연결 시점에 스트림 목록이 URL에 포함되어야 함
- 연결 후 동적으로 스트림 추가/제거 불가능
- 스트림 변경 시 재연결 필요

### 스트림 타입

#### 1. Ticker Stream

**형식**: `{symbol}@ticker`

**예시**: `btcusdt@ticker`

**메시지 형식**:
```json
{
  "stream": "btcusdt@ticker",
  "data": {
    "e": "24hrTicker",
    "E": 1609459200000,
    "s": "BTCUSDT",
    "c": "50000.00",
    "o": "49000.00",
    "h": "51000.00",
    "l": "49000.00",
    "v": "12345.67",
    "q": "617283500.00",
    "P": "2.04",
    "p": "1000.00",
    ...
  }
}
```

**주요 필드**:
- `s`: 심볼
- `c`: 현재가 (lastPrice)
- `o`: 시가 (openPrice)
- `h`: 고가 (highPrice)
- `l`: 저가 (lowPrice)
- `v`: 거래량 (volume)
- `P`: 변동률 (priceChangePercent)
- `p`: 변동액 (priceChange)

#### 2. Kline Stream

**형식**: `{symbol}@kline_{interval}`

**예시**: `btcusdt@kline_1m`, `btcusdt@kline_1h`

**메시지 형식**:
```json
{
  "stream": "btcusdt@kline_1m",
  "data": {
    "e": "kline",
    "E": 1609459200000,
    "s": "BTCUSDT",
    "k": {
      "t": 1609459200000,  // openTime
      "T": 1609459260000,  // closeTime
      "s": "BTCUSDT",
      "i": "1m",
      "o": "50000.00",     // open
      "c": "50500.00",     // close
      "h": "51000.00",     // high
      "l": "49000.00",     // low
      "v": "12345.67",     // volume
      "n": 100,
      "x": false,
      "q": "617283500.00",
      ...
    }
  }
}
```

**주요 필드**:
- `k.t`: 캔들 시작 시간 (openTime)
- `k.T`: 캔들 종료 시간 (closeTime)
- `k.o`: 시가 (open)
- `k.c`: 종가 (close)
- `k.h`: 고가 (high)
- `k.l`: 저가 (low)
- `k.v`: 거래량 (volume)
- `k.x`: 캔들 완료 여부 (true: 완료된 캔들)

---

## 에러 처리

### REST API 에러 처리

#### Rate Limit (429)

**응답 헤더**:
```
Retry-After: 60
```

**처리 로직**:
1. `Retry-After` 헤더 확인
2. 해당 시간만큼 대기
3. 최대 3회 재시도

#### 서버 오류 (500)

**응답**:
```json
{
  "error": "Failed to fetch coins"
}
```

**처리 로직**:
1. 에러 메시지 표시
2. 사용자에게 재시도 옵션 제공
3. Degraded Mode로 전환 (선택적)

### WebSocket 에러 처리

#### 연결 실패

**처리 로직**:
1. 지수 백오프로 재연결 시도
2. 최대 10회 재시도
3. 실패 시 Degraded Mode로 전환

#### 메시지 파싱 오류

**처리 로직**:
1. 오류 로깅
2. 해당 메시지 무시
3. 연결 유지

---

## Rate Limit

### Binance API Rate Limit

**REST API**:
- **Weight Limit**: 분당 1200 (IP 기반)
- **Order Rate Limit**: 초당 10회 (API Key 기반)

**WebSocket**:
- 연결 수 제한 없음
- 메시지 수 제한 없음

### 대응 전략

#### 1. API 응답 캐싱

**구현**: `utils/apiCache.ts`

**TTL**: 60초

**효과**: 중복 요청 방지로 Rate Limit 감소

#### 2. 재시도 로직

**구현**: `app/api/coins/route.ts`, `app/api/klines/route.ts`

**전략**:
- `Retry-After` 헤더 감지
- 최대 3회 재시도
- 지수 백오프 적용

#### 3. 배치 요청

**구현**: 단일 요청으로 여러 심볼 조회

**예시**:
```
GET /api/coins?symbols=BTCUSDT,ETHUSDT,SOLUSDT
```

---

## 클라이언트 사용 예시

### REST API 호출

```typescript
// 코인 목록 조회
const response = await fetch('/api/coins');
const coins = await response.json();

// 특정 코인 조회
const response = await fetch('/api/coins?symbols=BTCUSDT,ETHUSDT');
const coins = await response.json();

// Kline 데이터 조회
const response = await fetch(
  '/api/klines?symbol=BTCUSDT&interval=1h&limit=100'
);
const klines = await response.json();
```

### WebSocket 연결

```typescript
// hooks/useBinanceWebSocket.ts 사용
const { status, connect, disconnect } = useBinanceWebSocket({
  symbols: ['BTCUSDT', 'ETHUSDT'],
  onTickerMessage: (message) => {
    // 티커 메시지 처리
  },
  onStatusChange: (status) => {
    // 연결 상태 변경 처리
  },
});
```

---

## 참고 문서

- [아키텍처 문서](./architecture.md)
- [실시간 전략 문서](./realtime-strategy.md)
- [Binance API 공식 문서](https://binance-docs.github.io/apidocs/spot/en/)

