/**
 * API 응답 캐시 유틸리티
 * Rate Limit을 피하기 위해 캐시된 데이터를 우선 사용
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * 메모리 기반 캐시 저장소
 */
class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 60000; // 기본 TTL: 60초

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * 캐시에서 데이터 조회
   * @returns 캐시된 데이터 또는 null (만료되었거나 없음)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 만료 확인
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 캐시에 데이터가 있는지 확인 (만료되지 않은 경우)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 특정 키의 캐시 삭제
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 만료된 캐시 항목 정리
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// 싱글톤 인스턴스
export const apiCache = new ApiCache();

// 주기적으로 만료된 캐시 정리 (5분마다)
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}

