'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTickerStore } from '@/stores/tickerStore';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import type { Ticker } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface CoinListClientProps {
  initialCoins: Ticker[];
  error?: string | null;
}

/**
 * 가격 변경 방향 타입
 */
type PriceChangeDirection = 'up' | 'down' | null;

export default function CoinListClient({
  initialCoins,
  error,
}: CoinListClientProps) {
  const { updateTickers, tickers } = useTickerStore();
  
  // 이전 가격 추적 (가격 변경 감지용)
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // 하이라이트 상태 관리 (100ms 스로틀링 적용)
  const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());
  const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
  const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  // 초기 데이터를 스토어에 설정
  useEffect(() => {
    if (initialCoins.length > 0) {
      updateTickers(initialCoins);
      // 초기 가격 저장
      initialCoins.forEach((coin) => {
        previousPricesRef.current.set(coin.symbol, coin.price);
      });
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

  /**
   * 가격 변경 감지 및 하이라이트 처리 (100ms 스로틀링)
   */
  useEffect(() => {
    const tickerArray = Array.from(tickers.values());
    
    // requestAnimationFrame을 사용하여 배치 처리
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        const now = Date.now();
        const newHighlightedSymbols = new Set<string>();
        const newDirections = new Map<string, PriceChangeDirection>();
        
        tickerArray.forEach((ticker) => {
          const previousPrice = previousPricesRef.current.get(ticker.symbol);
          const lastHighlightTime = lastHighlightTimeRef.current.get(ticker.symbol) || 0;
          
          // 가격이 변경되었고, 100ms 이상 경과한 경우에만 하이라이트
          if (previousPrice !== undefined && previousPrice !== ticker.price) {
            const timeSinceLastHighlight = now - lastHighlightTime;
            
            if (timeSinceLastHighlight >= 100) {
              const direction: PriceChangeDirection = ticker.price > previousPrice ? 'up' : 'down';
              newHighlightedSymbols.add(ticker.symbol);
              newDirections.set(ticker.symbol, direction);
              lastHighlightTimeRef.current.set(ticker.symbol, now);
              
              // 300ms 후 하이라이트 제거
              setTimeout(() => {
                setHighlightedSymbols((prev) => {
                  const next = new Set(prev);
                  next.delete(ticker.symbol);
                  return next;
                });
                highlightDirectionsRef.current.delete(ticker.symbol);
              }, 300);
            }
          }
          
          // 현재 가격을 이전 가격으로 저장
          previousPricesRef.current.set(ticker.symbol, ticker.price);
        });
        
        // 하이라이트 상태 업데이트
        if (newHighlightedSymbols.size > 0) {
          setHighlightedSymbols((prev) => {
            const merged = new Set(prev);
            newHighlightedSymbols.forEach((symbol) => merged.add(symbol));
            return merged;
          });
          newDirections.forEach((direction, symbol) => {
            highlightDirectionsRef.current.set(symbol, direction);
          });
        }
        
        rafIdRef.current = null;
      });
    }
    
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [tickers]);

  /**
   * 하이라이트 클래스 가져오기
   */
  const getHighlightClass = useCallback((symbol: string): string => {
    if (!highlightedSymbols.has(symbol)) {
      return '';
    }
    
    const direction = highlightDirectionsRef.current.get(symbol);
    if (direction === 'up') {
      return 'bg-green-500/20 transition-colors duration-300';
    } else if (direction === 'down') {
      return 'bg-red-500/20 transition-colors duration-300';
    }
    return '';
  }, [highlightedSymbols]);

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
            {Array.from(tickers.values()).map((ticker) => {
              const highlightClass = getHighlightClass(ticker.symbol);
              const isHighlighted = highlightedSymbols.has(ticker.symbol);
              const direction = highlightDirectionsRef.current.get(ticker.symbol);
              
              return (
                <tr
                  key={ticker.symbol}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${highlightClass}`}
                >
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white text-base">{ticker.symbol}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-bold text-lg ${
                      isHighlighted
                        ? direction === 'up'
                          ? 'text-green-400'
                          : 'text-red-400'
                        : 'text-white'
                    } transition-colors duration-300`}>
                      ${ticker.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8,
                      })}
                    </span>
                  </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`font-bold text-base ${
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
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

