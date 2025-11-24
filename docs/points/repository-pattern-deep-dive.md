# 리포지토리 패턴 (Repository Pattern) 심화 가이드

프론트엔드 개발에서 비즈니스 로직과 데이터 접근 로직을 분리하여 유지보수성을 높이는 **리포지토리 패턴**에 대해 다룹니다.

---

## 📚 목차

1. [리포지토리 패턴이란?](#1-리포지토리-패턴이란)
2. [왜 필요한가? (문제 상황)](#2-왜-필요한가-문제-상황)
3. [핵심 원리](#3-핵심-원리)
4. [실전 구현 코드 (TypeScript)](#4-실전-구현-코드-typescript)
5. [프론트엔드 활용 사례](#5-프론트엔드-활용-사례)
6. [장점과 단점](#6-장점과-단점)

---

## 1. 리포지토리 패턴이란?

**리포지토리 패턴(Repository Pattern)**은 데이터가 어디에 있는지(API, DB, LocalStorage 등)를 숨기고, 마치 **메모리에 있는 컬렉션(배열 등)을 다루듯이** 데이터를 조회하고 저장할 수 있게 해주는 디자인 패턴입니다.

> "비즈니스 로직에게 **데이터의 출처를 비밀로 하는 심부름꾼**입니다."

---

## 2. 왜 필요한가? (문제 상황)

### 상황: "API가 아니라 Firebase로 바꿔야 해요!"

컴포넌트 안에서 직접 `fetch`나 `axios`를 쓰고 있다고 가정해 봅시다.

**[나쁜 예: 컴포넌트가 API를 직접 호출]**
```typescript
// UserProfile.tsx
useEffect(() => {
  // 컴포넌트가 "데이터 가져오는 법(axios)"을 너무 잘 알고 있음
  axios.get('/api/users/1').then(setUser);
}, []);
```

만약 백엔드가 사라지고 Firebase나 Supabase로 바뀐다면?
- `UserProfile.tsx` 뿐만 아니라, `axios`를 쓰는 **모든 컴포넌트를 다 뜯어고쳐야 합니다.**

**[좋은 예: 리포지토리 사용]**
```typescript
// UserProfile.tsx
useEffect(() => {
  // "어디서" 가져오는지는 모름. 그냥 달라고 함.
  userRepository.getUser(1).then(setUser);
}, []);
```
- 나중에 Firebase로 바뀌어도 **리포지토리 파일 하나만 수정**하면 됩니다. 컴포넌트는 건드릴 필요가 없습니다.

---

## 3. 핵심 원리

1.  **DataSource (데이터 원본)**: 실제 API, DB, LocalStorage 등.
2.  **Repository (중개자)**: DataSource에 접근해서 데이터를 가져오고, 필요하면 가공(Adapter 사용)해서 줌.
3.  **Domain/UI (사용자)**: Repository에게 데이터만 요청함. 출처는 모름.

---

## 4. 실전 구현 코드 (TypeScript)

이 프로젝트(`realtime-crypto-dashboard`)에 적용 가능한 예시입니다.

### 4.1 인터페이스 정의 (계약서)

먼저 "어떤 기능을 제공할지" 약속합니다. 구현체는 나중에 바뀔 수 있어도 이 약속은 변하지 않습니다.

```typescript
// repositories/tickerRepository.ts
import { Ticker } from '../types';

export interface TickerRepository {
  getAllTickers(): Promise<Ticker[]>;
  getTickerBySymbol(symbol: string): Promise<Ticker | null>;
}
```

### 4.2 구현체 (API 버전)

실제 API를 호출하는 구현체입니다.

```typescript
// repositories/tickerRepositoryImpl.ts
import { TickerRepository } from './tickerRepository';
import { adaptBinanceTicker } from '../adapters/binance';

export class ApiTickerRepository implements TickerRepository {
  async getAllTickers(): Promise<Ticker[]> {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await response.json();
    
    // 여기서 어댑터 패턴과 결합!
    return data.map(adaptBinanceTicker);
  }

  async getTickerBySymbol(symbol: string): Promise<Ticker | null> {
    // ... 구현 ...
    return null;
  }
}
```

### 4.3 구현체 (Mock 버전 - 테스트용)

API가 아직 안 만들어졌거나 테스트할 때 쓰는 가짜 구현체입니다.

```typescript
// repositories/mockTickerRepository.ts
export class MockTickerRepository implements TickerRepository {
  async getAllTickers(): Promise<Ticker[]> {
    return [
      { symbol: 'BTCUSDT', price: 50000, priceChange: 2.5, volume: 1000 },
      { symbol: 'ETHUSDT', price: 3000, priceChange: -1.2, volume: 500 },
    ];
  }
  // ...
}
```

---

## 5. 프론트엔드 활용 사례

### 5.1 API 클라이언트 추상화
`axios`, `fetch`, `graphql` 등 통신 라이브러리가 바뀌어도 리포지토리만 수정하면 됩니다.

### 5.2 테스트 용이성 (Testing)
컴포넌트 테스트를 할 때 실제 API를 호출하면 느리고 불안정합니다. 이때 `MockRepository`를 주입해주면 **네트워크 없이도 UI 테스트**를 빠르게 할 수 있습니다.

### 5.3 캐싱 전략 숨기기
```typescript
class CachedUserRepository implements UserRepository {
  private cache = new Map();

  async getUser(id: string) {
    if (this.cache.has(id)) {
      return this.cache.get(id); // 캐시된 거 줌
    }
    
    const user = await api.getUser(id); // 없으면 API 호출
    this.cache.set(id, user);
    return user;
  }
}
```
컴포넌트는 캐싱이 되는지 안 되는지 몰라도 됩니다. 그냥 `getUser`만 호출하면 알아서 최적화된 데이터를 받습니다.

---

## 6. 장점과 단점

### ✅ 장점
1.  **결합도 감소**: UI 컴포넌트가 데이터 소스(API)에 의존하지 않습니다.
2.  **테스트 용이**: 가짜(Mock) 데이터로 갈아끼우기가 너무 쉽습니다.
3.  **중복 제거**: API 호출 로직이 여러 컴포넌트에 흩어지지 않고 한곳에 모입니다.

### ❌ 단점
1.  **코드량 증가**: 인터페이스 만들고, 클래스 만들고... 파일이 많아집니다.
2.  **오버 엔지니어링**: 아주 간단한 토이 프로젝트에서는 그냥 `fetch` 쓰는 게 더 빠를 수 있습니다.

---

## 🎯 요약

1.  **리포지토리 패턴**: 데이터 접근 로직을 추상화하는 **창고지기**.
2.  **목적**: 비즈니스 로직과 데이터 소스(API/DB)의 **분리**.
3.  **구조**: `UI` -> `Repository Interface` <- `Repository Implementation` -> `Data Source`
4.  **팁**: **어댑터 패턴**과 함께 쓰면 더욱 강력합니다. (리포지토리 내부에서 어댑터로 데이터 변환)
