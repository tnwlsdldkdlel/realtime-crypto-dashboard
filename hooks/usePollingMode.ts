/**
 * REST API 폴링 모드 훅
 * WebSocket 실패 시 Degraded Mode로 전환하여 REST API로 주기적으로 데이터를 가져옴
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTickerStore } from '@/stores/tickerStore';
import { adaptBinanceTicker } from '@/adapters/binance';
import { apiCache } from '@/utils/apiCache';
import type { BinanceTickerResponse } from '@/types/binance';
import type { Ticker } from '@/types';

interface UsePollingModeOptions {
  /**
   * 폴링할 심볼 목록
   */
  symbols: string[];
  /**
   * 폴링 간격 (밀리초, 기본값: 5000ms = 5초)
   */
  interval?: number;
  /**
   * 폴링 활성화 여부
   */
  enabled?: boolean;
  /**
   * 에러 발생 콜백
   */
  onError?: (error: Error) => void;
}

/**
 * REST API 폴링 모드 훅
 */
export function usePollingMode(options: UsePollingModeOptions) {
  const {
    symbols,
    interval = 5000, // 5초 (Rate Limit 고려)
    enabled = false,
    onError,
  } = options;

  const { updateTickers } = useTickerStore();
  const [isPolling, setIsPolling] = useState(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  /**
   * REST API로 티커 데이터 가져오기
   * 캐시된 데이터를 우선 사용하여 Rate Limit 방지
   */
  const fetchTickers = useCallback(async () => {
    if (symbols.length === 0 || !enabled) {
      return;
    }

    try {
      // 캐시 키 생성
      const cacheKey = `tickers:${symbols.sort().join(',')}`;
      
      // 캐시된 데이터 확인 (30초 TTL)
      const cachedData = apiCache.get<BinanceTickerResponse[]>(cacheKey);
      if (cachedData) {
        // 캐시된 데이터 사용
        const tickers: Ticker[] = cachedData.map(adaptBinanceTicker);
        updateTickers(tickers);
        return;
      }

      // 심볼 목록을 쉼표로 구분하여 전달
      const symbolsParam = symbols.join(',');
      const response = await fetch(`/api/coins?symbols=${encodeURIComponent(symbolsParam)}`);

      if (!response.ok) {
        // Rate Limit 에러인 경우 캐시된 데이터가 있으면 사용
        if (response.status === 429) {
          const staleCache = apiCache.get<BinanceTickerResponse[]>(cacheKey);
          if (staleCache) {
            const tickers: Ticker[] = staleCache.map(adaptBinanceTicker);
            updateTickers(tickers);
            onError?.(new Error('Rate Limit: 캐시된 데이터를 사용합니다'));
            return;
          }
        }
        throw new Error(`Failed to fetch tickers: ${response.status}`);
      }

      const data: BinanceTickerResponse[] = await response.json();
      
      // 캐시에 저장 (30초 TTL)
      apiCache.set(cacheKey, data, 30000);
      
      // 어댑터를 통해 정규화된 티커 데이터로 변환
      const tickers: Ticker[] = data.map(adaptBinanceTicker);
      
      // 스토어에 업데이트
      updateTickers(tickers);
    } catch (error) {
      console.error('Polling error:', error);
      onError?.(error as Error);
    }
  }, [symbols, enabled, updateTickers, onError]);

  /**
   * 폴링 시작
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enabled || symbols.length === 0) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    // 즉시 한 번 실행
    fetchTickers();

    // 주기적으로 실행
    pollingTimerRef.current = setInterval(() => {
      if (isPollingRef.current) {
        fetchTickers();
      }
    }, interval);
  }, [enabled, symbols.length, interval, fetchTickers]);

  /**
   * 폴링 중지
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    isPollingRef.current = false;
    setIsPolling(false);
  }, []);

  /**
   * 폴링 활성화/비활성화에 따라 시작/중지
   */
  useEffect(() => {
    if (enabled && symbols.length > 0) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, symbols.length, startPolling, stopPolling]);

  return {
    isPolling,
    startPolling,
    stopPolling,
  };
}

