'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTickerStore } from '@/stores/tickerStore';
import { useFavoriteStore } from '@/stores/favoriteStore';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { usePollingMode } from '@/hooks/usePollingMode';
import type { Ticker } from '@/types';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import FavoriteButton from './FavoriteButton';

interface CoinListClientProps {
  initialCoins: Ticker[];
  error?: string | null;
  favoritesOnly?: boolean; // 즐겨찾기 전용 모드
}

/**
 * 가격 변경 방향 타입
 */
type PriceChangeDirection = 'up' | 'down' | null;

/**
 * 정렬 필드 타입
 */
type SortField = 'symbol' | 'price' | 'priceChangePercent' | 'volume' | 'highPrice' | 'lowPrice' | null;

/**
 * 정렬 방향 타입
 */
type SortDirection = 'asc' | 'desc';

export default function CoinListClient({
  initialCoins,
  error,
  favoritesOnly = false,
}: CoinListClientProps) {
  const { updateTickers, tickers } = useTickerStore();
  const { favorites } = useFavoriteStore();
  
  // 이전 가격 추적 (가격 변경 감지용)
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  
  // 하이라이트 상태 관리 (100ms 스로틀링 적용)
  const [highlightedSymbols, setHighlightedSymbols] = useState<Set<string>>(new Set());
  const [highlightDirections, setHighlightDirections] = useState<Map<string, PriceChangeDirection>>(new Map());
  const highlightDirectionsRef = useRef<Map<string, PriceChangeDirection>>(new Map());
  const lastHighlightTimeRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  // 정렬 및 필터링 상태 관리
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  const allSymbols = useMemo(() => {
    if (favoritesOnly) {
      // 즐겨찾기 전용 모드: 즐겨찾기만 구독
      return favorites.filter((symbol) =>
        initialCoins.some((coin) => coin.symbol === symbol)
      );
    }
    // 일반 모드: 즐겨찾기가 있으면 즐겨찾기만, 없으면 전체
    if (favorites.length > 0) {
      return favorites.filter((symbol) =>
        initialCoins.some((coin) => coin.symbol === symbol)
      );
    }
    return initialCoins.map((coin) => coin.symbol);
  }, [initialCoins, favorites, favoritesOnly]);

  // 디바운스된 심볼 목록 (WebSocket 재구독 최적화)
  const [debouncedSymbols, setDebouncedSymbols] = useState<string[]>(allSymbols);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 이전 타이머 클리어
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 300ms 후 업데이트
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSymbols(allSymbols);
      debounceTimerRef.current = null;
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [allSymbols]);

  const symbols = debouncedSymbols;

  // WebSocket 연결 및 구독
  const { 
    status: wsStatus, 
    reconnectAttempts, 
    hasReachedMaxAttempts,
    connect: reconnectWebSocket 
  } = useBinanceWebSocket({
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

  // Degraded Mode: WebSocket 실패 시 REST 폴링 모드 전환
  const shouldUsePolling = hasReachedMaxAttempts || wsStatus === 'error';
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const { isPolling: isPollingMode } = usePollingMode({
    symbols,
    interval: 5000, // 5초 간격 (Rate Limit 고려)
    enabled: shouldUsePolling && symbols.length > 0,
    onError: (error) => {
      console.error('Polling mode error:', error);
      if (error.message.includes('Rate Limit')) {
        setRateLimitError('요청이 지연되고 있습니다. 캐시된 데이터를 사용합니다.');
      } else {
        setRateLimitError(null);
      }
    },
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
          setHighlightDirections((prev) => {
            const merged = new Map(prev);
            newDirections.forEach((direction, symbol) => {
              merged.set(symbol, direction);
              highlightDirectionsRef.current.set(symbol, direction);
            });
            return merged;
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
    
    const direction = highlightDirections.get(symbol);
    if (direction === 'up') {
      return 'bg-green-500/20 transition-colors duration-300';
    } else if (direction === 'down') {
      return 'bg-red-500/20 transition-colors duration-300';
    }
    return '';
  }, [highlightedSymbols, highlightDirections]);

  // WebSocket 상태 표시용 텍스트
  const wsStatusText = useMemo(() => {
    if (isPollingMode) {
      return '폴링 모드 (5초 간격)';
    }
    if (hasReachedMaxAttempts) {
      return `연결 실패 (${reconnectAttempts}/${10}회 시도)`;
    }
    if (wsStatus === 'connecting' && reconnectAttempts > 0) {
      return `재연결 중... (${reconnectAttempts}/${10}회)`;
    }
    return {
      disconnected: '연결 끊김',
      connecting: '연결 중...',
      connected: '실시간 업데이트 중',
      error: '연결 오류',
    }[wsStatus];
  }, [wsStatus, reconnectAttempts, hasReachedMaxAttempts, isPollingMode]);

  const wsStatusColor = useMemo(() => {
    if (isPollingMode) {
      return 'text-orange-400'; // 폴링 모드는 주황색
    }
    return {
      disconnected: 'text-gray-500',
      connecting: 'text-yellow-400',
      connected: 'text-green-400',
      error: hasReachedMaxAttempts ? 'text-red-500' : 'text-red-400',
    }[wsStatus];
  }, [wsStatus, hasReachedMaxAttempts, isPollingMode]);

  /**
   * 정렬 및 필터링된 티커 배열
   */
  const tickerArray = useMemo(() => {
    let filtered = Array.from(tickers.values());

    // 즐겨찾기 전용 모드: 즐겨찾기된 코인만 필터링
    if (favoritesOnly) {
      filtered = filtered.filter((ticker) => favorites.includes(ticker.symbol));
    }

    // 필터링: 심볼 검색
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toUpperCase();
      filtered = filtered.filter((ticker) =>
        ticker.symbol.toUpperCase().includes(query)
      );
    }

    // 정렬
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number | string;
        let bValue: number | string;

        switch (sortField) {
          case 'symbol':
            aValue = a.symbol;
            bValue = b.symbol;
            break;
          case 'price':
            aValue = a.price;
            bValue = b.price;
            break;
          case 'priceChangePercent':
            aValue = a.priceChangePercent;
            bValue = b.priceChangePercent;
            break;
          case 'volume':
            aValue = a.volume;
            bValue = b.volume;
            break;
          case 'highPrice':
            aValue = a.highPrice;
            bValue = b.highPrice;
            break;
          case 'lowPrice':
            aValue = a.lowPrice;
            bValue = b.lowPrice;
            break;
          default:
            return 0;
        }

        // 숫자 비교
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }

        // 문자열 비교
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        return 0;
      });
    }

    return filtered;
  }, [tickers, sortField, sortDirection, searchQuery, favoritesOnly, favorites]);

  /**
   * 정렬 핸들러
   */
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // 같은 필드 클릭 시 방향 토글
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // 다른 필드 클릭 시 내림차순으로 설정
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // 가상화 컨테이너 ref
  const parentRef = useRef<HTMLDivElement>(null);

  // 행 높이 (px)
  const ROW_HEIGHT = 60;

  // 컬럼 너비 정의 (px) - 헤더와 바디 모두 동일하게 사용
  const COLUMN_WIDTHS = [48, 120, 150, 120, 150, 150, 150] as const;

  // 가상화 설정
  // TanStack Virtual의 useVirtualizer는 함수를 반환하므로 메모이제이션 불가 (의도된 동작)
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: tickerArray.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5, // 화면 밖에 5개 행 미리 렌더링
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

  // 즐겨찾기 전용 모드에서 즐겨찾기가 없을 때
  if (favoritesOnly && favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg mb-4">즐겨찾기한 코인이 없습니다</p>
        <p className="text-gray-500 text-sm">
          코인 목록에서 별 아이콘을 클릭하여 즐겨찾기에 추가하세요
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Rate Limit 경고 메시지 */}
      {rateLimitError && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-yellow-400">{rateLimitError}</p>
          <button
            onClick={() => setRateLimitError(null)}
            className="text-yellow-400 hover:text-yellow-300 cursor-pointer"
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-gray-300">
            로드된 코인 수: <span className="font-semibold text-white">{tickers.size}</span>
            {searchQuery && (
              <span className="ml-2 text-gray-400">
                (필터링: {tickerArray.length}개)
              </span>
            )}
          </p>
          {favorites.length > 0 && (
            <p className="text-gray-300">
              즐겨찾기: <span className="font-semibold text-yellow-400">{favorites.length}개</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {isPollingMode && (
                <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded border border-orange-500/30">
                  폴링 모드
                </span>
              )}
              <p className={`text-sm ${wsStatusColor}`}>
                {wsStatusText}
              </p>
            </div>
            {(hasReachedMaxAttempts || isPollingMode) && (
              <button
                onClick={() => reconnectWebSocket()}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                title="WebSocket 재연결 시도 (성공 시 폴링 모드 자동 종료)"
              >
                재연결
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* 검색 입력 */}
          <div className="relative">
            <input
              type="text"
              placeholder="심볼 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-white placeholder-gray-400 focus:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 sm:w-64"
            />
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-400 hidden sm:block">
            초기 데이터: {initialCoins.length}개
          </p>
        </div>
      </div>

      {/* 테이블 형태 코인 목록 (가상화 적용) */}
      <div className="overflow-x-auto">
        {/* 헤더 (CSS Grid 사용) */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `48px repeat(${COLUMN_WIDTHS.length}, 1fr)`,
            }}
            className="w-full"
          >
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
              {/* 즐겨찾기 컬럼 */}
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
              <button
                onClick={() => handleSort('symbol')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                심볼
                {sortField === 'symbol' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
              코인명
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
              <button
                onClick={() => handleSort('price')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                현재가
                {sortField === 'price' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
              <button
                onClick={() => handleSort('priceChangePercent')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                24h 변동률
                {sortField === 'priceChangePercent' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400 hidden md:block">
              <button
                onClick={() => handleSort('volume')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                거래량
                {sortField === 'volume' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:block">
              <button
                onClick={() => handleSort('highPrice')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                고가
                {sortField === 'highPrice' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
            <div className="text-center py-3 px-4 text-sm font-semibold text-gray-400 hidden lg:block">
              <button
                onClick={() => handleSort('lowPrice')}
                className="flex items-center justify-center gap-1 w-full hover:text-white transition-colors cursor-pointer"
              >
                저가
                {sortField === 'lowPrice' && (
                  <span className="text-xs">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 가상화된 바디 (CSS Grid 사용) */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{
            height: '600px', // 최대 높이 설정
          }}
        >
          <div
            style={{
              position: 'relative',
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const ticker = tickerArray[virtualRow.index];
              const highlightClass = getHighlightClass(ticker.symbol);
              const isHighlighted = highlightedSymbols.has(ticker.symbol);
              const direction = highlightDirections.get(ticker.symbol);

              return (
                <div
                  key={ticker.symbol}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    right: 0,
                    display: 'grid',
                    gridTemplateColumns: `48px repeat(${COLUMN_WIDTHS.length}, 1fr)`,
                    height: `${ROW_HEIGHT}px`,
                    boxSizing: 'border-box',
                  }}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${highlightClass}`}
                >
                  <div className="py-3 px-4 flex items-center justify-center">
                    <FavoriteButton symbol={ticker.symbol} />
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center">
                    <span className="font-semibold text-white text-base">{ticker.symbol}</span>
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center">
                    <span className="font-semibold text-white text-base">
                      {ticker.nameKO || ticker.symbol.replace('USDT', '')}
                    </span>
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center">
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
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center">
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
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center text-gray-300 hidden md:flex">
                    {ticker.volume.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center text-gray-400 hidden lg:flex">
                    ${ticker.highPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    })}
                  </div>
                  <div className="py-3 px-4 flex items-center justify-center text-gray-400 hidden lg:flex">
                    ${ticker.lowPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

