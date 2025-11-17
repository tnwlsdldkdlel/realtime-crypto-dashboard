import { describe, it, expect } from 'vitest';
import {
  adaptBinanceTicker,
  adaptBinanceKline,
  adaptBinanceTickerStream,
  adaptBinanceKlineStream,
} from '../binance';
import type {
  BinanceTickerResponse,
  BinanceKlineResponse,
  BinanceTickerStreamMessage,
  BinanceKlineStreamMessage,
} from '@/types/binance';

describe('adaptBinanceTicker', () => {
  const 기본_티커_데이터: BinanceTickerResponse = {
    symbol: 'BTCUSDT',
    price: '49000.00',
    priceChange: '1000.50',
    priceChangePercent: '2.08',
    weightedAvgPrice: '49500.00',
    prevClosePrice: '48000.00',
    lastPrice: '50000.50',
    lastQty: '0.001',
    bidPrice: '50000.00',
    bidQty: '0.5',
    askPrice: '50001.00',
    askQty: '0.3',
    openPrice: '48000.00',
    highPrice: '51000.00',
    lowPrice: '47500.00',
    volume: '1234.567',
    quoteVolume: '61123456.78',
    openTime: 1609459200000,
    closeTime: 1609545600000,
    firstId: 1000000,
    lastId: 2000000,
    count: 1000000,
  };

  it('lastPrice가 있을 때 lastPrice를 사용해야 함', () => {
    const 결과 = adaptBinanceTicker(기본_티커_데이터);

    expect(결과.price).toBe(50000.5);
    expect(결과.symbol).toBe('BTCUSDT');
    expect(결과.priceChange).toBe(1000.5);
    expect(결과.priceChangePercent).toBe(2.08);
    expect(결과.volume).toBe(1234.567);
    expect(결과.highPrice).toBe(51000);
    expect(결과.lowPrice).toBe(47500);
    expect(결과.lastUpdateTime).toBeTypeOf('number');
  });

  it('lastPrice가 없고 price만 있을 때 price를 사용해야 함', () => {
    const 데이터_없는_lastPrice = {
      ...기본_티커_데이터,
      lastPrice: '',
    };

    const 결과 = adaptBinanceTicker(데이터_없는_lastPrice);

    expect(결과.price).toBe(49000);
  });

  it('lastPrice와 price 둘 다 없을 때 0을 반환해야 함', () => {
    const 데이터_둘_다_없음 = {
      ...기본_티커_데이터,
      lastPrice: '',
      price: '',
    };

    const 결과 = adaptBinanceTicker(데이터_둘_다_없음);

    expect(결과.price).toBe(0);
  });

  it('모든 필드가 올바르게 변환되어야 함', () => {
    const 결과 = adaptBinanceTicker(기본_티커_데이터);

    expect(결과).toMatchObject({
      symbol: 'BTCUSDT',
      price: 50000.5,
      priceChange: 1000.5,
      priceChangePercent: 2.08,
      volume: 1234.567,
      highPrice: 51000,
      lowPrice: 47500,
    });
    expect(결과.lastUpdateTime).toBeGreaterThan(0);
  });

  it('음수 가격 변동률을 올바르게 처리해야 함', () => {
    const 음수_변동률_데이터 = {
      ...기본_티커_데이터,
      priceChange: '-500.25',
      priceChangePercent: '-1.02',
    };

    const 결과 = adaptBinanceTicker(음수_변동률_데이터);

    expect(결과.priceChange).toBe(-500.25);
    expect(결과.priceChangePercent).toBe(-1.02);
  });

  it('소수점이 많은 가격을 올바르게 처리해야 함', () => {
    const 소수점_많은_데이터 = {
      ...기본_티커_데이터,
      lastPrice: '0.00001234',
    };

    const 결과 = adaptBinanceTicker(소수점_많은_데이터);

    expect(결과.price).toBe(0.00001234);
  });
});

describe('adaptBinanceKline', () => {
  it('Kline 배열 데이터를 올바르게 변환해야 함', () => {
    const kline_데이터: BinanceKlineResponse = [
      1609459200000, // openTime
      '48000.00', // open
      '51000.00', // high
      '47500.00', // low
      '50000.50', // close
      '1234.567', // volume
      1609545600000, // closeTime
      '61123456.78', // quoteAssetVolume
      1000000, // numberOfTrades
      '60000000.00', // takerBuyBaseAssetVolume
      '3000000000.00', // takerBuyQuoteAssetVolume
      '0', // ignore
    ];

    const 결과 = adaptBinanceKline(kline_데이터);

    expect(결과).toEqual({
      openTime: 1609459200000,
      open: 48000,
      high: 51000,
      low: 47500,
      close: 50000.5,
      volume: 1234.567,
      closeTime: 1609545600000,
    });
  });

  it('소수점이 많은 Kline 데이터를 올바르게 처리해야 함', () => {
    const 소수점_많은_kline: BinanceKlineResponse = [
      1609459200000,
      '0.00001234',
      '0.00001250',
      '0.00001200',
      '0.00001240',
      '1000000.123456',
      1609545600000,
      '12.345678',
      1000,
      '500000.50',
      '6.123456',
      '0',
    ];

    const 결과 = adaptBinanceKline(소수점_많은_kline);

    expect(결과.open).toBe(0.00001234);
    expect(결과.high).toBe(0.0000125);
    expect(결과.low).toBe(0.000012);
    expect(결과.close).toBe(0.0000124);
    expect(결과.volume).toBe(1000000.123456);
  });
});

describe('adaptBinanceTickerStream', () => {
  const 기본_스트림_메시지: BinanceTickerStreamMessage = {
    stream: 'btcusdt@ticker',
    data: {
      e: '24hrTicker',
      E: 1609545600000,
      s: 'BTCUSDT',
      p: '1000.50',
      P: '2.08',
      w: '49500.00',
      x: '48000.00',
      c: '50000.50',
      Q: '0.001',
      b: '50000.00',
      B: '0.5',
      a: '50001.00',
      A: '0.3',
      o: '48000.00',
      h: '51000.00',
      l: '47500.00',
      v: '1234.567',
      q: '61123456.78',
      O: 1609459200000,
      C: 1609545600000,
      F: 1000000,
      L: 2000000,
      n: 1000000,
    },
  };

  it('WebSocket 티커 스트림 메시지를 올바르게 변환해야 함', () => {
    const 결과 = adaptBinanceTickerStream(기본_스트림_메시지);

    expect(결과).toEqual({
      symbol: 'BTCUSDT',
      price: 50000.5,
      priceChange: 1000.5,
      priceChangePercent: 2.08,
      volume: 1234.567,
      highPrice: 51000,
      lowPrice: 47500,
      lastUpdateTime: 1609545600000,
    });
  });

  it('음수 변동률을 올바르게 처리해야 함', () => {
    const 음수_변동률_메시지: BinanceTickerStreamMessage = {
      ...기본_스트림_메시지,
      data: {
        ...기본_스트림_메시지.data,
        p: '-500.25',
        P: '-1.02',
      },
    };

    const 결과 = adaptBinanceTickerStream(음수_변동률_메시지);

    expect(결과.priceChange).toBe(-500.25);
    expect(결과.priceChangePercent).toBe(-1.02);
  });

  it('다양한 심볼을 올바르게 처리해야 함', () => {
    const eth_메시지: BinanceTickerStreamMessage = {
      ...기본_스트림_메시지,
      stream: 'ethusdt@ticker',
      data: {
        ...기본_스트림_메시지.data,
        s: 'ETHUSDT',
        c: '3000.00',
      },
    };

    const 결과 = adaptBinanceTickerStream(eth_메시지);

    expect(결과.symbol).toBe('ETHUSDT');
    expect(결과.price).toBe(3000);
  });
});

describe('adaptBinanceKlineStream', () => {
  const 기본_kline_스트림_메시지: BinanceKlineStreamMessage = {
    stream: 'btcusdt@kline_1m',
    data: {
      e: 'kline',
      E: 1609545600000,
      s: 'BTCUSDT',
      k: {
        t: 1609459200000,
        T: 1609545600000,
        s: 'BTCUSDT',
        i: '1m',
        f: 1000000,
        L: 2000000,
        o: '48000.00',
        c: '50000.50',
        h: '51000.00',
        l: '47500.00',
        v: '1234.567',
        n: 1000000,
        x: true,
        q: '61123456.78',
        V: '60000000.00',
        Q: '3000000000.00',
        B: '0',
      },
    },
  };

  it('WebSocket Kline 스트림 메시지를 올바르게 변환해야 함', () => {
    const 결과 = adaptBinanceKlineStream(기본_kline_스트림_메시지);

    expect(결과).toEqual({
      openTime: 1609459200000,
      open: 48000,
      high: 51000,
      low: 47500,
      close: 50000.5,
      volume: 1234.567,
      closeTime: 1609545600000,
    });
  });

  it('닫히지 않은 Kline도 올바르게 처리해야 함', () => {
    const 열린_kline_메시지: BinanceKlineStreamMessage = {
      ...기본_kline_스트림_메시지,
      data: {
        ...기본_kline_스트림_메시지.data,
        k: {
          ...기본_kline_스트림_메시지.data.k,
          x: false,
        },
      },
    };

    const 결과 = adaptBinanceKlineStream(열린_kline_메시지);

    expect(결과.openTime).toBe(1609459200000);
    expect(결과.closeTime).toBe(1609545600000);
  });

  it('다양한 시간 간격의 Kline을 처리해야 함', () => {
    const 일봉_메시지: BinanceKlineStreamMessage = {
      ...기본_kline_스트림_메시지,
      stream: 'btcusdt@kline_1d',
      data: {
        ...기본_kline_스트림_메시지.data,
        k: {
          ...기본_kline_스트림_메시지.data.k,
          i: '1d',
        },
      },
    };

    const 결과 = adaptBinanceKlineStream(일봉_메시지);

    expect(결과.openTime).toBe(1609459200000);
    expect(결과.closeTime).toBe(1609545600000);
  });
});

