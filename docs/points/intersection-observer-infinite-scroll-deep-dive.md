# Intersection Observer를 활용한 무한 스크롤 구현 딥다이브

코인 선택 모달에서 500개 이상의 코인을 효율적으로 표시하기 위해 무한 스크롤을 구현했습니다. 이 문서는 `Intersection Observer API`를 활용하여 대용량 리스트를 효율적으로 처리하는 방법을 상세히 설명합니다.

---

## 1. Intersection Observer란?

`Intersection Observer API`는 브라우저 네이티브 API로, **특정 요소가 뷰포트(또는 지정한 컨테이너)에 들어오거나 나갈 때를 감지**할 수 있게 해줍니다.

### 기본 문법

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    // entries: 관찰 중인 요소들의 배열
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // 요소가 뷰포트에 들어옴
      }
    });
  },
  {
    root: null, // 뷰포트 (기본값)
    rootMargin: '0px', // root의 여백
    threshold: 0, // 0% 보이면 트리거 (0.0 ~ 1.0)
  }
);

observer.observe(element); // 요소 관찰 시작
observer.unobserve(element); // 요소 관찰 중지
observer.disconnect(); // 모든 관찰 중지
```

### 왜 Intersection Observer를 사용할까?

#### ❌ 스크롤 이벤트 방식의 문제점

```typescript
// 스크롤 이벤트 방식
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  
  // 스크롤이 하단에 가까우면 더 로드
  if (scrollTop + windowHeight >= documentHeight - 100) {
    loadMore();
  }
});
```

**문제점:**
- 스크롤 이벤트가 매우 자주 발생 (성능 오버헤드)
- 수동으로 스크롤 위치 계산 필요
- 복잡한 로직 필요

#### ✅ Intersection Observer 방식의 장점

```typescript
// Intersection Observer 방식
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    loadMore(); // 간단하고 효율적
  }
});

observer.observe(loadMoreTrigger);
```

**장점:**
- 브라우저가 최적화하여 성능 우수
- 간단한 구현
- 자동으로 교차 감지

---

## 2. 프로젝트 적용: 코인 선택 모달

### 2.1 문제 상황

- **500개 이상의 코인**을 모달에 표시해야 함
- 모든 코인을 한 번에 렌더링하면 초기 로딩이 느림
- 메모리 사용량 증가

### 2.2 해결 방법

**초기에는 50개만 표시하고, 스크롤 시 추가로 50개씩 로드**

```typescript
// components/CoinSelectModal.tsx

const [displayCount, setDisplayCount] = useState(50); // 초기 표시 개수
const loadMoreRef = useRef<HTMLDivElement>(null); // 트리거 요소 참조

// 표시할 코인 목록 (무한 스크롤용)
const displayedCoins = useMemo(() => {
  if (searchQuery.trim()) {
    return filteredCoins; // 검색 중일 때는 모든 결과 표시
  }
  return filteredCoins.slice(0, displayCount); // displayCount만큼만 표시
}, [filteredCoins, displayCount, searchQuery]);

// 더 로드할 항목이 있는지 확인
const hasMore = !searchQuery.trim() && displayCount < filteredCoins.length;
```

---

## 3. Intersection Observer 구현

### 3.1 Observer 설정

```typescript
// components/CoinSelectModal.tsx

useEffect(() => {
  if (!isOpen || !hasMore || !loadMoreRef.current) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // 트리거 요소가 보이면 50개씩 추가 로드
        setDisplayCount((prev) => Math.min(prev + 50, filteredCoins.length));
      }
    },
    {
      root: listRef.current, // 스크롤 컨테이너
      rootMargin: '100px', // 100px 전에 미리 로드 (프리로딩)
      threshold: 0.1, // 10% 보이면 트리거
    }
  );

  observer.observe(loadMoreRef.current);

  return () => {
    observer.disconnect(); // 컴포넌트 언마운트 시 정리
  };
}, [isOpen, hasMore, filteredCoins.length]);
```

### 3.2 옵션 설명

#### root
```typescript
root: listRef.current
```
- **기본값**: `null` (뷰포트)
- **설정값**: 스크롤 컨테이너 요소
- **용도**: 모달 내부 스크롤 컨테이너를 기준으로 감지

#### rootMargin
```typescript
rootMargin: '100px'
```
- **기본값**: `'0px'`
- **설정값**: `'100px'` (100px 전에 미리 로드)
- **용도**: 사용자가 스크롤하기 전에 미리 로드하여 부드러운 경험 제공

#### threshold
```typescript
threshold: 0.1
```
- **기본값**: `0` (1px라도 보이면 트리거)
- **설정값**: `0.1` (10% 보이면 트리거)
- **용도**: 너무 일찍 트리거되는 것을 방지

### 3.3 트리거 요소

```typescript
// JSX
{hasMore && (
  <div ref={loadMoreRef} className="p-4 text-center text-gray-400">
    더 불러오는 중...
  </div>
)}
```

**동작:**
- 이 요소가 뷰포트에 들어오면 `IntersectionObserver` 콜백 실행
- `displayCount`를 50씩 증가시켜 더 많은 항목 표시

---

## 4. 검색 중 무한 스크롤 비활성화

### 4.1 구현

```typescript
// 검색 중일 때는 모든 결과 표시
const displayedCoins = useMemo(() => {
  if (searchQuery.trim()) {
    return filteredCoins; // 검색 중일 때는 필터링된 결과 모두 표시
  }
  return filteredCoins.slice(0, displayCount); // 검색 중이 아닐 때만 무한 스크롤
}, [filteredCoins, displayCount, searchQuery]);

// 더 로드할 항목이 있는지 확인 (검색 중일 때는 false)
const hasMore = !searchQuery.trim() && displayCount < filteredCoins.length;
```

### 4.2 왜 비활성화할까?

1. **검색 결과는 보통 적음**: 검색 결과가 50개를 넘는 경우가 드묾
2. **즉시 표시**: 사용자가 모든 검색 결과를 바로 볼 수 있어야 함
3. **성능**: 검색 결과가 적으므로 모두 표시해도 성능 문제 없음

---

## 5. Intersection Observer vs 스크롤 이벤트

### 5.1 성능 비교

| 방식 | 이벤트 발생 빈도 | CPU 사용량 | 브라우저 최적화 |
| :--- | :--- | :--- | :--- |
| **스크롤 이벤트** | 매우 자주 (수십~수백 회/초) | 높음 | 없음 |
| **Intersection Observer** | 필요할 때만 (요소 교차 시) | 낮음 | 브라우저 최적화 |

### 5.2 구현 복잡도 비교

#### 스크롤 이벤트 방식

```typescript
// 복잡한 계산 필요
useEffect(() => {
  const handleScroll = () => {
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // 하단에 가까운지 계산
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMore();
    }
  };
  
  container.addEventListener('scroll', handleScroll);
  return () => container.removeEventListener('scroll', handleScroll);
}, []);
```

#### Intersection Observer 방식

```typescript
// 간단한 구현
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  });
  
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, []);
```

---

## 6. 실무 팁과 주의사항

### 6.1 언제 Intersection Observer를 사용해야 할까?

#### ✅ 사용해야 하는 경우

1. **무한 스크롤**: 뉴스피드, 댓글 목록, 이미지 갤러리
2. **지연 로딩 (Lazy Loading)**: 이미지, 비디오, 광고
3. **애니메이션 트리거**: 요소가 보일 때 애니메이션 시작
4. **통계 수집**: 요소가 보인 횟수 측정

#### ❌ 사용하지 않아도 되는 경우

1. **항목이 적은 경우**: 50개 미만의 리스트
2. **즉시 표시가 필요한 경우**: 검색 결과 등
3. **간단한 스크롤 감지**: 단순히 스크롤 위치만 필요한 경우

### 6.2 메모리 누수 방지

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  
  // ✅ 반드시 클린업
  return () => {
    observer.disconnect(); // 모든 관찰 중지
    // 또는
    // observer.unobserve(loadMoreRef.current); // 특정 요소만 중지
  };
}, []);
```

**중요**: 컴포넌트 언마운트 시 반드시 `disconnect()` 또는 `unobserve()` 호출

### 6.3 조건부 관찰

```typescript
useEffect(() => {
  // 조건 확인
  if (!isOpen || !hasMore || !loadMoreRef.current) return;
  
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  
  return () => observer.disconnect();
}, [isOpen, hasMore]); // 조건 변경 시 재설정
```

**이유**: 불필요한 관찰을 방지하고 성능 최적화

### 6.4 rootMargin 활용 (프리로딩)

```typescript
{
  rootMargin: '100px', // 100px 전에 미리 로드
  threshold: 0.1,
}
```

**효과:**
- 사용자가 스크롤하기 전에 미리 로드
- 부드러운 사용자 경험
- 로딩 시간을 사용자가 인지하기 전에 완료

---

## 7. 일반적인 실수와 해결 방법

### 7.1 실수 1: 클린업 누락

```typescript
// ❌ 잘못된 예: 클린업 없음
useEffect(() => {
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  // 클린업 없음 → 메모리 누수
}, []);

// ✅ 올바른 예: 클린업 포함
useEffect(() => {
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect(); // 클린업
}, []);
```

### 7.2 실수 2: 조건 확인 누락

```typescript
// ❌ 잘못된 예: 조건 확인 없음
useEffect(() => {
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current); // loadMoreRef.current가 null일 수 있음
}, []);

// ✅ 올바른 예: 조건 확인
useEffect(() => {
  if (!loadMoreRef.current) return; // null 체크
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, []);
```

### 7.3 실수 3: 의존성 배열 누락

```typescript
// ❌ 잘못된 예: hasMore 변경을 감지하지 못함
useEffect(() => {
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, []); // hasMore가 변경되어도 재설정 안 됨

// ✅ 올바른 예: 의존성 명시
useEffect(() => {
  if (!hasMore) return;
  const observer = new IntersectionObserver(...);
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore]); // hasMore 변경 시 재설정
```

---

## 8. 프로젝트 적용 사례

### 8.1 CoinSelectModal 컴포넌트

**문제:**
- 500개 이상의 코인을 모달에 표시해야 함
- 모든 코인을 한 번에 렌더링하면 초기 로딩이 느림

**해결:**
- 초기 50개만 표시
- Intersection Observer로 스크롤 시 추가 로드
- 검색 중에는 무한 스크롤 비활성화

**결과:**
- 초기 로딩 시간 단축
- 메모리 사용량 감소
- 부드러운 스크롤 경험

### 8.2 성능 개선 효과

| 항목 | 모든 항목 렌더링 | 무한 스크롤 |
| :--- | :--- | :--- |
| 초기 렌더링 항목 | 500개 | 50개 |
| 초기 로딩 시간 | 느림 | 빠름 |
| 메모리 사용량 | 높음 | 낮음 |
| 스크롤 성능 | 느림 | 빠름 |

---

## 9. 고급 활용

### 9.1 가상화(Virtualization)와의 조합

```typescript
// Intersection Observer + 가상화
const VirtualizedList = () => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  
  const observer = new IntersectionObserver((entries) => {
    // 가상화된 항목 범위 조정
    if (entries[0].isIntersecting) {
      setVisibleRange(prev => ({
        start: prev.start,
        end: prev.end + 50,
      }));
    }
  });
  
  // ...
};
```

**장점:**
- 대용량 리스트(1000개 이상) 처리
- 메모리 효율 극대화

### 9.2 다중 트리거 요소

```typescript
// 여러 트리거 요소 관찰
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const elementId = entry.target.id;
      // 요소별로 다른 동작 수행
      handleIntersection(elementId);
    }
  });
});

triggerElements.forEach((element) => {
  observer.observe(element);
});
```

### 9.3 threshold 배열 활용

```typescript
// 여러 threshold 설정
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const ratio = entry.intersectionRatio;
      if (ratio >= 0.5) {
        // 50% 이상 보이면
      } else if (ratio >= 0.1) {
        // 10% 이상 보이면
      }
    });
  },
  {
    threshold: [0, 0.1, 0.5, 1.0], // 여러 threshold
  }
);
```

---

## 10. 학습 체크리스트

### 기본 개념
- [ ] Intersection Observer API의 기본 문법 이해
- [ ] root, rootMargin, threshold 옵션 이해
- [ ] 스크롤 이벤트와의 차이점 이해

### 실무 적용
- [ ] 무한 스크롤 구현
- [ ] 조건부 관찰 설정
- [ ] 클린업 로직 구현
- [ ] 검색 중 무한 스크롤 비활성화

### 고급 활용
- [ ] 가상화와의 조합
- [ ] 다중 트리거 요소 관리
- [ ] threshold 배열 활용

---

## 11. 참고 자료

### 공식 문서
- [MDN Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Can I Use: Intersection Observer](https://caniuse.com/intersectionobserver)

### 관련 학습 포인트
- [Intersection Observer를 활용한 무한 스크롤 구현](./learning-points.md#19-intersection-observer를-활용한-무한-스크롤-구현)
- [Combobox/Modal UI 패턴](./learning-points.md#20-comboboxmodal-ui-패턴-검색-가능한-대용량-리스트-선택)

---

## 12. 요약

### 핵심 원칙

1. **브라우저 네이티브 API 활용**: 성능 최적화된 교차 감지
2. **프리로딩**: rootMargin으로 사용자 경험 향상
3. **조건부 관찰**: 불필요한 관찰 방지
4. **클린업 필수**: 메모리 누수 방지

### 실무 팁

- 대용량 리스트(500개 이상)에 적합
- 검색 중에는 무한 스크롤 비활성화
- rootMargin으로 부드러운 경험 제공
- 컴포넌트 언마운트 시 반드시 disconnect

### 학습 가치

- **성능 최적화**: 초기 렌더링 항목 수 제한으로 초기 로딩 시간 단축
- **메모리 효율**: 필요한 만큼만 렌더링하여 메모리 사용량 감소
- **사용자 경험**: 부드러운 스크롤 경험, 자동 로딩
- **브라우저 API 활용**: 네이티브 API로 최적화된 성능

이러한 패턴을 이해하고 적용하면, 대용량 리스트를 효율적으로 처리하는 고성능 UI를 구축할 수 있습니다.

