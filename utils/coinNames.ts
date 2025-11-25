/**
 * 코인 한국어 이름 유틸리티
 * JSON 파일과 CoinGecko API를 조합한 하이브리드 방식
 */

import coinNamesKO from '@/data/coinNamesKO.json';

// CoinGecko API 캐시 (메모리 캐시)
const coinNameCache = new Map<string, string>();

// CoinGecko API 기본 URL
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * 심볼에서 기본 코인 심볼 추출
 * 예: BTCUSDT -> btc, ETHUSDT -> eth
 */
function extractBaseSymbol(symbol: string): string {
  return symbol.replace('USDT', '').toLowerCase();
}

/**
 * CoinGecko API에서 모든 코인 목록 가져오기 (한 번만 호출)
 */
async function loadCoinListFromAPI(): Promise<void> {
  if (coinNameCache.has('_coinList')) {
    return; // 이미 로드됨
  }
  
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE_URL}/coins/list?include_platform=false`,
      {
        next: { revalidate: 86400 }, // 24시간 캐시
      }
    );
    
    if (response.ok) {
      const coinList = await response.json();
      // 심볼로 매핑 생성 (USDT 페어 형식으로)
      coinList.forEach((coin: { id: string; symbol: string; name: string }) => {
        const key = `${coin.symbol.toUpperCase()}USDT`;
        coinNameCache.set(key, coin.name);
      });
      coinNameCache.set('_coinList', 'loaded');
    }
  } catch (error) {
    console.error('Failed to fetch coin list from CoinGecko:', error);
  }
}

/**
 * 여러 코인의 한국어 이름을 배치로 가져오기
 * 서버 사이드에서 초기 로드 시 사용
 */
export async function getCoinNamesKOBatch(symbols: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  // JSON 파일에서 먼저 확인
  const jsonData = coinNamesKO as Record<string, string>;
  const missingSymbols: string[] = [];
  
  symbols.forEach((symbol) => {
    if (jsonData[symbol]) {
      result[symbol] = jsonData[symbol];
    } else if (coinNameCache.has(symbol)) {
      const cached = coinNameCache.get(symbol);
      if (cached && cached !== 'loaded') {
        result[symbol] = cached;
      } else {
        missingSymbols.push(symbol);
      }
    } else {
      missingSymbols.push(symbol);
    }
  });
  
  // 없는 코인들만 API로 가져오기 (배치 처리)
  if (missingSymbols.length > 0) {
    // CoinGecko의 /coins/list를 한 번만 호출
    await loadCoinListFromAPI();
    
    // 캐시에서 다시 확인
    missingSymbols.forEach((symbol) => {
      if (coinNameCache.has(symbol)) {
        const cached = coinNameCache.get(symbol);
        if (cached && cached !== 'loaded') {
          result[symbol] = cached;
        } else {
          result[symbol] = symbol.replace('USDT', '');
        }
      } else {
        result[symbol] = symbol.replace('USDT', '');
      }
    });
  }
  
  return result;
}

