# 실시간 암호화폐 대시보드 (RCD)

Next.js 기반 고성능 실시간 암호화폐 대시보드 애플리케이션입니다.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0.8-purple)](https://zustand-demo.pmnd.rs/)

## 🎯 프로젝트 개요

이 프로젝트는 Next.js의 서버 환경을 활용하여 실시간 데이터 처리, SSR/SSG 성능 최적화, 그리고 강건한 아키텍처를 입증하는 고성능 웹 애플리케이션입니다.

### 🚀 Live Demo

**프로덕션 사이트**: [https://realtime-crypto-dashboard-kwvh32aox-ohsujins-projects-f9745280.vercel.app](https://realtime-crypto-dashboard-kwvh32aox-ohsujins-projects-f9745280.vercel.app)

> **참고**: 실시간 암호화폐 가격 정보를 확인할 수 있습니다. 로컬에서 실행하려면 아래 [시작하기](#-시작하기) 섹션을 참조하세요.

### 주요 특징

- ⚡ **실시간 데이터 처리**: WebSocket을 통한 실시간 암호화폐 가격 업데이트
- 🚀 **성능 최적화**: SSR/SSG를 통한 초기 로딩 성능 개선
- 🏗️ **강건한 아키텍처**: 어댑터 패턴, 리포지토리 패턴, 함수형 코어 원칙 적용
- 📊 **데이터 시각화**: 인터랙티브 캔들스틱 차트
- 🎨 **최적화된 렌더링**: TanStack Virtual을 통한 목록 가상화

## 🛠️ 기술 스택

| 분류 | 기술 | 용도 |
| :--- | :--- | :--- |
| **프레임워크** | Next.js 16 | SSR/SSG, API Routes, 파일 기반 라우팅 |
| **프론트엔드** | React 19 | 선언적 UI 구성 및 컴포넌트 기반 개발 |
| **상태 관리** | Zustand | 고빈도 실시간 데이터 관리 |
| **타입 시스템** | TypeScript | 타입 안정성 및 코드 품질 확보 |
| **차트 라이브러리** | Lightweight Charts | 캔들스틱 데이터 시각화 |
| **가상화** | TanStack Virtual | 수백 개의 코인 목록 효율적 렌더링 |
| **스타일링** | Tailwind CSS | 유틸리티 기반 스타일링 |

## 📁 프로젝트 구조

```
realtime-crypto-dashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (서버 측 프록시)
│   │   ├── coins/        # 코인 목록 API
│   │   └── klines/       # OHLCV 데이터 API
│   ├── layout.tsx        # 루트 레이아웃
│   └── page.tsx          # 메인 페이지
├── components/            # React 컴포넌트
├── stores/               # Zustand 상태 관리
│   ├── tickerStore.ts   # 티커 데이터 스토어
│   └── favoriteStore.ts # 즐겨찾기 스토어
├── adapters/             # 어댑터 패턴
│   └── binance.ts       # Binance API 어댑터
├── repositories/         # 리포지토리 인터페이스
│   └── tickerRepository.ts
├── lib/                  # 라이브러리 코드
│   └── websocket/       # WebSocket 클라이언트
├── types/                # TypeScript 타입 정의
│   ├── index.ts         # 도메인 타입
│   └── binance.ts       # Binance API 타입
├── utils/                # 유틸리티 함수
│   └── throttle.ts      # 스로틀링/디바운스
├── hooks/                # React 커스텀 훅
└── docs/                 # 문서
    └── prd.md           # 제품 요구사항 정의서
```

## 🚀 시작하기

### 필수 요구사항

- Node.js 18 이상
- npm 또는 yarn

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

개발 서버가 실행되면 [http://localhost:3000](http://localhost:3000)에서 애플리케이션을 확인할 수 있습니다.

## 🏗️ 아키텍처 하이라이트

### 1. 하이브리드 API 전략

- **WebSocket**: 클라이언트에서 직접 연결하여 실시간 가격 업데이트
- **REST API**: Next.js API Routes를 통한 서버 측 프록시로 보안 및 Rate Limit 관리

### 2. 상태 관리 전략

- **Zustand**: React 렌더링과 분리된 고빈도 데이터 관리
- **배치 업데이트**: `requestAnimationFrame`을 통한 효율적인 상태 업데이트
- **정규화된 데이터 구조**: Map 기반 데이터 저장으로 빠른 조회

### 3. 디자인 패턴

- **어댑터 패턴**: Binance API 원시 데이터를 도메인 타입으로 변환
- **리포지토리 패턴**: 상태 관리 계층 추상화로 라이브러리 비종속성 확보
- **함수형 코어**: 순수 함수를 통한 테스트 용이성 및 안정성

### 4. 성능 최적화

- **목록 가상화**: TanStack Virtual을 통한 대량 데이터 렌더링 최적화
- **SSR/SSG**: 초기 데이터 서버 측 페칭으로 빠른 초기 로딩
- **배치 업데이트**: 고빈도 메시지 그룹화로 CPU 부하 감소
- **메모이제이션**: React.memo, useMemo, useCallback을 통한 리렌더링 최적화
- **API 캐싱**: 중복 요청 방지 및 Rate Limit 대응

### 5. 실시간 전략

- **단일 연결, 다중 스트림**: 하나의 WebSocket 연결에 여러 심볼 구독
- **지능형 구독 관리**: 변경 규모에 따른 최적 전략 선택 (대규모/소규모 변경)
- **디바운스 재연결**: 연속 클릭 시 재연결 폭증 방지
- **Degraded Mode**: WebSocket 실패 시 REST API 폴링으로 자동 전환

## 📊 주요 기능

### RCD-F1: 실시간 코인 목록 표시
- 티커, 현재가, 24시간 변동률, 거래량, 고가/저가 표시
- 목록 가상화 구현
- 정렬 및 필터링 기능

### RCD-F2: 인터랙티브 차트 뷰
- REST API를 통한 과거 OHLCV 데이터 페치
- WebSocket을 통한 실시간 Kline 스트림 통합
- 데이터 간격(Gap) 발생 시 자동 보완

### RCD-F3: 즐겨찾기/관심 코인
- 영구적인 관심 코인 목록 관리
- WebSocket 다중 스트림 구독 자동 조정

## 🛡️ 강건성 및 에러 핸들링

- **WebSocket 재연결**: 지수 백오프/지터 전략으로 자동 재연결 (최대 10회 시도)
- **Degraded Mode**: WebSocket 실패 시 REST 폴링으로 전환
- **Rate Limit 처리**: `Retry-After` 헤더 감지 및 스로틀링
- **에러 복구**: 사용자 친화적인 에러 메시지 및 재시도 기능
- **React Error Boundary**: 전역 에러 처리 및 Fallback UI

## 📈 성능 측정치

### Core Web Vitals

| 메트릭 | 측정값 | 목표 | 상태 |
|--------|--------|------|------|
| **FCP** | 210-250ms | < 1.8s | ✅ |
| **LCP** | 330-370ms | < 2.5s | ✅ |
| **CLS** | 0.013-0.021 | < 0.1 | ✅ |
| **TTI** | 24.2s | < 3.8s | ⚠️ |
| **TBT** | 1.0-1.1s | < 200ms | ⚠️ |

### 실시간 업데이트 성능

- **FPS**: 46-47 (목표: 60)
- **렌더링 시간**: 21-22ms (목표: < 16ms)
- **CPU 사용률**: 0% (목표: < 30%) ✅
- **메모리 사용량**: 22-23MB (목표: < 100MB) ✅

> **참고**: TTI와 TBT는 실시간 WebSocket 연결 및 데이터 처리로 인한 트레이드오프입니다. 자세한 내용은 [성능 분석 문서](./docs/performance.md)를 참조하세요.

## 📸 주요 화면

### 코인 목록 페이지
- 실시간 가격 업데이트
- 정렬 및 필터링
- 즐겨찾기 관리
- 가상화된 리스트 렌더링

### 차트 페이지
- 인터랙티브 캔들스틱 차트
- 실시간 Kline 스트림 통합
- 시간 간격 선택 (1m, 5m, 1h 등)
- 데이터 Gap 자동 보완

### 성능 통계 페이지
- 초당 업데이트 수 (UPS)
- 구독 중인 심볼 수
- WebSocket 연결 상태
- 실시간 성능 모니터링

## 📝 문서

프로젝트의 상세한 기술 문서는 `docs/` 디렉토리에서 확인할 수 있습니다:

- [제품 요구사항 정의서](./docs/prd.md) - 프로젝트 요구사항 및 기능 명세
- [아키텍처 문서](./docs/architecture.md) - 시스템 아키텍처 및 설계 패턴
- [실시간 전략 문서](./docs/realtime-strategy.md) - WebSocket 및 실시간 데이터 처리 전략
- [API 문서](./docs/api.md) - REST API 및 WebSocket API 명세
- [성능 분석 문서](./docs/performance.md) - 성능 측정 결과 및 최적화 전략
- [이슈 및 해결책](./docs/issues-and-solutions.md) - 개발 중 발생한 기술 이슈 및 해결 방법
- [학습 포인트](./docs/points/learning-points.md) - 프로젝트 진행 중 학습한 기술 및 패턴

## 🧪 테스트

```bash
# 단위 테스트 실행
npm run test

# 테스트 UI 실행
npm run test:ui

# 기능 테스트 실행
npm run test:functional

# 성능 테스트 실행
npm run performance
```

## 📦 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 확인
npm start
```

## 🤝 기여

이 프로젝트는 포트폴리오 목적으로 제작되었습니다. 이슈나 제안사항이 있으시면 GitHub Issues를 통해 알려주세요.

## 📄 라이선스

이 프로젝트는 포트폴리오 목적으로 제작되었습니다.
