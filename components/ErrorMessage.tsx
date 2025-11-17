/**
 * 에러 메시지 컴포넌트
 * 에러 발생 시 표시되는 메시지
 */

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({
  title = '오류가 발생했습니다',
  message,
  onRetry,
}: ErrorMessageProps) {
  return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-red-200 font-semibold text-lg">{title}</h3>
          <p className="text-red-300 text-sm mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

