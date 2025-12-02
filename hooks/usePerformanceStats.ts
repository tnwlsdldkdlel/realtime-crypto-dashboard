/**
 * 성능 통계 추적 훅
 * 초당 업데이트 수, 구독 중인 심볼 수 등을 측정
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTickerStore } from '@/stores/tickerStore';

interface PerformanceStats {
  /**
   * 초당 업데이트 수 (Updates Per Second)
   */
  updatesPerSecond: number;
  /**
   * 현재 구독 중인 심볼 수
   */
  subscribedSymbolCount: number;
  /**
   * 총 업데이트 수
   */
  totalUpdates: number;
  /**
   * 마지막 업데이트 시간
   */
  lastUpdateTime: number | null;
}

/**
 * 성능 통계 추적 훅
 */
export function usePerformanceStats(subscribedSymbols: string[]) {
  const { tickers } = useTickerStore();
  const [stats, setStats] = useState<PerformanceStats>({
    updatesPerSecond: 0,
    subscribedSymbolCount: subscribedSymbols.length,
    totalUpdates: 0,
    lastUpdateTime: null,
  });

  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousTickerTimestampsRef = useRef<Map<string, number>>(new Map());
  const startTimeRef = useRef<number>(Date.now());

  /**
   * 업데이트 수 측정 (티커의 lastUpdateTime을 추적)
   */
  useEffect(() => {
    const now = Date.now();
    let updateCount = 0;

    // 각 티커의 lastUpdateTime을 확인하여 업데이트 감지
    tickers.forEach((ticker, symbol) => {
      const previousTimestamp = previousTickerTimestampsRef.current.get(symbol);
      const currentTimestamp = ticker.lastUpdateTime;

      // 이전 타임스탬프와 다르면 업데이트로 간주
      if (previousTimestamp !== currentTimestamp) {
        updateCount++;
        previousTickerTimestampsRef.current.set(symbol, currentTimestamp);
        lastUpdateTimeRef.current = now;
      }
    });

    // 새로 추가된 티커도 업데이트로 간주
    const newSymbols = Array.from(tickers.keys()).filter(
      (symbol) => !previousTickerTimestampsRef.current.has(symbol)
    );
    newSymbols.forEach((symbol) => {
      const ticker = tickers.get(symbol);
      if (ticker) {
        previousTickerTimestampsRef.current.set(symbol, ticker.lastUpdateTime);
        updateCount++;
        lastUpdateTimeRef.current = now;
      }
    });

    // 제거된 티커 정리
    const currentSymbols = new Set(tickers.keys());
    previousTickerTimestampsRef.current.forEach((_, symbol) => {
      if (!currentSymbols.has(symbol)) {
        previousTickerTimestampsRef.current.delete(symbol);
      }
    });

    if (updateCount > 0) {
      updateCountRef.current += updateCount;
    }
  }, [tickers]);

  /**
   * 초당 업데이트 수 계산 (1초마다)
   */
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const updatesInLastSecond = updateCountRef.current;
      updateCountRef.current = 0; // 리셋

      setStats((prev) => ({
        ...prev,
        updatesPerSecond: updatesInLastSecond,
        subscribedSymbolCount: subscribedSymbols.length,
        totalUpdates: prev.totalUpdates + updatesInLastSecond,
        lastUpdateTime: lastUpdateTimeRef.current || prev.lastUpdateTime,
      }));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [subscribedSymbols.length]);

  /**
   * 통계 리셋
   */
  const resetStats = useCallback(() => {
    updateCountRef.current = 0;
    lastUpdateTimeRef.current = null;
    previousTickerTimestampsRef.current.clear();
    startTimeRef.current = Date.now();
    setStats({
      updatesPerSecond: 0,
      subscribedSymbolCount: subscribedSymbols.length,
      totalUpdates: 0,
      lastUpdateTime: null,
    });
  }, [subscribedSymbols.length]);

  return {
    stats,
    resetStats,
  };
}

