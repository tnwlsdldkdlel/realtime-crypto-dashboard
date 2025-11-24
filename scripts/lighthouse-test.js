#!/usr/bin/env node

/**
 * Lighthouse 자동화 테스트 스크립트
 * 스로틀링 ON/OFF 상태에서 성능을 측정하고 비교합니다.
 */

const fs = require('fs');
const path = require('path');

const PORT = 3003;
const URL = `http://localhost:${PORT}`;
const WAIT_TIME = 10000; // 10초 대기 (WebSocket 연결 및 데이터 로드 대기)

/**
 * Lighthouse 옵션 설정
 */
const lighthouseOptions = {
  logLevel: 'info',
  output: 'json',
  onlyCategories: ['performance'],
  throttling: {
    rttMs: 40,
    throughputKbps: 10 * 1024,
    cpuSlowdownMultiplier: 1,
  },
};

/**
 * Chrome 옵션 설정
 */
const chromeOptions = {
  chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
};

/**
 * Lighthouse 모듈 로드
 */
async function loadLighthouse() {
  if (!lighthouse || !chromeLauncher) {
    lighthouse = (await import('lighthouse')).default;
    chromeLauncher = (await import('chrome-launcher')).default;
  }
}

/**
 * Lighthouse 테스트 실행
 */
async function runLighthouseTest(throttleEnabled, testName) {
  await loadLighthouse();
  
  console.log(`\n🚀 ${testName} 테스트 시작...`);
  
  const chrome = await chromeLauncher.launch(chromeOptions);
  const options = {
    ...lighthouseOptions,
    port: chrome.port,
  };

  // URL에 throttle 파라미터 추가
  const testUrl = `${URL}?throttle=${throttleEnabled ? 'on' : 'off'}`;
  
  console.log(`📊 테스트 URL: ${testUrl}`);
  console.log(`⏳ ${WAIT_TIME / 1000}초 대기 중... (WebSocket 연결 대기)`);
  
  // 페이지 로드 대기
  await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));

  try {
    const runnerResult = await lighthouse(testUrl, options);
    
    const report = runnerResult.lhr;
    const metrics = report.audits;
    
    // 성능 점수
    const performanceScore = Math.round(report.categories.performance.score * 100);
    
    // 주요 메트릭
    const fcp = metrics['first-contentful-paint']?.numericValue || 0;
    const lcp = metrics['largest-contentful-paint']?.numericValue || 0;
    const tti = metrics['interactive']?.numericValue || 0;
    const tbt = metrics['total-blocking-time']?.numericValue || 0;
    const cls = metrics['cumulative-layout-shift']?.numericValue || 0;
    
    // 렌더링 관련 메트릭
    const renderBlockingResources = metrics['render-blocking-resources']?.details?.items?.length || 0;
    const unusedJavaScript = metrics['unused-javascript']?.details?.overallSavingsBytes || 0;
    
    const result = {
      testName,
      throttleEnabled,
      timestamp: new Date().toISOString(),
      performance: {
        score: performanceScore,
        metrics: {
          fcp: Math.round(fcp), // First Contentful Paint (ms)
          lcp: Math.round(lcp), // Largest Contentful Paint (ms)
          tti: Math.round(tti), // Time to Interactive (ms)
          tbt: Math.round(tbt), // Total Blocking Time (ms)
          cls: cls.toFixed(3), // Cumulative Layout Shift
        },
        details: {
          renderBlockingResources,
          unusedJavaScript: Math.round(unusedJavaScript / 1024), // KB
        },
      },
    };

    // 결과 저장
    const outputDir = path.join(process.cwd(), 'lighthouse-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `lighthouse-${throttleEnabled ? 'on' : 'off'}-${Date.now()}.json`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    
    console.log(`✅ ${testName} 완료!`);
    console.log(`📄 결과 저장: ${filepath}`);
    console.log(`📊 성능 점수: ${performanceScore}/100`);
    console.log(`   FCP: ${result.performance.metrics.fcp}ms`);
    console.log(`   LCP: ${result.performance.metrics.lcp}ms`);
    console.log(`   TTI: ${result.performance.metrics.tti}ms`);
    console.log(`   TBT: ${result.performance.metrics.tbt}ms`);
    console.log(`   CLS: ${result.performance.metrics.cls}`);
    
    await chrome.kill();
    return result;
  } catch (error) {
    console.error(`❌ ${testName} 실패:`, error);
    await chrome.kill();
    throw error;
  }
}

/**
 * 결과 비교 및 리포트 생성
 */
function compareResults(onResult, offResult) {
  console.log('\n📊 ========================================');
  console.log('📊 성능 비교 결과');
  console.log('📊 ========================================\n');

  const comparison = {
    performance: {
      score: {
        on: onResult.performance.score,
        off: offResult.performance.score,
        improvement: onResult.performance.score - offResult.performance.score,
        improvementPercent: ((onResult.performance.score - offResult.performance.score) / offResult.performance.score * 100).toFixed(1),
      },
    },
    metrics: {},
  };

  // 각 메트릭 비교
  Object.keys(onResult.performance.metrics).forEach((key) => {
    const onValue = parseFloat(onResult.performance.metrics[key]);
    const offValue = parseFloat(offResult.performance.metrics[key]);
    
    if (key === 'cls') {
      // CLS는 낮을수록 좋음
      comparison.metrics[key] = {
        on: onValue,
        off: offValue,
        improvement: offValue - onValue,
        improvementPercent: ((offValue - onValue) / offValue * 100).toFixed(1),
      };
    } else {
      // 나머지는 낮을수록 좋음 (ms)
      comparison.metrics[key] = {
        on: onValue,
        off: offValue,
        improvement: offValue - onValue,
        improvementPercent: ((offValue - onValue) / offValue * 100).toFixed(1),
      };
    }
  });

  // 콘솔 출력
  console.log('🎯 성능 점수:');
  console.log(`   스로틀링 ON:  ${comparison.performance.score.on}/100`);
  console.log(`   스로틀링 OFF: ${comparison.performance.score.off}/100`);
  console.log(`   개선: ${comparison.performance.score.improvement > 0 ? '+' : ''}${comparison.performance.score.improvement}점 (${comparison.performance.score.improvementPercent}%)\n`);

  console.log('⏱️  메트릭 비교:');
  Object.keys(comparison.metrics).forEach((key) => {
    const metric = comparison.metrics[key];
    const metricName = {
      fcp: 'First Contentful Paint',
      lcp: 'Largest Contentful Paint',
      tti: 'Time to Interactive',
      tbt: 'Total Blocking Time',
      cls: 'Cumulative Layout Shift',
    }[key] || key;

    console.log(`\n   ${metricName}:`);
    console.log(`     스로틀링 ON:  ${metric.on}${key === 'cls' ? '' : 'ms'}`);
    console.log(`     스로틀링 OFF: ${metric.off}${key === 'cls' ? '' : 'ms'}`);
    console.log(`     개선: ${metric.improvement > 0 ? '+' : ''}${metric.improvement}${key === 'cls' ? '' : 'ms'} (${metric.improvementPercent}%)`);
  });

  // 결과 저장
  const outputDir = path.join(process.cwd(), 'lighthouse-results');
  const comparisonFile = path.join(outputDir, `comparison-${Date.now()}.json`);
  fs.writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));
  
  console.log(`\n📄 비교 결과 저장: ${comparisonFile}`);
  console.log('\n✅ 테스트 완료!\n');

  return comparison;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🔍 Lighthouse 자동화 테스트 시작');
  console.log('=====================================\n');
  console.log(`🌐 테스트 URL: ${URL}`);
  console.log(`⏱️  각 테스트 대기 시간: ${WAIT_TIME / 1000}초\n`);

  try {
    // 스로틀링 ON 테스트
    const onResult = await runLighthouseTest(true, '스로틀링 ON');
    
    // 잠시 대기
    console.log('\n⏳ 5초 대기 중...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // 스로틀링 OFF 테스트
    const offResult = await runLighthouseTest(false, '스로틀링 OFF');
    
    // 결과 비교
    compareResults(onResult, offResult);
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 치명적 오류:', error);
    process.exit(1);
  });
}

module.exports = { runLighthouseTest, compareResults };

