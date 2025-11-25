/**
 * 전역 로딩 UI
 * 페이지 전환 시 표시되는 로딩 화면
 */

import LoadingSpinner from '@/components/LoadingSpinner';

export default function Loading() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner text="페이지를 불러오는 중..." size="lg" />
      </div>
    </main>
  );
}

