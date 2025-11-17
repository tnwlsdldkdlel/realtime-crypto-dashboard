/**
 * Binance API 어댑터
 * Binance 원시 데이터를 도메인 타입으로 변환
 */

import type {
  BinanceTickerResponse,
  BinanceKlineResponse,
  BinanceTickerStreamMessage,
  BinanceKlineStreamMessage,
} from '@/types/binance';
import type { Ticker, Kline } from '@/types';

/**
 * Binance REST API 티커 응답을 도메인 타입으로 변환
 */
export function adaptBinanceTicker(data: BinanceTickerResponse): Ticker {
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice || data.price || '0'),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    volume: parseFloat(data.volume),
    highPrice: parseFloat(data.highPrice),
    lowPrice: parseFloat(data.lowPrice),
    lastUpdateTime: Date.now(),
  };
}

/**
 * Binance REST API Kline 응답을 도메인 타입으로 변환
 */
export function adaptBinanceKline(data: BinanceKlineResponse): Kline {
  return {
    openTime: data[0],
    open: parseFloat(data[1]),
    high: parseFloat(data[2]),
    low: parseFloat(data[3]),
    close: parseFloat(data[4]),
    volume: parseFloat(data[5]),
    closeTime: data[6],
  };
}

/**
 * Binance WebSocket 티커 스트림 메시지를 도메인 타입으로 변환
 */
export function adaptBinanceTickerStream(
  message: BinanceTickerStreamMessage
): Ticker {
  const { data } = message;
  return {
    symbol: data.s,
    price: parseFloat(data.c),
    priceChange: parseFloat(data.p),
    priceChangePercent: parseFloat(data.P),
    volume: parseFloat(data.v),
    highPrice: parseFloat(data.h),
    lowPrice: parseFloat(data.l),
    lastUpdateTime: data.E,
  };
}

/**
 * Binance WebSocket Kline 스트림 메시지를 도메인 타입으로 변환
 */
export function adaptBinanceKlineStream(
  message: BinanceKlineStreamMessage
): Kline {
  const { k } = message.data;
  return {
    openTime: k.t,
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
    closeTime: k.T,
  };
}

