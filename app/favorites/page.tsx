/**
 * 즐겨찾기 페이지 (Server Component)
 * 즐겨찾기된 코인만 표시하는 전용 페이지
 */

import { Suspense } from 'react';
import { fetchInitialCoins } from '@/utils/binanceApi';
import CoinListClient from '@/components/CoinListClient';
import LoadingSpinner from '@/components/LoadingSpinner';

// 동적 렌더링 강제 (실시간 데이터이므로)
export const dynamic = 'force-dynamic';

/**
 * 코인 데이터 페칭 컴포넌트
 */
async function FavoritesCoinDataFetcher() {
  let initialCoins: Awaited<ReturnType<typeof fetchInitialCoins>> = [];
  let error: string | null = null;

  try {
    // 서버 사이드에서 초기 코인 데이터 페칭
    // 즐겨찾기 페이지에서는 모든 코인을 가져와서 클라이언트에서 필터링
    initialCoins = await fetchInitialCoins(100);
  } catch (err) {
    console.error('Failed to fetch initial coins:', err);
    error = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
  }

  return (
    <CoinListClient 
      initialCoins={initialCoins} 
      error={error}
      favoritesOnly={true}
    />
  );
}

export default async function FavoritesPage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">즐겨찾기</h2>
          <p className="text-gray-400">
            즐겨찾기한 코인의 실시간 가격 정보를 확인하세요
          </p>
        </div>
        <Suspense fallback={<LoadingSpinner text="데이터를 불러오는 중..." size="lg" />}>
          <FavoritesCoinDataFetcher />
        </Suspense>
      </div>
    </main>
  );
}

