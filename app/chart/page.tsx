/**
 * 차트 페이지 (Server Component)
 * 차트 전용 페이지 (Phase 5에서 구현 예정)
 */

export const dynamic = 'force-dynamic';

export default async function ChartPage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">차트</h2>
          <p className="text-gray-400">
            코인 차트를 확인하세요 (Phase 5에서 구현 예정)
          </p>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            차트 기능은 Phase 5에서 구현될 예정입니다
          </p>
        </div>
      </div>
    </main>
  );
}

