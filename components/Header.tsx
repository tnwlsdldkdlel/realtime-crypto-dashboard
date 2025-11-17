/**
 * 헤더 컴포넌트
 * 네비게이션 및 앱 제목 표시
 */

export default function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white">
              실시간 암호화폐 대시보드
            </h1>
            <span className="px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-400 rounded">
              LIVE
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="#"
              className="text-gray-300 hover:text-white transition-colors"
            >
              코인 목록
            </a>
            <a
              href="#"
              className="text-gray-300 hover:text-white transition-colors"
            >
              차트
            </a>
            <a
              href="#"
              className="text-gray-300 hover:text-white transition-colors"
            >
              즐겨찾기
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}

