/**
 * 차트 페이지 (Server Component)
 * 코인 차트를 표시하는 페이지
 */

import { Suspense } from 'react';
import { fetchInitialCoins } from '@/utils/binanceApi';
import type { Ticker } from '@/types';
import ChartClient from '@/app/chart/ChartClient';
import LoadingSpinner from '@/components/LoadingSpinner';

export const dynamic = 'force-dynamic';

export default async function ChartPage() {
  let coins: Ticker[] = [];
  
  try {
    // fetchInitialCoins를 사용하여 한국어 이름이 포함된 코인 데이터 가져오기
    coins = await fetchInitialCoins(500);
  } catch (error) {
    console.error('Error fetching coins:', error);
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">차트</h2>
        </div>
        <Suspense fallback={<LoadingSpinner text="차트를 불러오는 중..." />}>
          <ChartClient initialCoins={coins} />
        </Suspense>
      </div>
    </main>
  );
}
