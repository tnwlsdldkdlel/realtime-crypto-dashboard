'use client';

import { useEffect } from 'react';
import { useTickerStore } from '@/stores/tickerStore';
import type { Ticker } from '@/types';

interface CoinListClientProps {
  initialCoins: Ticker[];
  error?: string | null;
}

export default function CoinListClient({
  initialCoins,
  error,
}: CoinListClientProps) {
  const { updateTickers, getAllTickers } = useTickerStore();

  // 초기 데이터를 스토어에 설정
  useEffect(() => {
    if (initialCoins.length > 0) {
      updateTickers(initialCoins);
    }
  }, [initialCoins, updateTickers]);

  const tickers = getAllTickers();

  // 에러 상태 표시
  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
        <p className="text-red-200 font-semibold">데이터 로딩 실패</p>
        <p className="text-red-300 text-sm mt-1">{error}</p>
      </div>
    );
  }

  // 로딩 중 또는 데이터가 없을 때
  if (tickers.size === 0 && initialCoins.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-gray-300">
          로드된 코인 수: <span className="font-semibold text-white">{tickers.size}</span>
        </p>
        <p className="text-sm text-gray-400">
          초기 데이터: {initialCoins.length}개
        </p>
      </div>

      {/* 간단한 코인 목록 미리보기 */}
      <div className="space-y-2">
        {Array.from(tickers.values())
          .slice(0, 10)
          .map((ticker) => (
            <div
              key={ticker.symbol}
              className="p-4 bg-gray-800 rounded-lg shadow-sm hover:bg-gray-700 hover:shadow-md transition-all border border-gray-700"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <span className="font-semibold text-lg text-white">{ticker.symbol}</span>
                  <div className="text-sm text-gray-400 mt-1">
                    거래량: {ticker.volume.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${ticker.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    })}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      ticker.priceChangePercent >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {ticker.priceChangePercent >= 0 ? '+' : ''}
                    {ticker.priceChangePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                고가: ${ticker.highPrice.toLocaleString()} | 저가:{' '}
                ${ticker.lowPrice.toLocaleString()}
              </div>
            </div>
          ))}
      </div>

      {tickers.size > 10 && (
        <div className="mt-4 text-center text-sm text-gray-400">
          ... 외 {tickers.size - 10}개 더
        </div>
      )}
    </div>
  );
}

