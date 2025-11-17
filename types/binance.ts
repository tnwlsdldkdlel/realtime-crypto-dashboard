/**
 * Binance API 원시 데이터 타입 정의
 */

/**
 * Binance 24시간 티커 통계 응답
 */
export interface BinanceTickerResponse {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/**
 * Binance Kline 응답
 */
export type BinanceKlineResponse = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteAssetVolume
  number, // numberOfTrades
  string, // takerBuyBaseAssetVolume
  string, // takerBuyQuoteAssetVolume
  string  // ignore
];

/**
 * Binance WebSocket 티커 스트림 메시지
 */
export interface BinanceTickerStreamMessage {
  stream: string;
  data: {
    e: string; // Event type
    E: number; // Event time
    s: string; // Symbol
    p: string; // Price change
    P: string; // Price change percent
    w: string; // Weighted average price
    x: string; // First trade(F)-1 price (first trade before the 24hr rolling window)
    c: string; // Last price
    Q: string; // Last quantity
    b: string; // Best bid price
    B: string; // Best bid quantity
    a: string; // Best ask price
    A: string; // Best ask quantity
    o: string; // Open price
    h: string; // High price
    l: string; // Low price
    v: string; // Total traded base asset volume
    q: string; // Total traded quote asset volume
    O: number; // Statistics open time
    C: number; // Statistics close time
    F: number; // First trade ID
    L: number; // Last trade Id
    n: number; // Total number of trades
  };
}

/**
 * Binance WebSocket Kline 스트림 메시지
 */
export interface BinanceKlineStreamMessage {
  stream: string;
  data: {
    e: string; // Event type
    E: number; // Event time
    s: string; // Symbol
    k: {
      t: number; // Kline start time
      T: number; // Kline close time
      s: string; // Symbol
      i: string; // Interval
      f: number; // First trade ID
      L: number; // Last trade ID
      o: string; // Open price
      c: string; // Close price
      h: string; // High price
      l: string; // Low price
      v: string; // Volume
      n: number; // Number of trades
      x: boolean; // Is this kline closed?
      q: string; // Quote asset volume
      V: string; // Taker buy base asset volume
      Q: string; // Taker buy quote asset volume
      B: string; // Ignore
    };
  };
}

