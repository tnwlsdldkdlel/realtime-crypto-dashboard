/**
 * 헤더 컴포넌트
 * 네비게이션 및 앱 제목 표시
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 cursor-pointer">
              <h1 className="text-2xl font-bold text-white">
                실시간 암호화폐 대시보드
              </h1>
              <span className="px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-400 rounded">
                LIVE
              </span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className={`transition-colors cursor-pointer ${
                isActive('/') && pathname !== '/favorites' && pathname !== '/chart'
                  ? 'text-white font-semibold'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              코인 목록
            </Link>
            <Link
              href="/chart"
              className={`transition-colors cursor-pointer ${
                isActive('/chart')
                  ? 'text-white font-semibold'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              차트
            </Link>
            <Link
              href="/favorites"
              className={`transition-colors cursor-pointer ${
                isActive('/favorites')
                  ? 'text-white font-semibold'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              즐겨찾기
            </Link>
            <Link
              href="/stats"
              className={`transition-colors cursor-pointer ${
                isActive('/stats')
                  ? 'text-white font-semibold'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              성능 통계
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

