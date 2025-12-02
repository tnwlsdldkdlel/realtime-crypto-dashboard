'use client';

import { useMemo, useState, useEffect } from 'react';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { usePerformanceStats } from '@/hooks/usePerformanceStats';
import { useTickerStore } from '@/stores/tickerStore';

interface PerformanceStatsProps {
  /**
   * 구독 중인 심볼 목록
   */
  subscribedSymbols: string[];
}

/**
 * 성능 통계 컴포넌트
 */
export default function PerformanceStats({ subscribedSymbols }: PerformanceStatsProps) {
  const { tickers } = useTickerStore();
  const { stats, resetStats } = usePerformanceStats(subscribedSymbols);
  
  const { 
    status: wsStatus, 
    reconnectAttempts,
    hasReachedMaxAttempts 
  } = useBinanceWebSocket({
    symbols: subscribedSymbols,
    autoConnect: true, // 통계 페이지에서도 WebSocket 연결 필요
  });

  // 현재 시간을 상태로 관리 (Date.now() 순수 함수 위반 방지)
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // 1초마다 업데이트
    
    return () => clearInterval(interval);
  }, []);

  // WebSocket 상태 텍스트
  const wsStatusText = useMemo(() => {
    return {
      disconnected: '연결 끊김',
      connecting: '연결 중...',
      connected: '연결됨',
      error: '오류',
    }[wsStatus];
  }, [wsStatus]);

  // WebSocket 상태 색상
  const wsStatusColor = useMemo(() => {
    return {
      disconnected: 'text-gray-400',
      connecting: 'text-yellow-400',
      connected: 'text-green-400',
      error: 'text-red-400',
    }[wsStatus];
  }, [wsStatus]);

  // 현재 티커 수
  const currentTickerCount = tickers.size;

  // 평균 업데이트 속도 계산
  const averageUpdatesPerSecond = useMemo(() => {
    if (stats.totalUpdates === 0 || !stats.lastUpdateTime) return 0;
    const elapsedSeconds = (currentTime - stats.lastUpdateTime) / 1000;
    return elapsedSeconds > 0 ? stats.totalUpdates / elapsedSeconds : 0;
  }, [stats.totalUpdates, stats.lastUpdateTime, currentTime]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">성능 통계</h1>
        <p className="text-gray-400">실시간 데이터 업데이트 및 WebSocket 연결 상태</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 초당 업데이트 수 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">초당 업데이트 수</h3>
            <span className="text-xs text-gray-500">UPS</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.updatesPerSecond}</div>
          <div className="text-xs text-gray-500 mt-1">
            총 {stats.totalUpdates.toLocaleString()}회 업데이트
          </div>
        </div>

        {/* 구독 중인 심볼 수 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">구독 중인 심볼</h3>
            <span className="text-xs text-gray-500">Symbols</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.subscribedSymbolCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            현재 티커: {currentTickerCount}개
          </div>
        </div>

        {/* WebSocket 연결 상태 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">WebSocket 상태</h3>
            <span className="text-xs text-gray-500">Status</span>
          </div>
          <div className={`text-2xl font-bold ${wsStatusColor}`}>{wsStatusText}</div>
          {reconnectAttempts > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              재연결 시도: {reconnectAttempts}/10
            </div>
          )}
          {hasReachedMaxAttempts && (
            <div className="text-xs text-orange-400 mt-1">
              최대 시도 횟수 도달
            </div>
          )}
        </div>

        {/* 마지막 업데이트 시간 */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">마지막 업데이트</h3>
            <span className="text-xs text-gray-500">Time</span>
          </div>
          <div className="text-sm font-semibold text-white">
            {stats.lastUpdateTime 
              ? new Date(stats.lastUpdateTime).toLocaleTimeString('ko-KR')
              : '없음'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.lastUpdateTime 
              ? `${Math.floor((currentTime - stats.lastUpdateTime) / 1000)}초 전`
              : '데이터 없음'}
          </div>
        </div>
      </div>

      {/* 추가 통계 정보 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">상세 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">평균 업데이트 속도</div>
            <div className="text-lg font-semibold text-white">
              {averageUpdatesPerSecond > 0
                ? averageUpdatesPerSecond.toFixed(2)
                : '0.00'} 업데이트/초
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">구독률</div>
            <div className="text-lg font-semibold text-white">
              {stats.subscribedSymbolCount > 0
                ? ((currentTickerCount / stats.subscribedSymbolCount) * 100).toFixed(1)
                : '0.0'}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {currentTickerCount} / {stats.subscribedSymbolCount} 심볼
            </div>
          </div>
        </div>
      </div>

      {/* 리셋 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={resetStats}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors cursor-pointer"
        >
          통계 리셋
        </button>
      </div>
    </div>
  );
}

