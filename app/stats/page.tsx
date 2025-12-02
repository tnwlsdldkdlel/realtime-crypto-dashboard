import { fetchInitialCoins } from '@/utils/binanceApi';
import PerformanceStats from '@/components/PerformanceStats';

// 동적 렌더링 강제 (실시간 데이터 필요)
export const dynamic = 'force-dynamic';

/**
 * 성능 통계 페이지
 */
export default async function StatsPage() {
  let initialCoins: Awaited<ReturnType<typeof fetchInitialCoins>> = [];
  let error: string | null = null;

  try {
    // 서버 사이드에서 초기 코인 데이터 페칭 (100개)
    initialCoins = await fetchInitialCoins(100);
  } catch (err) {
    error = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
  }

  // 구독할 심볼 목록 (초기 코인들의 심볼)
  const subscribedSymbols = initialCoins.map((coin) => coin.symbol);

  return (
    <main className="min-h-screen bg-gray-900">
      {error ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
          </div>
        </div>
      ) : (
        <PerformanceStats subscribedSymbols={subscribedSymbols} />
      )}
    </main>
  );
}

