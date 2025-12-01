# 실시간 데이터와 과거 데이터 병합 전략 딥다이브

차트 구현 과정에서 REST API로 가져온 과거 데이터와 WebSocket으로 받는 실시간 데이터를 시간 기준으로 병합하여 끊김 없는 차트를 구현했습니다. 이 문서는 실시간 데이터와 과거 데이터를 효율적으로 병합하는 전략과 구현 방법을 상세히 설명합니다.

---

## 1. 문제 상황

### 1.1 왜 병합이 필요한가?

실시간 차트를 구현할 때 다음과 같은 문제가 발생합니다:

1. **초기 데이터**: REST API로 과거 500개 캔들 가져오기
2. **실시간 업데이트**: WebSocket으로 현재 진행 중인 캔들 업데이트
3. **새 캔들 생성**: 새로운 시간대가 시작되면 새 캔들 추가

**문제점:**
- 과거 데이터와 실시간 데이터를 어떻게 병합할까?
- 같은 시간대의 캔들은 어떻게 업데이트할까?
- 새로운 시간대의 캔들은 어떻게 추가할까?

### 1.2 데이터 소스 비교

| 데이터 소스 | 특징 | 용도 |
| :--- | :--- | :--- |
| **REST API** | 과거 데이터, 한 번에 많은 데이터 가져오기 | 초기 차트 로드 |
| **WebSocket** | 실시간 데이터, 지속적인 업데이트 | 실시간 차트 업데이트 |

---

## 2. 병합 전략

### 2.1 핵심 원칙

**시간 기준 병합**: `openTime`을 기준으로 기존 캔들을 업데이트하거나 새 캔들을 추가합니다.

```
과거 데이터: [캔들1, 캔들2, ..., 캔들500]
                ↓
실시간 데이터: 캔들500 업데이트 → 캔들501 추가
                ↓
병합 결과: [캔들1, 캔들2, ..., 캔들500(업데이트), 캔들501]
```

### 2.2 두 가지 시나리오

#### 시나리오 1: 기존 캔들 업데이트
- 현재 진행 중인 1분봉의 가격이 실시간으로 변동
- 같은 `openTime`을 가진 캔들이 이미 존재
- → 기존 캔들 업데이트

#### 시나리오 2: 새 캔들 추가
- 새로운 1분봉이 시작됨
- 해당 `openTime`을 가진 캔들이 없음
- → 새 캔들 추가 후 시간 순서대로 정렬

---

## 3. 구현 코드

### 3.1 전체 구현

```typescript
// app/chart/ChartClient.tsx

/**
 * 실시간 Kline 데이터를 차트 데이터에 병합
 * openTime 기준으로 기존 캔들 업데이트 또는 새 캔들 추가
 */
const updateChartDataWithRealtimeKline = useCallback((kline: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}) => {
  setChartData((prevData) => {
    const newData = [...prevData];
    const klineTime = kline.openTime / 1000; // 밀리초 → 초 변환
    
    // openTime으로 기존 캔들 찾기
    const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
    
    const candlestickData = convertKlineToCandlestickFromKline(kline);
    
    if (existingIndex >= 0) {
      // 기존 캔들 업데이트 (실시간으로 가격이 변동 중)
      newData[existingIndex] = candlestickData;
    } else {
      // 새 캔들 추가 (새로운 시간대 시작)
      newData.push(candlestickData);
      newData.sort((a, b) => (a.time as number) - (b.time as number));
    }
    
    chartDataRef.current = newData;
    return newData;
  });
}, []);
```

### 3.2 단계별 설명

#### 1단계: 시간 변환

```typescript
const klineTime = kline.openTime / 1000; // 밀리초 → 초 변환
```

**이유:**
- Binance API는 밀리초 단위 타임스탬프 사용
- Lightweight Charts는 초 단위 타임스탬프 사용
- 변환 필요

#### 2단계: 기존 캔들 검색

```typescript
const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
```

**동작:**
- `openTime`을 기준으로 기존 캔들 검색
- 정확한 시간 매칭으로 중복 방지
- `findIndex`로 인덱스 반환 (없으면 -1)

#### 3단계: 업데이트 vs 추가 결정

```typescript
if (existingIndex >= 0) {
  // 기존 캔들 업데이트
  newData[existingIndex] = candlestickData;
} else {
  // 새 캔들 추가
  newData.push(candlestickData);
  newData.sort((a, b) => (a.time as number) - (b.time as number));
}
```

**로직:**
- `existingIndex >= 0`: 기존 캔들 존재 → 업데이트
- `existingIndex === -1`: 기존 캔들 없음 → 추가 후 정렬

---

## 4. 핵심 패턴 분석

### 4.1 시간 기준 매칭

```typescript
const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
```

**왜 `findIndex`를 사용할까?**

| 메서드 | 반환값 | 용도 |
| :--- | :--- | :--- |
| `find` | 요소 자체 | 요소가 필요한 경우 |
| `findIndex` | 인덱스 | 요소를 업데이트해야 하는 경우 |
| `some` | boolean | 존재 여부만 확인 |

**이 경우:**
- 인덱스가 필요 (배열에서 직접 업데이트)
- `findIndex`가 적합

### 4.2 불변성 유지

```typescript
const newData = [...prevData]; // 새 배열 생성
newData[existingIndex] = candlestickData; // 업데이트
return newData; // 새 배열 반환
```

**React 상태 업데이트 원칙:**
- 기존 배열을 직접 수정하지 않음
- 새 배열을 생성하여 반환
- 불변성 유지로 React가 변경 감지

### 4.3 시간 순서 정렬

```typescript
newData.sort((a, b) => (a.time as number) - (b.time as number));
```

**왜 정렬이 필요한가?**

1. **차트 라이브러리 요구사항**: Lightweight Charts는 시간 순서대로 정렬된 데이터를 요구
2. **새 캔들 삽입**: 새 캔들이 중간에 삽입될 수 있음
3. **시각적 정확성**: 시간 순서가 맞지 않으면 차트가 깨짐

**예시:**
```
정렬 전: [캔들1, 캔들2, 캔들501, 캔들3, ...] // 새 캔들이 중간에 삽입됨
정렬 후: [캔들1, 캔들2, 캔들3, ..., 캔들501] // 시간 순서대로 정렬
```

---

## 5. 데이터 흐름 시각화

### 5.1 전체 흐름

```
1. 초기 로드 (REST API)
   ↓
   [캔들1, 캔들2, ..., 캔들500]
   ↓
2. WebSocket 연결 및 구독
   ↓
3. 실시간 데이터 수신
   ↓
4. 병합 로직 실행
   ├─ 기존 캔들? → 업데이트
   └─ 새 캔들? → 추가 후 정렬
   ↓
5. 차트 업데이트
```

### 5.2 시나리오별 동작

#### 시나리오 A: 현재 캔들 업데이트

```
초기 상태: [..., 캔들500(10:00, $50000)]
                ↓
실시간 데이터: 캔들500(10:00, $50100) // 같은 openTime
                ↓
병합 결과: [..., 캔들500(10:00, $50100)] // 업데이트
```

#### 시나리오 B: 새 캔들 추가

```
초기 상태: [..., 캔들500(10:00, $50000)]
                ↓
실시간 데이터: 캔들501(10:01, $50100) // 새로운 openTime
                ↓
병합 결과: [..., 캔들500(10:00, $50000), 캔들501(10:01, $50100)] // 추가
```

---

## 6. 성능 최적화

### 6.1 불필요한 정렬 방지

```typescript
if (existingIndex >= 0) {
  // 기존 캔들 업데이트 → 정렬 불필요
  newData[existingIndex] = candlestickData;
} else {
  // 새 캔들 추가 → 정렬 필요
  newData.push(candlestickData);
  newData.sort((a, b) => (a.time as number) - (b.time as number));
}
```

**최적화:**
- 기존 캔들 업데이트 시 정렬 생략 (이미 정렬되어 있음)
- 새 캔들 추가 시에만 정렬 수행

### 6.2 Ref를 통한 최신 데이터 보장

```typescript
chartDataRef.current = newData;
return newData;
```

**이유:**
- `setState`는 비동기이므로 즉시 반영되지 않을 수 있음
- `ref`에 저장하여 최신 데이터 보장
- WebSocket 콜백에서 최신 데이터 접근 가능

### 6.3 useCallback으로 함수 메모이제이션

```typescript
const updateChartDataWithRealtimeKline = useCallback((kline: {...}) => {
  // ...
}, []); // 의존성 없음
```

**장점:**
- 함수가 매번 재생성되지 않음
- 의존성 체인 안정화
- 성능 최적화

---

## 7. 실무 팁과 주의사항

### 7.1 타임스탬프 단위 통일

```typescript
// ❌ 잘못된 예: 단위 불일치
const klineTime = kline.openTime; // 밀리초
const existingIndex = newData.findIndex((candle) => candle.time === klineTime); // 초

// ✅ 올바른 예: 단위 통일
const klineTime = kline.openTime / 1000; // 밀리초 → 초 변환
const existingIndex = newData.findIndex((candle) => candle.time === klineTime); // 초
```

**주의:**
- Binance API: 밀리초
- Lightweight Charts: 초
- 변환 필수

### 7.2 중복 방지

```typescript
const existingIndex = newData.findIndex((candle) => candle.time === klineTime);

if (existingIndex >= 0) {
  // 기존 캔들 업데이트 (중복 방지)
  newData[existingIndex] = candlestickData;
}
```

**이유:**
- 같은 `openTime`의 캔들이 여러 번 들어올 수 있음
- 중복 방지로 데이터 정합성 보장

### 7.3 시간 순서 보장

```typescript
newData.sort((a, b) => (a.time as number) - (b.time as number));
```

**중요:**
- 차트 라이브러리는 시간 순서를 요구
- 정렬하지 않으면 차트가 깨짐
- 새 캔들 추가 시 반드시 정렬

### 7.4 네트워크 지연 고려

```typescript
// WebSocket 메시지가 순서대로 오지 않을 수 있음
// 예: 캔들501이 캔들500보다 먼저 도착
// → 정렬로 해결
```

**대응:**
- 정렬로 순서 보장
- `openTime` 기준으로 정확한 위치 결정

---

## 8. 일반적인 실수와 해결 방법

### 8.1 실수 1: 타임스탬프 단위 불일치

```typescript
// ❌ 잘못된 예
const klineTime = kline.openTime; // 밀리초
const existingIndex = newData.findIndex((candle) => candle.time === klineTime); // 초와 비교

// ✅ 올바른 예
const klineTime = kline.openTime / 1000; // 초로 변환
const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
```

### 8.2 실수 2: 정렬 누락

```typescript
// ❌ 잘못된 예
if (existingIndex === -1) {
  newData.push(candlestickData); // 정렬 없음
}

// ✅ 올바른 예
if (existingIndex === -1) {
  newData.push(candlestickData);
  newData.sort((a, b) => (a.time as number) - (b.time as number)); // 정렬 필수
}
```

### 8.3 실수 3: 불변성 위반

```typescript
// ❌ 잘못된 예
prevData[existingIndex] = candlestickData; // 기존 배열 직접 수정
return prevData;

// ✅ 올바른 예
const newData = [...prevData]; // 새 배열 생성
newData[existingIndex] = candlestickData;
return newData;
```

---

## 9. 프로젝트 적용 사례

### 9.1 ChartClient 컴포넌트

**문제:**
- REST API로 가져온 과거 데이터와 WebSocket 실시간 데이터를 병합해야 함
- 같은 시간대의 캔들은 업데이트, 새로운 시간대는 추가해야 함

**해결:**
- `openTime` 기준으로 기존 캔들 검색
- 존재하면 업데이트, 없으면 추가 후 정렬
- `useCallback`으로 함수 메모이제이션

**결과:**
- 끊김 없는 실시간 차트 구현
- 데이터 정합성 보장
- 성능 최적화

### 9.2 성능 개선 효과

| 항목 | 최적화 전 | 최적화 후 |
| :--- | :--- | :--- |
| 정렬 횟수 | 매번 정렬 | 필요 시만 정렬 |
| 함수 재생성 | 매 렌더링마다 | useCallback으로 메모이제이션 |
| 데이터 정합성 | 불안정 | 안정적 |

---

## 10. 확장 가능한 패턴

### 10.1 여러 데이터 소스 병합

```typescript
// 여러 WebSocket 스트림 병합
const updateChartData = useCallback((kline: Kline) => {
  setChartData((prevData) => {
    // 병합 로직
  });
}, []);

// 여러 소스에서 호출
wsClient1.onMessage((kline) => updateChartData(kline));
wsClient2.onMessage((kline) => updateChartData(kline));
```

### 10.2 배치 업데이트

```typescript
// 여러 캔들을 한 번에 업데이트
const updateChartDataBatch = useCallback((klines: Kline[]) => {
  setChartData((prevData) => {
    const newData = [...prevData];
    
    klines.forEach((kline) => {
      const klineTime = kline.openTime / 1000;
      const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
      
      if (existingIndex >= 0) {
        newData[existingIndex] = convertKline(kline);
      } else {
        newData.push(convertKline(kline));
      }
    });
    
    newData.sort((a, b) => (a.time as number) - (b.time as number));
    return newData;
  });
}, []);
```

### 10.3 타임스탬프 범위 필터링

```typescript
// 특정 시간 범위의 캔들만 유지
const updateChartData = useCallback((kline: Kline) => {
  setChartData((prevData) => {
    const newData = [...prevData];
    // 병합 로직
    
    // 오래된 캔들 제거 (최근 500개만 유지)
    const maxAge = Date.now() / 1000 - 500 * 60; // 500분 전
    return newData.filter((candle) => (candle.time as number) >= maxAge);
  });
}, []);
```

---

## 11. 학습 체크리스트

### 기본 개념
- [ ] 실시간 데이터와 과거 데이터 병합의 필요성 이해
- [ ] 시간 기준 매칭 원리 이해
- [ ] 업데이트 vs 추가 결정 로직 이해

### 실무 적용
- [ ] 타임스탬프 단위 통일
- [ ] 불변성 유지
- [ ] 시간 순서 정렬
- [ ] useCallback으로 성능 최적화

### 고급 활용
- [ ] 여러 데이터 소스 병합
- [ ] 배치 업데이트
- [ ] 타임스탬프 범위 필터링

---

## 12. 참고 자료

### 공식 문서
- [Binance WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-data)
- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)

### 관련 학습 포인트
- [실시간 데이터와 과거 데이터 병합 전략](./learning-points.md#17-실시간-데이터와-과거-데이터-병합-전략)
- [데이터 간격 감지 및 메우기](./learning-points.md#18-데이터-간격-감지-및-메우기-data-gap-handling)
- [useCallback을 활용한 함수 메모이제이션](./learning-points.md#21-usecallback을-활용한-함수-메모이제이션-및-의존성-체인-관리)

---

## 13. 요약

### 핵심 원칙

1. **시간 기준 병합**: `openTime`을 기준으로 기존 캔들 검색
2. **업데이트 vs 추가**: 존재하면 업데이트, 없으면 추가 후 정렬
3. **불변성 유지**: 새 배열 생성하여 반환
4. **성능 최적화**: 필요 시에만 정렬, useCallback으로 메모이제이션

### 실무 팁

- 타임스탬프 단위 통일 (밀리초 → 초)
- 중복 방지로 데이터 정합성 보장
- 시간 순서 정렬 필수
- 네트워크 지연 고려

### 학습 가치

- **데이터 정합성**: 시간 기준으로 정확한 병합
- **성능 최적화**: 불필요한 재정렬 최소화
- **실시간 업데이트**: 끊김 없는 차트 표시
- **상태 관리**: React 상태와 외부 차트 라이브러리 동기화

이러한 패턴을 이해하고 적용하면, 실시간 데이터와 과거 데이터를 효율적으로 병합하는 고성능 차트를 구축할 수 있습니다.

