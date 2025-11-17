/**
 * Zustand 티커 스토어
 * 고빈도 실시간 데이터를 React 렌더링과 분리하여 관리
 */

import { create } from 'zustand';
import type { Ticker, TickerMap } from '@/types';
import type { TickerRepository } from '@/repositories/tickerRepository';

interface TickerStore extends TickerRepository {
  // 내부 상태
  tickers: TickerMap;
}

/**
 * 배치 업데이트를 위한 임시 버퍼
 */
let updateBuffer: Ticker[] = [];
let rafId: number | null = null;
let storeSetState: ((fn: (state: TickerStore) => Partial<TickerStore>) => void) | null = null;

/**
 * requestAnimationFrame을 사용한 배치 업데이트
 */
function flushUpdates() {
  if (updateBuffer.length === 0 || !storeSetState) return;

  const updates = [...updateBuffer];
  updateBuffer = [];

  storeSetState((state) => {
    const newTickers = new Map(state.tickers);
    updates.forEach((ticker) => {
      newTickers.set(ticker.symbol, ticker);
    });
    return { tickers: newTickers };
  });

  rafId = null;
}

/**
 * 배치 업데이트 스케줄링
 */
function scheduleUpdate() {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => flushUpdates());
  }
}

export const useTickerStore = create<TickerStore>((set, get) => {
  // setState 함수를 전역 변수에 저장하여 배치 업데이트에서 사용
  storeSetState = set;

  return {
    tickers: new Map(),

    getAllTickers: () => get().tickers,

    getTicker: (symbol: string) => get().tickers.get(symbol),

    updateTicker: (ticker: Ticker) => {
      updateBuffer.push(ticker);
      scheduleUpdate();
    },

    updateTickers: (tickers: Ticker[]) => {
      updateBuffer.push(...tickers);
      scheduleUpdate();
    },

    clearTickers: () => set({ tickers: new Map() }),
  };
});

