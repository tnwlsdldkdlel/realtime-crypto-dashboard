/**
 * Ticker 리포지토리 인터페이스
 * 상태 관리 계층을 추상화하여 라이브러리 비종속성 확보
 */

import type { Ticker, TickerMap } from '@/types';

export interface TickerRepository {
  /**
   * 모든 티커 데이터 조회
   */
  getAllTickers(): TickerMap;

  /**
   * 특정 심볼의 티커 데이터 조회
   */
  getTicker(symbol: string): Ticker | undefined;

  /**
   * 티커 데이터 업데이트 (단일)
   */
  updateTicker(ticker: Ticker): void;

  /**
   * 티커 데이터 일괄 업데이트
   */
  updateTickers(tickers: Ticker[]): void;

  /**
   * 티커 데이터 초기화
   */
  clearTickers(): void;
}

