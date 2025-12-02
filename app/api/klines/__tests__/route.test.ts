import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { GET } from '../route';
import type { BinanceKlineResponse } from '@/types/binance';

// fetch 모킹
global.fetch = vi.fn();

describe('GET /api/klines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('symbol 파라미터가 없으면 400 에러를 반환해야 함', async () => {
    const request = new Request('http://localhost:3003/api/klines');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Symbol parameter is required' });
  });

  it('올바른 파라미터로 Kline 데이터를 반환해야 함', async () => {
    const mockKlineData: BinanceKlineResponse[] = [
      [
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
      ],
    ];

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockKlineData,
    });

    const request = new Request('http://localhost:3003/api/klines?symbol=BTCUSDT&interval=1m&limit=500');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockKlineData);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('symbol=BTCUSDT&interval=1m&limit=500'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('기본 interval과 limit을 사용해야 함', async () => {
    const mockKlineData: BinanceKlineResponse[] = [];

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockKlineData,
    });

    const request = new Request('http://localhost:3003/api/klines?symbol=BTCUSDT');
    await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('interval=1m&limit=500'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('startTime과 endTime 파라미터를 지원해야 함', async () => {
    const mockKlineData: BinanceKlineResponse[] = [];

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockKlineData,
    });

    const request = new Request(
      'http://localhost:3003/api/klines?symbol=BTCUSDT&startTime=1609459200000&endTime=1609545600000'
    );
    await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('startTime=1609459200000&endTime=1609545600000'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('429 Rate Limit 에러를 재시도해야 함', async () => {
    // 첫 번째 호출: 429 에러
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '1' }),
    });

    // 두 번째 호출: 성공
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [],
    });

    const request = new Request('http://localhost:3003/api/klines?symbol=BTCUSDT');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('재시도 후에도 실패하면 500 에러를 반환해야 함', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

    const request = new Request('http://localhost:3003/api/klines?symbol=BTCUSDT');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to fetch klines');
    expect(data).toHaveProperty('message');
  });

  it('다양한 interval을 지원해야 함', async () => {
    const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

    for (const interval of intervals) {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
      });

      const request = new Request(
        `http://localhost:3003/api/klines?symbol=BTCUSDT&interval=${interval}`
      );
      await GET(request);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`interval=${interval}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    }
  });
});

