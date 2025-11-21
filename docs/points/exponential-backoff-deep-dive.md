# 지수 백오프 (Exponential Backoff) 심화 가이드

네트워크 통신과 재시도 로직에서 필수적인 **지수 백오프(Exponential Backoff)** 전략에 대해 깊이 있게 다룹니다.

---

## 📚 목차

1. [지수 백오프란?](#1-지수-백오프란)
2. [왜 필요한가? (Thundering Herd 문제)](#2-왜-필요한가-thundering-herd-문제)
3. [핵심 알고리즘](#3-핵심-알고리즘)
4. [Jitter(지터)의 중요성](#4-jitter지터의-중요성)
5. [실전 구현 코드 (TypeScript)](#5-실전-구현-코드-typescript)
6. [프론트엔드 활용 사례](#6-프론트엔드-활용-사례)

---

## 1. 지수 백오프란?

**지수 백오프(Exponential Backoff)**는 요청이 실패했을 때, 다음 재시도까지의 대기 시간을 **지수적(Exponential)**으로 늘려가는 전략입니다.

쉽게 말해:
- 첫 번째 실패: 1초 대기
- 두 번째 실패: 2초 대기
- 세 번째 실패: 4초 대기
- 네 번째 실패: 8초 대기
- ...

> "실패할수록 더 오래 기다렸다가 다시 시도한다."

---

## 2. 왜 필요한가? (Thundering Herd 문제)

### 2.1 서버가 죽었을 때의 시나리오

사용자가 10만 명인 서비스의 서버가 일시적으로 다운되었다고 가정해 봅시다.

**[나쁜 예: 고정 대기 시간]**
모든 클라이언트가 "어? 안 되네? 1초 뒤에 다시 해봐야지"라고 생각합니다.
1. 서버 다운
2. 1초 뒤: 10만 명이 동시에 접속 시도 -> 서버 부하로 다시 다운
3. 또 1초 뒤: 10만 명이 또 동시에 접속 시도 -> 서버 영원히 복구 불가

이처럼 수많은 클라이언트가 동시에 서버를 공격하듯 몰려드는 현상을 **Thundering Herd(성난 들소 떼)** 문제라고 합니다.

**[좋은 예: 지수 백오프]**
클라이언트마다 대기 시간이 빠르게 늘어납니다.
1. A 사용자: 1초 뒤 재시도
2. B 사용자: 2초 뒤 재시도
3. C 사용자: 4초 뒤 재시도
...
요청이 시간차를 두고 분산되므로 서버가 숨 쉴 틈이 생깁니다.

---

## 3. 핵심 알고리즘

기본 공식은 다음과 같습니다:

$$
Delay = BaseDelay \times 2^{Attempt}
$$

- `BaseDelay`: 기본 대기 시간 (예: 1000ms)
- `Attempt`: 재시도 횟수 (0, 1, 2...)
- `MaxDelay`: 최대 대기 시간 (예: 30초, 무한히 늘어나는 것 방지)

### 예시 테이블 (Base: 1초, Max: 30초)

| 시도 횟수 | 계산된 대기 시간 | 실제 적용 시간 (Max 제한) |
| :--- | :--- | :--- |
| 1회차 | $1 \times 2^0 = 1$초 | 1초 |
| 2회차 | $1 \times 2^1 = 2$초 | 2초 |
| 3회차 | $1 \times 2^2 = 4$초 | 4초 |
| 4회차 | $1 \times 2^3 = 8$초 | 8초 |
| 5회차 | $1 \times 2^4 = 16$초 | 16초 |
| 6회차 | $1 \times 2^5 = 32$초 | **30초** (Max 제한) |

---

## 4. Jitter(지터)의 중요성

지수 백오프만으로는 부족할 때가 있습니다. 만약 서버가 정확히 12:00:00에 다운됐고, 모든 클라이언트가 똑같은 알고리즘을 쓴다면?
모두가 정확히 1초 뒤, 2초 뒤, 4초 뒤에 **동시에** 재시도하게 됩니다. (동기화된 재시도)

이를 막기 위해 **무작위 값(Randomness)**을 섞는데, 이를 **Jitter(지터)**라고 합니다.

$$
Delay = (BaseDelay \times 2^{Attempt}) + Random(-100, 100)
$$

이제 누군가는 1.1초, 누군가는 0.9초 뒤에 시도하게 되어 요청이 완벽하게 분산됩니다.

---

## 5. 실전 구현 코드 (TypeScript)

이 프로젝트(`lib/websocket/binanceWebSocket.ts`)에 실제로 적용된 코드입니다.

```typescript
interface BackoffConfig {
  baseDelay: number;  // 초기 대기 시간 (ms)
  maxDelay: number;   // 최대 대기 시간 (ms)
  jitter: number;     // 랜덤 범위 비율 (0.2 = ±20%)
}

function getReconnectDelay(attempt: number, config: BackoffConfig): number {
  const { baseDelay, maxDelay, jitter } = config;
  
  // 1. 지수적 증가 계산 (2^n)
  let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  // 2. 지터(랜덤성) 추가
  // 예: delay가 1000ms이고 jitter가 0.2라면, ±200ms 범위의 랜덤 값 추가
  const randomFactor = 1 + (Math.random() * 2 - 1) * jitter;
  
  return Math.floor(delay * randomFactor);
}

// 사용 예시
const config = { baseDelay: 1000, maxDelay: 30000, jitter: 0.2 };

console.log(getReconnectDelay(0, config)); // 약 1000ms (800 ~ 1200)
console.log(getReconnectDelay(1, config)); // 약 2000ms (1600 ~ 2400)
console.log(getReconnectDelay(2, config)); // 약 4000ms (3200 ~ 4800)
```

### 재사용 가능한 유틸리티 함수 만들기

```typescript
async function fetchWithBackoff(
  fn: () => Promise<any>, 
  retries = 5
) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      // 마지막 시도였으면 에러 던짐
      if (i === retries - 1) throw error;
      
      // 대기 시간 계산
      const delay = getReconnectDelay(i, { 
        baseDelay: 1000, 
        maxDelay: 10000, 
        jitter: 0.2 
      });
      
      console.log(`${delay}ms 후 재시도합니다...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 6. 프론트엔드 활용 사례

### 6.1 WebSocket 재연결 (가장 흔함)
채팅, 주식 차트 등 연결이 끊어졌을 때 서버에 부담을 주지 않고 조용히 다시 연결할 때 사용합니다.

### 6.2 API 폴링 (Polling)
"결제 완료됐나요?"라고 서버에 계속 물어볼 때, 처음에는 1초마다 묻다가 응답이 없으면 2초, 4초, 10초... 간격을 늘려서 묻습니다.

### 6.3 이미지 로드 실패 재시도
CDN 문제로 이미지가 깨졌을 때, 엑박(X)을 띄우기 전에 1~2번 정도 텀을 두고 다시 로드해볼 수 있습니다.

### 6.4 낙관적 업데이트 실패 시 롤백
사용자가 '좋아요'를 눌렀는데 서버 요청이 실패했을 때, 바로 에러를 띄우기보다 백그라운드에서 몇 번 더 조용히 재시도해보고 진짜 안 되면 그때 롤백합니다.

---

## 🎯 요약

1. **지수 백오프**: 실패할수록 대기 시간을 2배씩 늘리는 전략
2. **목적**: 서버 폭주(Thundering Herd) 방지 및 네트워크 효율성 증대
3. **Jitter**: 대기 시간에 랜덤 값을 섞어 클라이언트들의 동시 접속을 분산시킴
4. **필수 역량**: 안정적인 대규모 서비스를 만들기 위한 프론트엔드 개발자의 필수 지식
