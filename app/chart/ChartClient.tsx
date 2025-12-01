'use client';

import { useState, useEffect, useRef } from 'react';
import CandlestickChart, { CandlestickData } from '@/components/CandlestickChart';
import { Time } from 'lightweight-charts';
import type { Ticker } from '@/types';
import type { BinanceKlineResponse, BinanceKlineStreamMessage } from '@/types/binance';
import { BinanceWebSocketClient } from '@/lib/websocket/binanceWebSocket';
import { adaptBinanceKlineStream } from '@/adapters/binance';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import CoinSelectModal from '@/components/CoinSelectModal';

interface ChartClientProps {
  initialCoins: Ticker[];
}

/**
 * Binance Kline 응답을 CandlestickData로 변환
 * @param kline Binance Kline 배열 [openTime, open, high, low, close, volume, ...]
 * @returns Lightweight Charts용 CandlestickData
 */
export function convertKlineToCandlestick(kline: BinanceKlineResponse): CandlestickData {
  return {
    time: (kline[0] / 1000) as Time, // openTime을 초 단위로 변환
    open: parseFloat(kline[1] as string),
    high: parseFloat(kline[2] as string),
    low: parseFloat(kline[3] as string),
    close: parseFloat(kline[4] as string),
  };
}

export default function ChartClient({ initialCoins }: ChartClientProps) {
  // initialCoins가 있으면 첫 번째 코인을 기본값으로, 없으면 BTCUSDT
  const defaultSymbol = initialCoins.length > 0 ? initialCoins[0].symbol : 'BTCUSDT';
  const [selectedSymbol, setSelectedSymbol] = useState<string>(defaultSymbol);
  const [selectedInterval, setSelectedInterval] = useState<string>('1m');
  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false);
  const wsClientRef = useRef<BinanceWebSocketClient | null>(null);
  const chartDataRef = useRef<CandlestickData[]>([]);

  // 초기 차트 데이터 로드
  useEffect(() => {
    loadChartData(selectedSymbol, selectedInterval);
  }, [selectedSymbol, selectedInterval]);

  /**
   * Kline을 CandlestickData로 변환 (Kline 타입 사용)
   */
  const convertKlineToCandlestickFromKline = (kline: { openTime: number; open: number; high: number; low: number; close: number }): CandlestickData => {
    return {
      time: (kline.openTime / 1000) as Time,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
    };
  };

  /**
   * 실시간 Kline 데이터를 차트 데이터에 병합
   * openTime 기준으로 기존 캔들 업데이트 또는 새 캔들 추가
   */
  const updateChartDataWithRealtimeKline = (kline: { openTime: number; open: number; high: number; low: number; close: number }) => {
    setChartData((prevData) => {
      const newData = [...prevData];
      const klineTime = kline.openTime / 1000;
      
      // openTime으로 기존 캔들 찾기
      const existingIndex = newData.findIndex((candle) => candle.time === klineTime);
      
      const candlestickData = convertKlineToCandlestickFromKline(kline);
      
      if (existingIndex >= 0) {
        // 기존 캔들 업데이트
        newData[existingIndex] = candlestickData;
      } else {
        // 새 캔들 추가 (시간 순서대로 정렬)
        newData.push(candlestickData);
        newData.sort((a, b) => (a.time as number) - (b.time as number));
      }
      
      chartDataRef.current = newData;
      return newData;
    });
  };

  /**
   * 데이터 간격 감지 및 메우기
   * @param data 현재 차트 데이터
   * @param interval 시간 간격 (예: '1m', '5m')
   * @returns 간격이 메워진 데이터
   */
  const detectAndFillGaps = async (
    data: CandlestickData[],
    symbol: string,
    interval: string
  ): Promise<CandlestickData[]> => {
    if (data.length < 2) return data;

    // 간격 크기 계산 (밀리초)
    const intervalMs: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const intervalSize = intervalMs[interval] || intervalMs['1m'];
    const gaps: Array<{ start: number; end: number }> = [];

    // 간격 감지
    for (let i = 0; i < data.length - 1; i++) {
      const currentTime = (data[i].time as number) * 1000;
      const nextTime = (data[i + 1].time as number) * 1000;
      const expectedNextTime = currentTime + intervalSize;

      // 예상 시간보다 2배 이상 차이나면 간격으로 간주
      if (nextTime - expectedNextTime > intervalSize * 1.5) {
        gaps.push({
          start: expectedNextTime,
          end: nextTime - intervalSize,
        });
      }
    }

    // 간격이 없으면 원본 데이터 반환
    if (gaps.length === 0) return data;

    // 간격 메우기
    const filledData = [...data];
    for (const gap of gaps) {
      try {
        const response = await fetch(
          `/api/klines?symbol=${symbol}&interval=${interval}&startTime=${Math.floor(gap.start)}&endTime=${Math.floor(gap.end)}`
        );

        if (response.ok) {
          const gapKlines: BinanceKlineResponse[] = await response.json();
          const gapCandles = gapKlines.map(convertKlineToCandlestick);
          
          // 기존 데이터에 병합 (중복 제거)
          gapCandles.forEach((candle) => {
            const exists = filledData.some((d) => d.time === candle.time);
            if (!exists) {
              filledData.push(candle);
            }
          });
        }
      } catch (err) {
        console.warn('Failed to fill gap:', err);
      }
    }

    // 시간 순서대로 정렬
    filledData.sort((a, b) => (a.time as number) - (b.time as number));
    return filledData;
  };

  const loadChartData = async (symbol: string, interval: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/klines?symbol=${symbol}&interval=${interval}&limit=500`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const klines: BinanceKlineResponse[] = await response.json();
      
      if (!Array.isArray(klines) || klines.length === 0) {
        throw new Error('No chart data available');
      }
      
      let candlestickData = klines.map(convertKlineToCandlestick);
      
      // 데이터 간격 감지 및 메우기
      candlestickData = await detectAndFillGaps(candlestickData, symbol, interval);
      
      setChartData(candlestickData);
      chartDataRef.current = candlestickData;

      // WebSocket 연결 및 Kline 스트림 구독 (1분봉만 실시간 지원)
      if (interval === '1m') {
        setupWebSocket(symbol);
      } else {
        // 다른 간격은 WebSocket 연결 해제
        if (wsClientRef.current) {
          wsClientRef.current.disconnect();
          wsClientRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
      setError(err instanceof Error ? err.message : '차트 데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  /**
   * WebSocket 설정 및 Kline 스트림 구독
   */
  const setupWebSocket = (symbol: string) => {
    // 기존 WebSocket 연결 해제
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }

    // 새 WebSocket 클라이언트 생성
    wsClientRef.current = new BinanceWebSocketClient({
      onKlineMessage: (message: BinanceKlineStreamMessage) => {
        try {
          // 선택된 심볼과 일치하는지 확인
          if (message.data.s === symbol) {
            const kline = adaptBinanceKlineStream(message);
            updateChartDataWithRealtimeKline(kline);
          }
        } catch (error) {
          console.error('Failed to process kline message:', error);
        }
      },
      onStatusChange: (status) => {
        if (status === 'error') {
          console.error('WebSocket connection error');
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
      },
    });

    // Kline 스트림 구독 (1분봉)
    wsClientRef.current.subscribe([symbol], 'kline');
    wsClientRef.current.connect();
  };

  // 컴포넌트 언마운트 시 WebSocket 정리
  useEffect(() => {
    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
        wsClientRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <ErrorMessage
        title="차트 로딩 실패"
        message={error}
        onRetry={() => loadChartData(selectedSymbol, selectedInterval)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 코인 선택 및 시간대 선택 UI */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="symbol-select" className="block text-sm font-medium text-gray-300 mb-2">
              코인 선택
            </label>
            <button
              id="symbol-select"
              onClick={() => setIsCoinModalOpen(true)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-left hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between cursor-pointer disabled:cursor-not-allowed"
              disabled={loading}
            >
              <span>
                {(() => {
                  const selectedCoin = initialCoins.find((c) => c.symbol === selectedSymbol);
                  return selectedCoin?.nameKO
                    ? `${selectedCoin.symbol} - ${selectedCoin.nameKO}`
                    : selectedSymbol;
                })()}
              </span>
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          <div className="md:w-32">
            <label htmlFor="interval-select" className="block text-sm font-medium text-gray-300 mb-2">
              시간대
            </label>
            <select
              id="interval-select"
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="1m">1분</option>
              <option value="5m">5분</option>
              <option value="15m">15분</option>
              <option value="1h">1시간</option>
              <option value="4h">4시간</option>
              <option value="1d">1일</option>
            </select>
            {selectedInterval !== '1m' && (
              <p className="text-xs text-gray-400 mt-1">실시간 업데이트는 1분봉만 지원됩니다</p>
            )}
          </div>
        </div>
      </div>

      {/* 차트 */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: '500px' }}>
          <LoadingSpinner text="차트 데이터를 불러오는 중..." />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4">
          <CandlestickChart 
            data={chartData} 
            symbol={selectedSymbol} 
            height={500}
            interval={selectedInterval}
          />
        </div>
      )}

      {/* 코인 선택 모달 */}
      <CoinSelectModal
        isOpen={isCoinModalOpen}
        onClose={() => setIsCoinModalOpen(false)}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          setIsCoinModalOpen(false);
        }}
        coins={initialCoins}
        selectedSymbol={selectedSymbol}
      />
    </div>
  );
}

