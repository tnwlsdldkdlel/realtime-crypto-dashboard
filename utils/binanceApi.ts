/**
 * Binance API 유틸리티
 * 서버 사이드에서 사용할 Binance API 호출 함수
 */

import type { BinanceTickerResponse } from '@/types/binance';
import { adaptBinanceTicker } from '@/adapters/binance';
import type { Ticker } from '@/types';

const BINANCE_API_BASE_URL = 'https://api.binance.com/api/v3';

/**
 * Rate Limit 처리 및 재시도 로직
 */
async function fetchWithRetry(
  url: string,
  retries = 3,
  retryDelay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        // Server Component에서 사용하므로 캐시 설정
        cache: 'no-store',
      });

      // Rate Limit 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Failed to fetch after retries');
}

/**
 * 초기 코인 목록 페칭 (서버 사이드용)
 * @param limit 가져올 코인 개수 제한 (기본값: 100)
 */
export async function fetchInitialCoins(limit = 100): Promise<Ticker[]> {
  try {
    const url = `${BINANCE_API_BASE_URL}/ticker/24hr`;
    const response = await fetchWithRetry(url);
    const data: BinanceTickerResponse[] = await response.json();

    // USDT 페어만 필터링하고 거래량 기준 정렬
    const usdtPairs = data
      .filter((ticker) => ticker.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, limit);

    return usdtPairs.map(adaptBinanceTicker);
  } catch (error) {
    console.error('Error fetching initial coins:', error);
    throw error;
  }
}

