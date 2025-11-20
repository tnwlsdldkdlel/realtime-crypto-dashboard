'use client';

import { useEffect, useMemo } from 'react';
import { useTickerStore } from '@/stores/tickerStore';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import type { Ticker } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface CoinListClientProps {
  initialCoins: Ticker[];
  error?: string | null;
}

export default function CoinListClient({
  initialCoins,
  error,
}: CoinListClientProps) {
  const { updateTickers, tickers } = useTickerStore();

  // 초기 데이터를 스토어에 설정
  useEffect(() => {
    if (initialCoins.length > 0) {
      updateTickers(initialCoins);
    }
  }, [initialCoins, updateTickers]);

  // 구독할 심볼 목록 추출
  const symbols = useMemo(() => {
    return initialCoins.map((coin) => coin.symbol);
  }, [initialCoins]);

  // WebSocket 연결 및 구독
  const { status: wsStatus } = useBinanceWebSocket({
    symbols,
    onStatusChange: (status) => {
      if (status === 'connected') {
        console.log('WebSocket connected');
      } else if (status === 'error') {
        console.error('WebSocket error');
      }
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    autoConnect: true,
  });

  // 에러 상태 표시
  if (error) {
    return (
      <ErrorMessage
        title="데이터 로딩 실패"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 로딩 중 또는 데이터가 없을 때
  if (tickers.size === 0 && initialCoins.length === 0) {
    return <LoadingSpinner text="데이터를 불러오는 중..." />;
  }

  // WebSocket 상태 표시용 텍스트
  const wsStatusText = {
    disconnected: '연결 끊김',
    connecting: '연결 중...',
    connected: '실시간 업데이트 중',
    error: '연결 오류',
  }[wsStatus];

  const wsStatusColor = {
    disconnected: 'text-gray-500',
    connecting: 'text-yellow-400',
    connected: 'text-green-400',
    error: 'text-red-400',
  }[wsStatus];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-gray-300">
            로드된 코인 수: <span className="font-semibold text-white">{tickers.size}</span>
          </p>
          <p className={`text-sm ${wsStatusColor}`}>
            {wsStatusText}
          </p>
        </div>
        <p className="text-sm text-gray-400">
          초기 데이터: {initialCoins.length}개
        </p>
      </div>

      {/* 테이블 형태 코인 목록 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                심볼
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                현재가
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                24h 변동률
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden md:table-cell">
                거래량
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:table-cell">
                고가
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:table-cell">
                저가
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(tickers.values()).map((ticker) => (
              <tr
                key={ticker.symbol}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <td className="py-3 px-4">
                  <span className="font-semibold text-white">{ticker.symbol}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="font-semibold text-white">
                    ${ticker.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    })}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`font-semibold ${
                      ticker.priceChangePercent >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {ticker.priceChangePercent >= 0 ? '+' : ''}
                    {ticker.priceChangePercent.toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-gray-300 hidden md:table-cell">
                  {ticker.volume.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="py-3 px-4 text-right text-gray-400 hidden lg:table-cell">
                  ${ticker.highPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </td>
                <td className="py-3 px-4 text-right text-gray-400 hidden lg:table-cell">
                  ${ticker.lowPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

