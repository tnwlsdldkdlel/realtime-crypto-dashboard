/**
 * 로딩 스피너 컴포넌트
 * 데이터 로딩 중 표시되는 스피너
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({
  size = 'md',
  text = '데이터를 불러오는 중...',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className={`${sizeClasses[size]} border-4 border-gray-700 border-t-green-500 rounded-full animate-spin`}
        role="status"
        aria-label="로딩 중"
      >
        <span className="sr-only">로딩 중...</span>
      </div>
      {text && (
        <p className="mt-4 text-gray-400 text-sm">{text}</p>
      )}
    </div>
  );
}

