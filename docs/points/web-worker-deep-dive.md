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

---

## 5. 주의사항 및 한계

1.  **DOM 접근 불가**: `document`, `window`, `alert` 등을 사용할 수 없습니다. UI 조작은 반드시 메인 스레드에서 해야 합니다.
2.  **데이터 복사 비용**: 기본적으로 메시지를 보낼 때 데이터가 **복사(Structured Clone)**됩니다. 데이터가 매우 크면 복사하는 데 시간이 걸릴 수 있습니다. (해결책: Transferable Object 사용)
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
