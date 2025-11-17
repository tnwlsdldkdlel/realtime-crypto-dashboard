/**
 * 즐겨찾기 코인 스토어
 * 영구적인 관심 코인 목록 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoriteStore {
  favorites: string[];
  addFavorite: (symbol: string) => void;
  removeFavorite: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
  isFavorite: (symbol: string) => boolean;
}

export const useFavoriteStore = create<FavoriteStore>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (symbol: string) =>
        set((state) => ({
          favorites: [...new Set([...state.favorites, symbol])],
        })),

      removeFavorite: (symbol: string) =>
        set((state) => ({
          favorites: state.favorites.filter((s) => s !== symbol),
        })),

      toggleFavorite: (symbol: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(symbol)) {
          removeFavorite(symbol);
        } else {
          addFavorite(symbol);
        }
      },

      isFavorite: (symbol: string) => get().favorites.includes(symbol),
    }),
    {
      name: 'crypto-favorites-storage',
    }
  )
);

