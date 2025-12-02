import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 번들 크기 최적화
  experimental: {
    optimizePackageImports: ['@tanstack/react-virtual', 'lightweight-charts'],
  },
  // 이미지 최적화 (필요시)
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
