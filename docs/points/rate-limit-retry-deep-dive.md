# Rate Limit 처리 및 재시도 로직 심화 가이드

API 서버의 부하를 줄이고 안정적인 서비스를 만들기 위한 **속도 제한(Rate Limit) 처리**와 **재시도(Retry) 전략**에 대해 다룹니다.

---

## 📚 목차

1. [Rate Limit이란?](#1-rate-limit이란)
2. [HTTP 429 (Too Many Requests)](#2-http-429-too-many-requests)
3. [재시도 전략 (Retry Strategy)](#3-재시도-전략-retry-strategy)
4. [실전 구현 코드 (TypeScript)](#4-실전-구현-코드-typescript)
5. [프론트엔드 UX 고려사항](#5-프론트엔드-ux-고려사항)

---

## 1. Rate Limit이란?

**Rate Limit(속도 제한)**은 서버가 특정 클라이언트(IP 또는 사용자)에게 **"일정 시간 동안 요청할 수 있는 횟수"**를 제한하는 정책입니다.

> **예시**: "1분에 100번까지만 요청해. 그 이상은 안 받아줘."

### 왜 필요한가?
- **서버 보호**: 디도스(DDoS) 공격이나 무한 루프 버그로부터 서버가 다운되는 것을 막습니다.
- **공정한 자원 분배**: 특정 사용자가 서버 자원을 독점하는 것을 방지합니다.

---

## 2. HTTP 429 (Too Many Requests)

Rate Limit을 초과하면 서버는 **HTTP 429 상태 코드**를 응답으로 보냅니다. 이때 가장 중요한 정보는 헤더에 담겨 옵니다.

### 핵심 헤더: `Retry-After`
서버가 "나 지금 바쁘니까 **이만큼 기다렸다가 다시 와**"라고 알려주는 값입니다.

- `Retry-After: 30` -> "30초 뒤에 다시 시도해."
- `Retry-After: Wed, 21 Oct 2025 07:28:00 GMT` -> "이 날짜 이후에 다시 시도해."

> **주의**: 이 헤더를 무시하고 계속 요청하면 **IP 차단(Ban)**을 당할 수 있습니다.

---

## 3. 재시도 전략 (Retry Strategy)

요청이 실패했을 때 무작정 다시 시도하는 것이 아니라, **똑똑하게** 다시 시도해야 합니다.

### 3.1 전략 1: Retry-After 준수 (최우선)
서버가 대기 시간을 알려줬다면, **무조건 그 시간만큼 기다려야 합니다.**

### 3.2 전략 2: 지수 백오프 (Exponential Backoff)
서버가 시간을 안 알려줬거나, 500 에러 등 일시적인 장애인 경우 **점진적으로 대기 시간을 늘려가며** 재시도합니다.
(자세한 내용은 `exponential-backoff-deep-dive.md` 참고)

---

## 4. 실전 구현 코드 (TypeScript)

`fetch`를 감싸서 자동으로 429 에러를 처리하고 재시도하는 유틸리티 함수입니다.

```typescript
// utils/fetchWithRetry.ts

interface RetryOptions {
  retries?: number;      // 최대 재시도 횟수
  backoff?: number;      // 기본 대기 시간 (ms)
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, retryOptions: RetryOptions = {}) {
  const { retries = 3, backoff = 1000 } = retryOptions;

  try {
    const response = await fetch(url, options);

    // ✅ 성공 (200~299)
    if (response.ok) {
      return response;
    }

    // 🚨 429 Too Many Requests 처리
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      let delay = backoff;

      if (retryAfter) {
        // 서버가 시키는 대로 대기 (초 단위라고 가정)
        delay = parseInt(retryAfter, 10) * 1000;
        console.warn(`[Rate Limit] ${delay}ms 대기 후 재시도...`);
      } else {
        // 헤더 없으면 지수 백오프 적용
        delay = backoff * 2; 
      }

      if (retries > 0) {
        await sleep(delay);
        return fetchWithRetry(url, options, { ...retryOptions, retries: retries - 1, backoff: delay });
      }
    }

    // 🚨 5xx 서버 에러 처리 (지수 백오프로 재시도)
    if (response.status >= 500 && retries > 0) {
      const delay = backoff * 2;
      console.warn(`[Server Error] ${delay}ms 대기 후 재시도...`);
      await sleep(delay);
      return fetchWithRetry(url, options, { ...retryOptions, retries: retries - 1, backoff: delay });
    }

    // 재시도 횟수 소진 또는 4xx 에러 (429 제외)
    throw new Error(`Request failed: ${response.status}`);

  } catch (error) {
    // 네트워크 에러 등 아예 요청이 안 간 경우도 재시도 가능
    if (retries > 0) {
      const delay = backoff * 2;
      await sleep(delay);
      return fetchWithRetry(url, options, { ...retryOptions, retries: retries - 1, backoff: delay });
    }
    throw error;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 사용 예시
```typescript
// 429 에러가 나면 알아서 기다렸다가 재시도함
const response = await fetchWithRetry('https://api.binance.com/api/v3/ticker/24hr');
```

---

## 5. 프론트엔드 UX 고려사항

재시도 로직이 돌고 있는 동안 사용자는 "왜 안 되지?" 하고 답답해할 수 있습니다. 이를 해결하기 위한 3가지 UX 패턴입니다.

### 5.1 낙관적 업데이트 (Optimistic UI) - "성공한 척하기"
사용자가 버튼을 누르자마자 **서버 응답을 기다리지 않고 일단 성공한 것처럼 화면을 바꿉니다.**
- **예시**: 인스타그램 '좋아요' 하트. 누르면 바로 빨간색 되고, 나중에 실패하면 그때 슬그머니 취소함.
- **효과**: 사용자는 앱이 엄청 빠르다고 느낍니다. (실제로는 뒤에서 재시도 중일지라도)

### 5.2 진행 상태 표시 (Feedback) - "열심히 일하는 중"
재시도 중이라는 걸 숨기지 않고, **"노력 중"**이라는 걸 보여줍니다.
- **예시**:
  - "연결이 불안정하여 재접속 중입니다... (1/3)"
  - "잠시만 기다려주세요. 데이터를 불러오는 중입니다." (스피너 유지)
- **효과**: 멈춘 게 아니라 뭔가 하고 있다는 걸 알면 사용자는 조금 더 인내심을 갖습니다.

### 5.3 백그라운드 동기화 (Background Sync) - "나중에 알려줄게"
당장 결과가 필요 없는 작업(예: 로그 전송, 글 임시 저장)이라면, **사용자에게는 "저장됨"이라고 띄우고 뒤에서 몰래 재시도**합니다.
- **예시**: 노션(Notion)이나 구글 닥스. 인터넷 끊겨도 계속 글 써지고, 연결되면 알아서 저장됨.
- **효과**: 사용자는 네트워크 상태를 신경 쓸 필요가 없습니다.

> **Tip**: 현재 프로젝트(대시보드)라면 **5.2번(상태 표시)**이 가장 적절합니다. "실시간 시세 연결 중..." 같은 토스트 메시지를 띄워주면 좋습니다.

---

## 🎯 요약

1.  **Rate Limit**: 서버 보호를 위한 요청 횟수 제한.
2.  **HTTP 429**: 제한 초과 시 받는 에러 코드.
3.  **Retry-After**: 서버가 알려주는 "대기 시간". (무조건 준수!)
4.  **전략**: `Retry-After`가 있으면 그거 따르고, 없으면 **지수 백오프**로 눈치껏 재시도.
