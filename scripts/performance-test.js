#!/usr/bin/env node

/**
 * Chrome DevTools Performance API를 사용한 성능 테스트 스크립트
 * 스로틀링 ON/OFF 상태에서 실시간 업데이트 성능을 측정합니다.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PORT = 3003;
const URL = `http://localhost:${PORT}`;
const WAIT_TIME = 10000; // 10초 대기 (WebSocket 연결 및 데이터 로드)
const MEASURE_TIME = 10000; // 10초간 성능 측정

/**
 * CPU 사용량 분석
 */
function analyzeCPUUsage(trace) {
  const events = trace.traceEvents || [];
  const mainThreadEvents = events.filter(
    (e) => e.tid === trace.mainThreadId && e.dur
  );

  const totalDuration = MEASURE_TIME * 1000; // 마이크로초
  let totalCPUTime = 0;

  mainThreadEvents.forEach((event) => {
    if (event.dur) {
      totalCPUTime += event.dur;
    }
  });

  const cpuUsage = (totalCPUTime / totalDuration) * 100;

  // Long Task 감지 (50ms 이상)
  const longTasks = mainThreadEvents.filter(
    (e) => e.dur && e.dur > 50000
  );

  return {
    cpuUsage: Math.round(cpuUsage * 100) / 100,
    totalCPUTime: Math.round(totalCPUTime / 1000), // ms
    longTasks: longTasks.length,
    avgTaskDuration: mainThreadEvents.length > 0
      ? Math.round(
          (mainThreadEvents.reduce((sum, e) => sum + (e.dur || 0), 0) /
            mainThreadEvents.length) /
            1000
        )
      : 0,
  };
}

/**
 * 성능 측정 실행
 */
async function measurePerformance(throttleEnabled, testName) {
  console.log(`\n🚀 ${testName} 테스트 시작...`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Performance API 활성화
  await page.tracing.start({ screenshots: false, path: 'trace.json' });

  const testUrl = `${URL}?throttle=${throttleEnabled ? 'on' : 'off'}`;
  console.log(`📊 테스트 URL: ${testUrl}`);
  console.log(`⏳ ${WAIT_TIME / 1000}초 대기 중... (WebSocket 연결 대기)`);

  // 페이지 로드
  await page.goto(testUrl, { waitUntil: 'networkidle0' });

  // WebSocket 연결 및 데이터 로드 대기
  await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));

  console.log(`📈 ${MEASURE_TIME / 1000}초간 성능 측정 중...`);

  // 브라우저 Performance API로 측정
  const metrics = await page.evaluate((measureTime) => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const fpsData = [];
      const renderTimes = [];
      let frameCount = 0;
      let lastFpsTime = performance.now();

      // FPS 측정
      function measureFrame() {
        const now = performance.now();
        frameCount++;

        // 1초마다 FPS 기록
        if (now - lastFpsTime >= 1000) {
          fpsData.push(frameCount);
          frameCount = 0;
          lastFpsTime = now;
        }

        // 렌더링 시간 측정
        const renderStart = performance.now();
        requestAnimationFrame(() => {
          const renderTime = performance.now() - renderStart;
          renderTimes.push(renderTime);
        });

        if (now - startTime < measureTime) {
          requestAnimationFrame(measureFrame);
        } else {
          // 측정 완료
          const memory = performance.memory
            ? {
                usedJSHeapSize: Math.round(
                  performance.memory.usedJSHeapSize / 1024 / 1024
                ),
                totalJSHeapSize: Math.round(
                  performance.memory.totalJSHeapSize / 1024 / 1024
                ),
                jsHeapSizeLimit: Math.round(
                  performance.memory.jsHeapSizeLimit / 1024 / 1024
                ),
              }
            : null;

          resolve({
            fps: {
              avg:
                fpsData.length > 0
                  ? Math.round(
                      (fpsData.reduce((a, b) => a + b, 0) / fpsData.length) *
                        100
                    ) / 100
                  : 0,
              min: fpsData.length > 0 ? Math.min(...fpsData) : 0,
              max: fpsData.length > 0 ? Math.max(...fpsData) : 0,
              samples: fpsData.length,
            },
            renderTime: {
              avg:
                renderTimes.length > 0
                  ? Math.round(
                      (renderTimes.reduce((a, b) => a + b, 0) /
                        renderTimes.length) *
                        100
                    ) / 100
                  : 0,
              min:
                renderTimes.length > 0
                  ? Math.round(Math.min(...renderTimes) * 100) / 100
                  : 0,
              max:
                renderTimes.length > 0
                  ? Math.round(Math.max(...renderTimes) * 100) / 100
                  : 0,
              samples: renderTimes.length,
            },
            memory,
          });
        }
      }

      requestAnimationFrame(measureFrame);
    });
  }, MEASURE_TIME);

  // Tracing 중지
  await page.tracing.stop();

  // CPU 사용량 분석
  let cpuUsage = null;
  try {
    const trace = JSON.parse(fs.readFileSync('trace.json', 'utf8'));
    cpuUsage = analyzeCPUUsage(trace);
    fs.unlinkSync('trace.json'); // 임시 파일 삭제
  } catch (error) {
    console.warn('⚠️  CPU 사용량 분석 실패:', error.message);
  }

  await browser.close();

  const result = {
    testName,
    throttleEnabled,
    timestamp: new Date().toISOString(),
    performance: {
      fps: metrics.fps,
      renderTime: metrics.renderTime,
      memory: metrics.memory,
      cpu: cpuUsage,
    },
  };

  // 결과 저장
  const outputDir = path.join(process.cwd(), 'performance-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `performance-${throttleEnabled ? 'on' : 'off'}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

  console.log(`✅ ${testName} 완료!`);
  console.log(`📄 결과 저장: ${filepath}`);
  console.log(`📊 FPS: 평균 ${result.performance.fps.avg}, 최소 ${result.performance.fps.min}, 최대 ${result.performance.fps.max}`);
  console.log(`   렌더링 시간: 평균 ${result.performance.renderTime.avg}ms, 최소 ${result.performance.renderTime.min}ms, 최대 ${result.performance.renderTime.max}ms`);
  if (result.performance.cpu) {
    console.log(`   CPU 사용률: ${result.performance.cpu.cpuUsage}%`);
    console.log(`   Long Tasks: ${result.performance.cpu.longTasks}개`);
  }
  if (result.performance.memory) {
    console.log(`   메모리 사용량: ${result.performance.memory.usedJSHeapSize}MB / ${result.performance.memory.totalJSHeapSize}MB`);
  }

  return result;
}

/**
 * 결과 비교 및 리포트 생성
 */
function compareResults(onResult, offResult) {
  console.log('\n📊 ========================================');
  console.log('📊 성능 비교 결과');
  console.log('📊 ========================================\n');

  const comparison = {
    fps: {
      on: onResult.performance.fps.avg,
      off: offResult.performance.fps.avg,
      improvement: onResult.performance.fps.avg - offResult.performance.fps.avg,
      improvementPercent: offResult.performance.fps.avg > 0
        ? ((onResult.performance.fps.avg - offResult.performance.fps.avg) / offResult.performance.fps.avg * 100).toFixed(1)
        : '0',
    },
    renderTime: {
      on: onResult.performance.renderTime.avg,
      off: offResult.performance.renderTime.avg,
      improvement: offResult.performance.renderTime.avg - onResult.performance.renderTime.avg,
      improvementPercent: offResult.performance.renderTime.avg > 0
        ? ((offResult.performance.renderTime.avg - onResult.performance.renderTime.avg) / offResult.performance.renderTime.avg * 100).toFixed(1)
        : '0',
    },
  };

  if (onResult.performance.cpu && offResult.performance.cpu) {
    comparison.cpu = {
      on: onResult.performance.cpu.cpuUsage,
      off: offResult.performance.cpu.cpuUsage,
      improvement: offResult.performance.cpu.cpuUsage - onResult.performance.cpu.cpuUsage,
      improvementPercent: offResult.performance.cpu.cpuUsage > 0
        ? ((offResult.performance.cpu.cpuUsage - onResult.performance.cpu.cpuUsage) / offResult.performance.cpu.cpuUsage * 100).toFixed(1)
        : '0',
    };
  }

  if (onResult.performance.memory && offResult.performance.memory) {
    comparison.memory = {
      on: onResult.performance.memory.usedJSHeapSize,
      off: offResult.performance.memory.usedJSHeapSize,
      improvement: offResult.performance.memory.usedJSHeapSize - onResult.performance.memory.usedJSHeapSize,
      improvementPercent: offResult.performance.memory.usedJSHeapSize > 0
        ? ((offResult.performance.memory.usedJSHeapSize - onResult.performance.memory.usedJSHeapSize) / offResult.performance.memory.usedJSHeapSize * 100).toFixed(1)
        : '0',
    };
  }

  // 콘솔 출력
  console.log('🎯 FPS (초당 프레임 수):');
  console.log(`   스로틀링 ON:  ${comparison.fps.on}`);
  console.log(`   스로틀링 OFF: ${comparison.fps.off}`);
  console.log(`   개선: ${comparison.fps.improvement > 0 ? '+' : ''}${comparison.fps.improvement.toFixed(2)} (${comparison.fps.improvementPercent}%)\n`);

  console.log('⏱️  평균 렌더링 시간:');
  console.log(`   스로틀링 ON:  ${comparison.renderTime.on}ms`);
  console.log(`   스로틀링 OFF: ${comparison.renderTime.off}ms`);
  console.log(`   개선: ${comparison.renderTime.improvement > 0 ? '+' : ''}${comparison.renderTime.improvement.toFixed(2)}ms (${comparison.renderTime.improvementPercent}%)\n`);

  if (comparison.cpu) {
    console.log('💻 CPU 사용률:');
    console.log(`   스로틀링 ON:  ${comparison.cpu.on}%`);
    console.log(`   스로틀링 OFF: ${comparison.cpu.off}%`);
    console.log(`   개선: ${comparison.cpu.improvement > 0 ? '+' : ''}${comparison.cpu.improvement.toFixed(2)}% (${comparison.cpu.improvementPercent}%)\n`);
  }

  if (comparison.memory) {
    console.log('🧠 메모리 사용량:');
    console.log(`   스로틀링 ON:  ${comparison.memory.on}MB`);
    console.log(`   스로틀링 OFF: ${comparison.memory.off}MB`);
    console.log(`   개선: ${comparison.memory.improvement > 0 ? '+' : ''}${comparison.memory.improvement.toFixed(2)}MB (${comparison.memory.improvementPercent}%)\n`);
  }

  // 결과 저장
  const outputDir = path.join(process.cwd(), 'performance-results');
  const comparisonFile = path.join(outputDir, `comparison-${Date.now()}.json`);
  fs.writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));

  console.log(`📄 비교 결과 저장: ${comparisonFile}`);
  console.log('\n✅ 테스트 완료!\n');

  return comparison;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🔍 Chrome DevTools Performance API 테스트 시작');
  console.log('=====================================\n');
  console.log(`🌐 테스트 URL: ${URL}`);
  console.log(`⏱️  각 테스트 대기 시간: ${WAIT_TIME / 1000}초`);
  console.log(`📈 성능 측정 시간: ${MEASURE_TIME / 1000}초\n`);

  try {
    // 스로틀링 ON 테스트
    const onResult = await measurePerformance(true, '스로틀링 ON');

    // 잠시 대기
    console.log('\n⏳ 5초 대기 중...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 스로틀링 OFF 테스트
    const offResult = await measurePerformance(false, '스로틀링 OFF');

    // 결과 비교
    compareResults(onResult, offResult);
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
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

module.exports = { measurePerformance, compareResults };

