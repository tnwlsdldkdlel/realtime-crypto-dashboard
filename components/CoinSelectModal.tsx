'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Ticker } from '@/types';
import { useFavoriteStore } from '@/stores/favoriteStore';

interface CoinSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  coins: Ticker[];
  selectedSymbol: string;
}

/**
 * 코인 선택 모달 컴포넌트
 * 검색 기능과 즐겨찾기 우선 표시 지원
 */
export default function CoinSelectModal({
  isOpen,
  onClose,
  onSelect,
  coins,
  selectedSymbol,
}: CoinSelectModalProps) {
  const { isFavorite } = useFavoriteStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(50); // 초기 표시 개수
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 모달이 열릴 때 검색 입력에 포커스 및 초기화
  useEffect(() => {
    if (!isOpen) return;
    
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    // 모달이 열릴 때만 초기화하므로 isOpen만 의존성으로 사용
    setSearchQuery('');
    setHighlightedIndex(0);
    setDisplayCount(50);
  }, [isOpen]);

  // 필터링 및 정렬된 코인 목록
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) {
      // 검색어가 없으면 즐겨찾기 우선, 그 다음 전체
      const favoriteCoins = coins.filter((coin) => isFavorite(coin.symbol));
      const otherCoins = coins.filter((coin) => !isFavorite(coin.symbol));
      return [...favoriteCoins, ...otherCoins];
    }

    // 검색어가 있으면 필터링
    const query = searchQuery.trim().toUpperCase();
    return coins.filter((coin) => {
      const symbolMatch = coin.symbol.toUpperCase().includes(query);
      const nameMatch = coin.nameKO?.toUpperCase().includes(query) || false;
      return symbolMatch || nameMatch;
    });
  }, [coins, searchQuery, isFavorite]);

  // 표시할 코인 목록 (무한 스크롤용)
  const displayedCoins = useMemo(() => {
    // 검색 중일 때는 필터링된 결과 모두 표시
    if (searchQuery.trim()) {
      return filteredCoins;
    }
    // 검색 중이 아닐 때는 displayCount만큼만 표시
    return filteredCoins.slice(0, displayCount);
  }, [filteredCoins, displayCount, searchQuery]);

  // 더 로드할 항목이 있는지 확인
  const hasMore = !searchQuery.trim() && displayCount < filteredCoins.length;

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const nextIndex = prev < displayedCoins.length - 1 ? prev + 1 : prev;
          // 하단에 가까우면 더 로드
          if (nextIndex >= displayCount - 5 && hasMore) {
            setDisplayCount((current) => Math.min(current + 50, filteredCoins.length));
          }
          return nextIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (displayedCoins[highlightedIndex]) {
          onSelect(displayedCoins[highlightedIndex].symbol);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayedCoins, highlightedIndex, displayCount, hasMore, filteredCoins.length, onSelect, onClose]);

  // 코인 항목 렌더링 함수
  const renderCoinItem = (coin: Ticker, index: number) => {
    const isHighlighted = index === highlightedIndex;
    const isSelected = coin.symbol === selectedSymbol;
    const isFav = isFavorite(coin.symbol);
    const displayName = coin.nameKO
      ? `${coin.symbol} - ${coin.nameKO}`
      : coin.symbol;

    return (
      <button
        key={coin.symbol}
        onClick={() => {
          onSelect(coin.symbol);
          onClose();
        }}
        onMouseEnter={() => setHighlightedIndex(index)}
        className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors cursor-pointer ${
          isHighlighted ? 'bg-gray-700' : ''
        } ${isSelected ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''}`}
      >
        <div className="flex items-center gap-2">
          {isFav && (
            <span className="text-yellow-400">⭐</span>
          )}
          <span className={`flex-1 ${isSelected ? 'font-semibold text-blue-400' : 'text-white'}`}>
            {displayName}
          </span>
          {isSelected && (
            <span className="text-blue-400 text-sm">✓</span>
          )}
        </div>
      </button>
    );
  };

  // 하이라이트된 항목이 보이도록 스크롤
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('button');
      const highlightedElement = items[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  // 무한 스크롤: Intersection Observer로 더 로드하기
  useEffect(() => {
    if (!isOpen || !hasMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // 50개씩 추가 로드
          setDisplayCount((prev) => Math.min(prev + 50, filteredCoins.length));
        }
      },
      {
        root: listRef.current,
        rootMargin: '100px', // 100px 전에 미리 로드
        threshold: 0.1,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isOpen, hasMore, filteredCoins.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">코인 선택</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="심볼 또는 코인명으로 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              className="w-full px-4 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* 코인 목록 */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: 'calc(80vh - 200px)', minHeight: '200px' }}
        >
          {displayedCoins.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {/* 즐겨찾기 섹션 (검색어가 없을 때만) */}
              {!searchQuery.trim() && displayedCoins.some((coin) => isFavorite(coin.symbol)) && (
                <>
                  <div className="px-4 py-2 bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase">
                    ⭐ 즐겨찾기
                  </div>
                  {displayedCoins
                    .filter((coin) => isFavorite(coin.symbol))
                    .map((coin) => {
                      const actualIndex = displayedCoins.findIndex((c) => c.symbol === coin.symbol);
                      return renderCoinItem(coin, actualIndex);
                    })}
                  <div className="px-4 py-2 bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase">
                    전체 코인
                  </div>
                </>
              )}
              {/* 전체 코인 목록 */}
              {displayedCoins
                .filter((coin) => searchQuery.trim() || !isFavorite(coin.symbol))
                .map((coin) => {
                  const actualIndex = displayedCoins.findIndex((c) => c.symbol === coin.symbol);
                  return renderCoinItem(coin, actualIndex);
                })}
              {/* 무한 스크롤 트리거 */}
              {hasMore && (
                <div
                  ref={loadMoreRef}
                  className="px-4 py-4 text-center text-gray-400 text-sm"
                >
                  더 불러오는 중...
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
          <p>↑↓ 키로 이동, Enter로 선택, Esc로 닫기</p>
        </div>
      </div>
    </div>
  );
}

