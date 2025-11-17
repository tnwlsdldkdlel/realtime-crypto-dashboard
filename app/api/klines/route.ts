/**
 * Kline (OHLCV) 데이터 API Route
 * Next.js 서버 측에서 Binance REST API를 프록시
 */

import { NextResponse } from 'next/server';

const BINANCE_API_BASE_URL = 'https://api.binance.com/api/v3';

async function fetchWithRetry(
  url: string,
  retries = 3,
  retryDelay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Failed to fetch after retries');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1m';
    const limit = searchParams.get('limit') || '500';
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    let url = `${BINANCE_API_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    if (startTime) {
      url += `&startTime=${startTime}`;
    }
    if (endTime) {
      url += `&endTime=${endTime}`;
    }

    const response = await fetchWithRetry(url);
    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Error fetching klines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch klines' },
      { status: 500 }
    );
  }
}

