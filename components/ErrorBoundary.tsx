'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 전역 에러 바운더리 컴포넌트
 * React 컴포넌트 트리에서 발생한 에러를 캐치하여 사용자 친화적인 UI 표시
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 다음 렌더에서 폴백 UI가 표시되도록 상태를 업데이트
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 로깅
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 에러 정보 저장
    this.setState({
      error,
      errorInfo,
    });

    // 외부 에러 핸들러 호출 (에러 모니터링 서비스 등)
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 제공되면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 폴백 UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
          <div className="max-w-md w-full rounded-lg border border-red-500/30 bg-gray-800 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                <svg
                  className="h-6 w-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">오류가 발생했습니다</h2>
            </div>

            <p className="mb-4 text-gray-400">
              예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 rounded border border-gray-700 bg-gray-900/50 p-3">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                  에러 상세 정보 (개발 모드)
                </summary>
                <div className="mt-2 text-xs text-red-400">
                  <p className="font-semibold">{this.state.error.name}: {this.state.error.message}</p>
                  {this.state.error.stack && (
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 transition-colors cursor-pointer"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

