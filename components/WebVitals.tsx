'use client';

import { useEffect } from 'react';

/**
 * Web Vitals 측정 컴포넌트
 * Core Web Vitals (LCP, FID, CLS) 및 기타 성능 메트릭 측정
 */
export default function WebVitals() {
  useEffect(() => {
    // Web Vitals 측정 함수
    const measureWebVitals = () => {
      // LCP (Largest Contentful Paint) 측정
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
              renderTime?: number;
              loadTime?: number;
            };
            
            if (lastEntry) {
              const lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
              console.log('[Web Vitals] LCP:', lcp, 'ms');
            }
          });
          
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (error) {
          console.warn('LCP 측정 실패:', error);
        }

        // FID (First Input Delay) 측정
        try {
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              const fid = entry.processingStart - entry.startTime;
              console.log('[Web Vitals] FID:', fid, 'ms');
            });
          });
          
          fidObserver.observe({ entryTypes: ['first-input'] });
        } catch (error) {
          console.warn('FID 측정 실패:', error);
        }

        // CLS (Cumulative Layout Shift) 측정
        try {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries() as any[];
            entries.forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            
            console.log('[Web Vitals] CLS:', clsValue.toFixed(3));
          });
          
          clsObserver.observe({ entryTypes: ['layout-shift'] });
        } catch (error) {
          console.warn('CLS 측정 실패:', error);
        }

        // FCP (First Contentful Paint) 측정
        try {
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                console.log('[Web Vitals] FCP:', entry.startTime, 'ms');
              }
            });
          });
          
          fcpObserver.observe({ entryTypes: ['paint'] });
        } catch (error) {
          console.warn('FCP 측정 실패:', error);
        }

        // TTFB (Time to First Byte) 측정
        try {
          const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigationEntry) {
            const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
            console.log('[Web Vitals] TTFB:', ttfb, 'ms');
          }
        } catch (error) {
          console.warn('TTFB 측정 실패:', error);
        }
      }
    };

    // 개발 환경에서만 콘솔에 출력
    if (process.env.NODE_ENV === 'development') {
      measureWebVitals();
    }
  }, []);

  return null; // UI 렌더링 없음
}

