/**
 * 메인 페이지 (Server Component)
 * 서버 사이드에서 초기 코인 데이터를 페칭하여 클라이언트에 전달
 */

import { fetchInitialCoins } from '@/utils/binanceApi';
import CoinListClient from '@/components/CoinListClient';

// 동적 렌더링 강제 (실시간 데이터이므로)
export const dynamic = 'force-dynamic';

export default async function Home() {
  let initialCoins: Awaited<ReturnType<typeof fetchInitialCoins>> = [];
  let error: string | null = null;

  try {
    // 서버 사이드에서 초기 코인 데이터 페칭
    initialCoins = await fetchInitialCoins(100);
  } catch (err) {
    console.error('Failed to fetch initial coins:', err);
    error = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">실시간 암호화폐 대시보드</h1>
          <p className="text-gray-400">
            Binance 실시간 암호화폐 가격 정보를 확인하세요
          </p>
        </div>
        <CoinListClient initialCoins={initialCoins} error={error} />
      </div>
    </main>
  );
}
