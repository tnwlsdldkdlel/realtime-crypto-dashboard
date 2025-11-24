# Web Worker 심화 가이드

Web Worker를 활용하여 메인 스레드의 부하를 줄이고 애플리케이션 성능을 극대화하는 방법을 다룹니다.

---

## 📚 목차

1. [Web Worker란?](#1-web-worker란)
2. [왜 필요한가? (싱글 스레드의 한계)](#2-왜-필요한가-싱글-스레드의-한계)
3. [기본 사용법](#3-기본-사용법)
4. [실무 활용 패턴](#4-실무-활용-패턴)
5. [주의사항 및 한계](#5-주의사항-및-한계)
6. [React에서 Web Worker 사용하기](#6-react에서-web-worker-사용하기)

---

## 1. Web Worker란?

Web Worker는 브라우저의 메인 스레드(UI 스레드)와 별개로 **백그라운드 스레드**에서 스크립트를 실행할 수 있게 해주는 기술입니다.

### 핵심 특징
- **병렬 처리**: 메인 스레드를 방해하지 않고 무거운 작업을 동시에 수행
- **독립성**: 별도의 전역 컨텍스트(`Self`)를 가짐 (window 객체 접근 불가)
- **메시지 통신**: 메인 스레드와 `postMessage`를 통해 데이터를 주고받음

---

## 2. 왜 필요한가? (싱글 스레드의 한계)

자바스크립트는 기본적으로 **싱글 스레드(Single Thread)** 언어입니다. 즉, 한 번에 한 가지 일만 처리할 수 있습니다.

### 문제 상황: "화면이 멈췄어요!"
```javascript
// 메인 스레드에서 무거운 작업 수행
function heavyTask() {
  let sum = 0;
  // 100억 번 루프 -> CPU 점유율 100%
  for (let i = 0; i < 10000000000; i++) {
    sum += i;
  }
  return sum;
}

button.addEventListener('click', () => {
  heavyTask(); // 실행되는 동안 버튼 클릭, 애니메이션, 스크롤 등 모든 UI가 멈춤 (Freezing)
});
```

### 해결: Web Worker로 작업 위임
무거운 작업(계산)은 Worker에게 맡기고, 메인 스레드는 사용자의 클릭이나 애니메이션 처리에만 집중합니다.

---

## 3. 기본 사용법

### 3.1 워커 생성 및 통신

**main.js (메인 스레드)**
```javascript
// 1. 워커 생성
const worker = new Worker('worker.js');

// 2. 워커에게 데이터 전송 (일 시키기)
worker.postMessage({ type: 'CALCULATE', payload: 1000000 });

// 3. 워커로부터 결과 수신
worker.onmessage = function(e) {
  console.log('계산 결과:', e.data);
};

// 4. 에러 처리
worker.onerror = function(error) {
  console.error('워커 에러:', error);
};
```

**worker.js (백그라운드 스레드)**
```javascript
// 1. 메시지 수신 대기
self.onmessage = function(e) {
  const { type, payload } = e.data;

  if (type === 'CALCULATE') {
    // 2. 무거운 작업 수행
    const result = performHeavyCalculation(payload);
    
    // 3. 결과 반환
    self.postMessage(result);
  }
};

function performHeavyCalculation(count) {
  let result = 0;
  for(let i = 0; i < count; i++) result += i;
  return result;
}
```

---

## 4. 실무 활용 패턴

### 4.1 대용량 데이터 처리 (엑셀/CSV 파싱)
수만 줄의 엑셀 파일을 업로드하고 파싱할 때 메인 스레드에서 하면 브라우저가 멈춥니다.

```javascript
// worker.js
importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

self.onmessage = (e) => {
  const fileData = e.data;
  const workbook = XLSX.read(fileData, { type: 'array' });
  // ... 파싱 로직 ...
  self.postMessage(parsedData);
};
```

### 4.2 이미지 프로세싱
이미지 필터 적용, 리사이징, 압축 등의 작업은 CPU를 많이 사용합니다.

```javascript
// worker.js
self.onmessage = (e) => {
  const { imageData } = e.data; // Pixel Data (Uint8ClampedArray)
  
  // 픽셀 하나하나 순회하며 흑백 처리
  for (let i = 0; i < imageData.data.length; i += 4) {
    const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    imageData.data[i] = avg;     // R
    imageData.data[i + 1] = avg; // G
    imageData.data[i + 2] = avg; // B
  }
  
  self.postMessage({ imageData }, [imageData.data.buffer]); // Transferable Object로 전송 (복사 비용 0)
};
```
> **Tip**: `Transferable Object`를 사용하면 데이터를 복사하지 않고 소유권만 넘겨주므로 대용량 데이터 전송 속도가 매우 빠릅니다.

### 4.3 실시간 데이터 정렬/필터링
암호화폐 대시보드처럼 초당 수백 개의 데이터가 들어올 때, 정렬과 필터링을 워커에서 수행합니다.

### 4.4 [실제 프로젝트 적용] WebSocket 데이터 파싱 및 정렬

이 프로젝트(`realtime-crypto-dashboard`)에서는 **초당 수백 건의 티커 데이터**가 WebSocket을 통해 들어옵니다. 이를 메인 스레드에서 직접 파싱하고 정렬하면 UI가 버벅거릴 수 있습니다.

따라서 다음과 같이 Web Worker를 도입하여 데이터 처리를 분리했습니다.

**1. Worker 코드 (`workers/tickerWorker.ts`)**
```typescript
// 메인 스레드로부터 원본 메시지 배열을 받음
self.onmessage = (e) => {
  const { rawMessages, sortKey, sortOrder } = e.data;
  
  // 1. 파싱 (JSON.parse 비용이 큼)
  const tickers = rawMessages.map(msg => JSON.parse(msg).data);
  
  // 2. 정렬 (O(N log N) 비용)
  tickers.sort((a, b) => {
    const valA = parseFloat(a[sortKey]);
    const valB = parseFloat(b[sortKey]);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });
  
  // 3. 처리된 결과 반환
  self.postMessage(tickers);
};
```

**2. 메인 스레드 적용 (`hooks/useTickerWorker.ts`)**
```typescript
const workerRef = useRef<Worker | null>(null);

useEffect(() => {
  workerRef.current = new Worker(new URL('../workers/tickerWorker.ts', import.meta.url));
  
  workerRef.current.onmessage = (e) => {
    // 이미 정렬된 데이터를 받아서 상태 업데이트만 수행 (가벼움)
    setSortedTickers(e.data);
  };
  
  return () => workerRef.current?.terminate();
}, []);

// WebSocket 메시지가 쌓이면 워커에게 던짐
const handleMessage = (message) => {
  workerRef.current?.postMessage({ rawMessages: [message] });
};
```

**효과:**
- 메인 스레드는 **오직 렌더링**에만 집중할 수 있습니다.
- 데이터가 아무리 많이 쏟아져도 스크롤이나 애니메이션이 끊기지 않습니다.

---

## 5. 주의사항 및 한계

1.  **DOM 접근 불가**: `document`, `window`, `alert` 등을 사용할 수 없습니다. UI 조작은 반드시 메인 스레드에서 해야 합니다.
2.  **데이터 복사 비용 (Structured Clone vs Transferable Objects)**
    
    메인 스레드와 워커는 메모리를 공유하지 않습니다. 그래서 데이터를 주고받을 때 기본적으로 **"복사(Clone)"**가 일어납니다.
    
    - **문제점 (Structured Clone)**:
      데이터가 100MB라면, 이걸 보낼 때 100MB를 새로 복사해서 만듭니다. (메모리 2배 사용, 복사 시간 소요)
      ```javascript
      // 🐢 느림: 데이터 복사 발생
      worker.postMessage(hugeData); 
      ```
    
    - **해결책 (Transferable Objects)**:
      데이터의 **"소유권(Ownership)"**을 아예 넘겨버립니다. 복사가 아니라 메모리 주소만 넘겨주므로 **비용이 거의 0**에 가깝습니다. 단, 보낸 쪽에서는 더 이상 그 데이터를 사용할 수 없습니다.
      
      ```javascript
      // 🚀 빠름: 소유권 이전 (복사 비용 0)
      // 두 번째 인자로 전송할 버퍼를 지정
      worker.postMessage(hugeData, [hugeData.buffer]); 
      
      // 주의: 이제 메인 스레드에서 hugeData는 텅 빈 껍데기가 됨 (접근 불가)
      console.log(hugeData.byteLength); // 0
      ```
      
      > **비유**:
      > - **Structured Clone**: 친구에게 내 노트를 빌려주기 위해 **복사기로 복사해서** 주는 것. (오래 걸림, 원본은 내가 가짐)
      > - **Transferable Object**: 내 **노트 원본을 그냥 줘버리는 것**. (순식간에 끝남, 나는 더 이상 노트를 못 봄)
3.  **제한된 API**: `fetch`, `WebSocket`, `IndexedDB` 등은 사용 가능하지만, `localStorage`는 접근할 수 없습니다.

---

## 6. React에서 Web Worker 사용하기

React나 Next.js 환경에서는 웹팩 설정 없이 간편하게 워커를 쓰기 위해 라이브러리를 사용하거나 커스텀 훅을 만듭니다.

### 6.1 Comlink 사용 (추천)
Google에서 만든 `Comlink` 라이브러리를 쓰면 `postMessage`의 복잡함 없이 함수 호출하듯이 워커를 쓸 수 있습니다.

```typescript
// worker.ts
import { expose } from 'comlink';

const workerApi = {
  heavySort(data: number[]) {
    return data.sort((a, b) => a - b);
  }
};

expose(workerApi);
```

```typescript
// Component.tsx
import { wrap } from 'comlink';

const worker = new Worker(new URL('./worker.ts', import.meta.url));
const workerApi = wrap<typeof import('./worker').workerApi>(worker);

const handleSort = async () => {
  const result = await workerApi.heavySort(largeArray); // Promise 반환
  setData(result);
};
```

---

## 7. 다양한 Worker 비교 (Web Worker vs Service Worker)

브라우저에는 Web Worker 외에도 다양한 종류의 Worker가 존재합니다. 각 Worker는 목적과 역할이 명확히 다릅니다.

### 7.1 Web Worker vs Service Worker

가장 많이 혼동하는 두 Worker의 차이점입니다.

| 구분 | Web Worker (웹 워커) | Service Worker (서비스 워커) |
| :--- | :--- | :--- |
| **주 역할** | **무거운 계산** (CPU 작업) | **네트워크 제어**, 캐싱, 푸시 알림 |
| **비유** | 계산기 두드리는 조수 | 건물 입구 지키는 경비원 |
| **수명** | 현재 페이지(탭)와 운명을 같이 함 | 페이지와 상관없이 독립적으로 생존 |
| **DOM 접근** | 불가능 | 불가능 |
| **사용 예시** | 대용량 데이터 정렬, 이미지 처리 | 오프라인 모드(PWA), 리소스 캐싱 |

### 7.2 그 외 Worker 종류

#### Shared Worker (공유 워커)
- **특징**: 여러 탭(또는 iframe)에서 **하나의 워커 인스턴스를 공유**합니다.
- **용도**: 여러 탭 간의 상태 공유(예: 로그인 상태 동기화), 중복된 WebSocket 연결 방지(하나의 소켓으로 여러 탭 통신).

#### Worklet (워크렛)
- **특징**: 렌더링 파이프라인의 특정 단계(스타일, 레이아웃, 오디오 등)에 개입하기 위해 설계된 경량화된 워커입니다.
- **종류**:
  - `PaintWorklet`: CSS `paint()` 함수로 커스텀 이미지 그리기
  - `AudioWorklet`: 오디오 처리 (Web Audio API)
  - `LayoutWorklet`: 커스텀 레이아웃 알고리즘

### 7.3 요약

- **계산이 무겁다?** -> **Web Worker**
- **네트워크/오프라인 처리가 필요하다?** -> **Service Worker**
- **여러 탭에서 데이터를 공유해야 한다?** -> **Shared Worker**
- **고성능 오디오/그래픽 처리가 필요하다?** -> **Worklet**

