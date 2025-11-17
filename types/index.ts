/**
 * 도메인 타입 정의
 * Binance API 원시 데이터를 도메인 타입으로 정규화
 */

/**
 * 코인 티커 정보
 */
export interface Ticker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  highPrice: number;
  lowPrice: number;
  lastUpdateTime: number;
}

/**
 * OHLCV (캔들스틱) 데이터
 */
export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

/**
 * 정규화된 티커 데이터 맵
 */
export type TickerMap = Map<string, Ticker>;

/**
 * 정규화된 Kline 데이터 맵 (심볼별)
 */
export type KlineMap = Map<string, Kline[]>;

/**
 * WebSocket 연결 상태
 */
export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * 애플리케이션 상태
 */
export interface AppState {
  isDegradedMode: boolean;
  lastError: Error | null;
}

