# 실시간 암호화폐 대시보드 (RCD)

Next.js 기반 고성능 실시간 암호화폐 대시보드 애플리케이션입니다.

## 🎯 프로젝트 개요

이 프로젝트는 Next.js의 서버 환경을 활용하여 실시간 데이터 처리, SSR/SSG 성능 최적화, 그리고 강건한 아키텍처를 입증하는 고성능 웹 애플리케이션입니다.

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

- **WebSocket 재연결**: 지수 백오프/지터 전략으로 자동 재연결
- **Degraded Mode**: WebSocket 실패 시 REST 폴링으로 전환
- **Rate Limit 처리**: `Retry-After` 헤더 감지 및 스로틀링
- **에러 복구**: 사용자 친화적인 에러 메시지 및 재시도 기능

## 📝 문서

자세한 내용은 [`docs/prd.md`](./docs/prd.md)를 참조하세요.

## 📄 라이선스

이 프로젝트는 포트폴리오 목적으로 제작되었습니다.
