'use client';

import { useEffect, useRef, memo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts';

export interface CandlestickChartProps {
  data: CandlestickData[];
  symbol?: string;
  height?: number;
  interval?: string;
}

// 타입 재export
export type { CandlestickData };

/**
 * 캔들스틱 차트 컴포넌트
 * Lightweight Charts를 사용하여 OHLCV 데이터를 시각화
 * React.memo로 최적화: data, symbol, height, interval이 변경되지 않으면 리렌더링 방지
 */
function CandlestickChart({
  data,
  symbol = 'BTCUSDT',
  height = 500,
  interval = '1m',
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      crosshair: {
        mode: 1, // Normal mode
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
      // 줌 및 패닝 활성화
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
    });

    // 캔들스틱 시리즈 추가 (Lightweight Charts v5 방식)
    const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeriesInstance;

    // 리사이즈 핸들러
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [height]);

  // 데이터 업데이트
  useEffect(() => {
    if (seriesRef.current) {
      if (data.length > 0) {
        seriesRef.current.setData(data);
      } else {
        // 데이터가 없으면 빈 배열로 설정
        seriesRef.current.setData([]);
      }
    }
  }, [data]);

  // 시간대 표시 텍스트
  const intervalText: Record<string, string> = {
    '1m': '1분',
    '5m': '5분',
    '15m': '15분',
    '1h': '1시간',
    '4h': '4시간',
    '1d': '1일',
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">{symbol}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {intervalText[interval] || interval} 차트
            {interval === '1m' && <span className="ml-2 text-green-400">● 실시간</span>}
          </p>
        </div>
        <div className="text-sm text-gray-400">
          <p>마우스 휠: 줌 | 드래그: 패닝</p>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />
    </div>
  );
}

export default memo(CandlestickChart);

