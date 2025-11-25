/**
 * 즐겨찾기 페이지 로딩 UI
 */

import LoadingSpinner from '@/components/LoadingSpinner';

export default function FavoritesLoading() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">즐겨찾기</h2>
          <p className="text-gray-400">
            즐겨찾기한 코인의 실시간 가격 정보를 확인하세요
          </p>
        </div>
        <LoadingSpinner text="데이터를 불러오는 중..." size="lg" />
      </div>
    </main>
  );
}

