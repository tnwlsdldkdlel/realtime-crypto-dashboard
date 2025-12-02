'use client';

import { memo } from 'react';
import { useFavoriteStore } from '@/stores/favoriteStore';

interface FavoriteButtonProps {
  symbol: string;
  className?: string;
}

/**
 * 즐겨찾기 버튼 컴포넌트
 * React.memo로 최적화: symbol과 className이 변경되지 않으면 리렌더링 방지
 */
function FavoriteButton({ symbol, className = '' }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoriteStore();

  const favorite = isFavorite(symbol);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(symbol);
      }}
      className={`transition-colors cursor-pointer ${className}`}
      aria-label={favorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
      title={favorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
    >
      {favorite ? (
        // 채워진 별 (즐겨찾기됨)
        <svg
          className="h-5 w-5 fill-yellow-400 text-yellow-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        // 빈 별 (즐겨찾기 안됨)
        <svg
          className="h-5 w-5 text-gray-400 hover:text-yellow-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      )}
    </button>
  );
}

export default memo(FavoriteButton);

