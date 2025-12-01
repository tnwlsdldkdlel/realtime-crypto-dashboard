'use client';

import { ErrorBoundary } from './ErrorBoundary';

/**
 * ErrorBoundary 래퍼 컴포넌트
 * Server Component에서 사용할 수 있도록 클라이언트 컴포넌트로 래핑
 */
export default function ErrorBoundaryWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // 에러 로깅 (실제 프로덕션에서는 에러 모니터링 서비스로 전송)
        console.error('Global error caught:', error, errorInfo);
        
        // 필요시 에러 모니터링 서비스로 전송
        // 예: Sentry, LogRocket 등
        // if (typeof window !== 'undefined' && window.Sentry) {
        //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
        // }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

