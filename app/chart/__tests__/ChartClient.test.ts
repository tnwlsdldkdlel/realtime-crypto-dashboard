import { describe, it, expect } from 'vitest';
import { convertKlineToCandlestick } from '../ChartClient';
import type { BinanceKlineResponse } from '@/types/binance';

describe('convertKlineToCandlestick', () => {
  it('Binance Kline 배열을 CandlestickData로 올바르게 변환해야 함', () => {
    const kline: BinanceKlineResponse = [
      1609459200000, // openTime (밀리초)
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

    const result = convertKlineToCandlestick(kline);

    expect(result).toEqual({
      time: 1609459200, // 초 단위로 변환됨
      open: 48000,
      high: 51000,
      low: 47500,
      close: 50000.5,
    });
  });

  it('소수점이 많은 가격을 올바르게 처리해야 함', () => {
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

    const result = convertKlineToCandlestick(소수점_많은_kline);

    expect(result.open).toBe(0.00001234);
    expect(result.high).toBe(0.0000125);
    expect(result.low).toBe(0.000012);
    expect(result.close).toBe(0.0000124);
  });

  it('음수 가격은 없지만 엣지 케이스로 처리해야 함', () => {
    const 매우_작은_가격_kline: BinanceKlineResponse = [
      1609459200000,
      '0.00000001',
      '0.00000002',
      '0.00000001',
      '0.00000001',
      '1000',
      1609545600000,
      '0.00001',
      10,
      '500',
      '0.000005',
      '0',
    ];

    const result = convertKlineToCandlestick(매우_작은_가격_kline);

    expect(result.open).toBe(0.00000001);
    expect(result.high).toBe(0.00000002);
    expect(result.low).toBe(0.00000001);
    expect(result.close).toBe(0.00000001);
  });

  it('시간 변환이 올바르게 이루어져야 함', () => {
    const kline: BinanceKlineResponse = [
      1704067200000, // 2024-01-01 00:00:00 UTC (밀리초)
      '50000.00',
      '51000.00',
      '49000.00',
      '50500.00',
      '1000',
      1704153600000,
      '50000000',
      1000,
      '25000000',
      '125000000',
      '0',
    ];

    const result = convertKlineToCandlestick(kline);

    // 밀리초를 초로 변환: 1704067200000 / 1000 = 1704067200
    expect(result.time).toBe(1704067200);
  });

  it('여러 개의 Kline 데이터를 일괄 변환할 수 있어야 함', () => {
    const klines: BinanceKlineResponse[] = [
      [
        1609459200000,
        '48000.00',
        '51000.00',
        '47500.00',
        '50000.50',
        '1234.567',
        1609545600000,
        '61123456.78',
        1000000,
        '60000000.00',
        '3000000000.00',
        '0',
      ],
      [
        1609545600000,
        '50000.50',
        '52000.00',
        '49500.00',
        '51500.00',
        '1500.123',
        1609632000000,
        '75000000.00',
        1200000,
        '70000000.00',
        '3500000000.00',
        '0',
      ],
    ];

    const results = klines.map(convertKlineToCandlestick);

    expect(results).toHaveLength(2);
    expect(results[0].close).toBe(50000.5);
    expect(results[1].open).toBe(50000.5); // 다음 캔들의 시작가 = 이전 캔들의 종가
    expect(results[1].close).toBe(51500);
  });
});

