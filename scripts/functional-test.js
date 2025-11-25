/**
 * 기능 테스트 자동화 스크립트
 * Puppeteer를 사용하여 주요 기능을 자동으로 테스트
 */

const puppeteer = require('puppeteer');

const URL = process.env.TEST_URL || 'http://localhost:3003';
const WAIT_TIME = 5000; // WebSocket 연결 대기 시간
const TIMEOUT = 30000; // 테스트 타임아웃

/**
 * 테스트 결과 저장
 */
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

/**
 * 테스트 헬퍼 함수
 */
function logTest(name, passed, message = '') {
  if (passed) {
    testResults.passed.push(name);
    console.log(`✅ ${name}${message ? `: ${message}` : ''}`);
  } else {
    testResults.failed.push({ name, message });
    console.log(`❌ ${name}${message ? `: ${message}` : ''}`);
  }
}

function logWarning(name, message) {
  testResults.warnings.push({ name, message });
  console.log(`⚠️  ${name}: ${message}`);
}

/**
 * 페이지 로드 및 초기 데이터 테스트
 */
async function testInitialLoad(page) {
  console.log('\n📋 1. 초기 로딩 테스트');
  console.log('----------------------------------------');

  try {
    // 페이지 로드
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    logTest('페이지 로드', true);

    // 코인 목록이 표시되는지 확인
    const coinListExists = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table !== null;
    });
    logTest('코인 목록 표시', coinListExists);

    // 코인 개수 확인
    const coinCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      return rows.length;
    });
    logTest(`코인 개수 확인 (${coinCount}개)`, coinCount > 0);

    // WebSocket 상태 확인
    const wsStatus = await page.evaluate(() => {
      const statusText = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent?.includes('실시간 업데이트') || p.textContent?.includes('연결')
      );
      return statusText?.textContent || '';
    });
    logTest('WebSocket 상태 표시', wsStatus.length > 0, wsStatus);

    return { coinCount, wsStatus };
  } catch (error) {
    logTest('초기 로딩', false, error.message);
    throw error;
  }
}

/**
 * 정렬 기능 테스트
 */
async function testSorting(page) {
  console.log('\n📋 2. 정렬 기능 테스트');
  console.log('----------------------------------------');

  try {
    // 현재가 컬럼 클릭
    const priceHeader = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('th button'));
      return buttons.find((btn) => btn.textContent?.includes('현재가'));
    });
    
    if (priceHeader && priceHeader.asElement()) {
      await priceHeader.click();
      await new Promise((resolve) => setTimeout(resolve, 500)); // 정렬 완료 대기

      // 정렬 방향 표시 확인
      await new Promise((resolve) => setTimeout(resolve, 500));
      const sortIndicator = await page.evaluate(() => {
        const header = Array.from(document.querySelectorAll('th button')).find(
          (btn) => btn.textContent?.includes('현재가')
        );
        return header?.textContent?.includes('↑') || header?.textContent?.includes('↓');
      });
      logTest('현재가 정렬 (첫 클릭)', sortIndicator);

      // 다시 클릭하여 방향 토글
      await priceHeader.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const sortIndicator2 = await page.evaluate(() => {
        const header = Array.from(document.querySelectorAll('th button')).find(
          (btn) => btn.textContent?.includes('현재가')
        );
        return header?.textContent?.includes('↑') || header?.textContent?.includes('↓');
      });
      logTest('현재가 정렬 (방향 토글)', sortIndicator2);
    } else {
      logTest('현재가 정렬', false, '정렬 버튼을 찾을 수 없음');
    }

    // 24h 변동률 컬럼 클릭
    const changeHeader = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('th button'));
      return buttons.find((btn) => btn.textContent?.includes('24h 변동률'));
    });
    
    if (changeHeader && changeHeader.asElement()) {
      await changeHeader.asElement()?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const changeSortIndicator = await page.evaluate(() => {
        const header = Array.from(document.querySelectorAll('th button')).find(
          (btn) => btn.textContent?.includes('24h 변동률')
        );
        return header?.textContent?.includes('↑') || header?.textContent?.includes('↓');
      });
      logTest('24h 변동률 정렬', changeSortIndicator);
    } else {
      logTest('24h 변동률 정렬', false, '정렬 버튼을 찾을 수 없음');
    }
  } catch (error) {
    logTest('정렬 기능', false, error.message);
  }
}

/**
 * 필터링 기능 테스트
 */
async function testFiltering(page) {
  console.log('\n📋 3. 필터링 기능 테스트');
  console.log('----------------------------------------');

  try {
    // 검색 입력 필드 찾기
    const searchInput = await page.$('input[placeholder*="심볼"]');
    if (!searchInput) {
      logTest('검색 입력 필드', false, '검색 입력 필드를 찾을 수 없음');
      return;
    }

    logTest('검색 입력 필드', true);

    // BTC 검색
    await searchInput.type('BTC', { delay: 100 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const btcResults = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).filter((row) => {
        const symbol = row.querySelector('td span')?.textContent || '';
        return symbol.includes('BTC');
      }).length;
    });

    const totalRows = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });

    logTest('BTC 검색 필터링', btcResults > 0 && btcResults === totalRows, `${btcResults}개 결과`);

    // 검색어 지우기
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const allRows = await page.evaluate(() => {
      return document.querySelectorAll('tbody tr').length;
    });
    logTest('검색어 지우기 (전체 목록 복원)', allRows > btcResults);
  } catch (error) {
    logTest('필터링 기능', false, error.message);
  }
}

/**
 * 즐겨찾기 기능 테스트
 */
async function testFavorites(page) {
  console.log('\n📋 4. 즐겨찾기 기능 테스트');
  console.log('----------------------------------------');

  try {
    // 첫 번째 코인의 즐겨찾기 버튼 찾기
    const firstFavoriteButton = await page.$('tbody tr:first-child button[aria-label*="즐겨찾기"]');
    if (!firstFavoriteButton) {
      logTest('즐겨찾기 버튼', false, '즐겨찾기 버튼을 찾을 수 없음');
      return;
    }

    logTest('즐겨찾기 버튼', true);

    // 즐겨찾기 추가
    await firstFavoriteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // WebSocket 재구독 대기

    const isFavoriteAfterAdd = await page.evaluate(() => {
      const button = document.querySelector('tbody tr:first-child button[aria-label*="즐겨찾기"]');
      const svg = button?.querySelector('svg');
      return svg?.classList.contains('fill-yellow-400') || false;
    });
    logTest('즐겨찾기 추가', isFavoriteAfterAdd);

    // WebSocket 연결 상태 확인 (연결이 끊기지 않았는지)
    const wsStatusAfterAdd = await page.evaluate(() => {
      const statusText = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent?.includes('실시간 업데이트') || p.textContent?.includes('연결')
      );
      return statusText?.textContent || '';
    });
    const isConnected = wsStatusAfterAdd.includes('실시간 업데이트') || wsStatusAfterAdd.includes('연결 중');
    logTest('즐겨찾기 추가 후 WebSocket 연결 유지', isConnected, wsStatusAfterAdd);

    // 즐겨찾기 개수 확인
    const favoriteCount = await page.evaluate(() => {
      const favoriteText = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent?.includes('즐겨찾기')
      );
      const match = favoriteText?.textContent?.match(/(\d+)개/);
      return match ? parseInt(match[1], 10) : 0;
    });
    logTest('즐겨찾기 개수 표시', favoriteCount > 0, `${favoriteCount}개`);

    // 즐겨찾기 제거
    await firstFavoriteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const isFavoriteAfterRemove = await page.evaluate(() => {
      const button = document.querySelector('tbody tr:first-child button[aria-label*="즐겨찾기"]');
      const svg = button?.querySelector('svg');
      return !svg?.classList.contains('fill-yellow-400');
    });
    logTest('즐겨찾기 제거', isFavoriteAfterRemove);

    // WebSocket 연결 상태 확인
    const wsStatusAfterRemove = await page.evaluate(() => {
      const statusText = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent?.includes('실시간 업데이트') || p.textContent?.includes('연결')
      );
      return statusText?.textContent || '';
    });
    const isConnectedAfterRemove = wsStatusAfterRemove.includes('실시간 업데이트') || wsStatusAfterRemove.includes('연결 중');
    logTest('즐겨찾기 제거 후 WebSocket 연결 유지', isConnectedAfterRemove, wsStatusAfterRemove);
  } catch (error) {
    logTest('즐겨찾기 기능', false, error.message);
  }
}

/**
 * 실시간 업데이트 테스트
 */
async function testRealtimeUpdates(page) {
  console.log('\n📋 5. 실시간 업데이트 테스트');
  console.log('----------------------------------------');

  try {
    // 초기 가격 저장
    const initialPrice = await page.evaluate(() => {
      const firstPriceCell = document.querySelector('tbody tr:first-child td:nth-child(3) span');
      return firstPriceCell?.textContent?.replace('$', '').replace(/,/g, '') || '';
    });

    logTest('초기 가격 확인', initialPrice.length > 0, `$${initialPrice}`);

    // 5초 대기 (실시간 업데이트 확인)
    console.log('⏳ 5초 대기 중 (실시간 업데이트 확인)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 업데이트된 가격 확인
    const updatedPrice = await page.evaluate(() => {
      const firstPriceCell = document.querySelector('tbody tr:first-child td:nth-child(3) span');
      return firstPriceCell?.textContent?.replace('$', '').replace(/,/g, '') || '';
    });

    // 가격이 변경되었는지 확인 (변경되지 않을 수도 있음)
    const priceChanged = initialPrice !== updatedPrice;
    if (priceChanged) {
      logTest('실시간 가격 업데이트', true, `$${initialPrice} → $${updatedPrice}`);
    } else {
      logWarning('실시간 가격 업데이트', '가격이 변경되지 않았습니다 (정상일 수 있음)');
    }

    // 하이라이트 애니메이션 확인 (가격 변경 시)
    if (priceChanged) {
      // 하이라이트는 300ms 후 사라지므로 즉시 확인하면 없을 수 있음
      await new Promise((resolve) => setTimeout(resolve, 100));
      const hasHighlight = await page.evaluate(() => {
        const firstRow = document.querySelector('tbody tr:first-child');
        if (!firstRow) return false;
        // 클래스명 또는 인라인 스타일 확인
        const classList = Array.from(firstRow.classList);
        const hasHighlightClass = classList.some(cls => 
          cls.includes('green') || cls.includes('red')
        );
        // 또는 배경색 확인
        const bgColor = window.getComputedStyle(firstRow).backgroundColor;
        const hasHighlightColor = bgColor && (
          bgColor.includes('rgb(34, 197, 94)') || // green-500
          bgColor.includes('rgb(239, 68, 68)')    // red-500
        );
        return hasHighlightClass || hasHighlightColor;
      });
      // 하이라이트가 있으면 좋지만, 없어도 정상일 수 있음 (타이밍 문제)
      if (hasHighlight) {
        logTest('하이라이트 애니메이션', true, '하이라이트 확인됨');
      } else {
        logWarning('하이라이트 애니메이션', '하이라이트가 감지되지 않았습니다 (타이밍 문제일 수 있음)');
      }
    } else {
      logWarning('하이라이트 애니메이션', '가격 변경이 없어 하이라이트를 확인할 수 없습니다');
    }
  } catch (error) {
    logTest('실시간 업데이트', false, error.message);
  }
}

/**
 * 가상화 기능 테스트
 */
async function testVirtualization(page) {
  console.log('\n📋 6. 가상화 기능 테스트');
  console.log('----------------------------------------');

  try {
    // 스크롤 가능한 영역 확인
    const hasScrollableArea = await page.evaluate(() => {
      // 여러 방법으로 가상화 컨테이너 찾기
      const allDivs = Array.from(document.querySelectorAll('div'));
      const containers = allDivs.filter(div => {
        const style = div.getAttribute('style') || '';
        const hasHeight = style.includes('height: 600px') || style.includes('height:600px');
        const hasOverflow = style.includes('overflow-auto') || style.includes('overflow:auto');
        return hasHeight || hasOverflow;
      });
      return containers.length > 0;
    });
    logTest('가상화 컨테이너', hasScrollableArea, hasScrollableArea ? '컨테이너 확인됨' : '컨테이너를 찾을 수 없음');

    if (hasScrollableArea) {
      // 스크롤 테스트
      await page.evaluate(() => {
        const container = document.querySelector('[style*="height: 600px"]');
        if (container) {
          container.scrollTop = 500;
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 스크롤 후에도 행이 렌더링되는지 확인
      const rowsAfterScroll = await page.evaluate(() => {
        return document.querySelectorAll('tbody tr').length;
      });
      logTest('스크롤 후 렌더링', rowsAfterScroll > 0, `${rowsAfterScroll}개 행 렌더링`);
    }
  } catch (error) {
    logTest('가상화 기능', false, error.message);
  }
}

/**
 * 테스트 결과 요약
 */
function printSummary() {
  console.log('\n\n📊 테스트 결과 요약');
  console.log('========================================');
  console.log(`✅ 통과: ${testResults.passed.length}개`);
  console.log(`❌ 실패: ${testResults.failed.length}개`);
  console.log(`⚠️  경고: ${testResults.warnings.length}개`);

  if (testResults.failed.length > 0) {
    console.log('\n❌ 실패한 테스트:');
    testResults.failed.forEach(({ name, message }) => {
      console.log(`   - ${name}: ${message}`);
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  경고:');
    testResults.warnings.forEach(({ name, message }) => {
      console.log(`   - ${name}: ${message}`);
    });
  }

  const totalTests = testResults.passed.length + testResults.failed.length;
  const passRate = totalTests > 0 ? ((testResults.passed.length / totalTests) * 100).toFixed(1) : 0;
  console.log(`\n📈 통과율: ${passRate}%`);

  return testResults.failed.length === 0;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🧪 기능 테스트 자동화 시작');
  console.log('========================================');
  console.log(`🌐 테스트 URL: ${URL}`);
  console.log(`⏱️  WebSocket 연결 대기: ${WAIT_TIME / 1000}초\n`);

  let browser;
  try {
    // 브라우저 실행
    browser = await puppeteer.launch({
      headless: false, // 테스트를 보기 위해 headless: false
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });

    // 콘솔 로그 캡처
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        console.log(`🔴 브라우저 에러: ${msg.text()}`);
      }
    });

    // 에러 캡처
    page.on('pageerror', (error) => {
      console.log(`🔴 페이지 에러: ${error.message}`);
    });

    // 1. 초기 로딩 테스트
    const { coinCount } = await testInitialLoad(page);

    // WebSocket 연결 대기
    console.log(`\n⏳ WebSocket 연결 대기 중... (${WAIT_TIME / 1000}초)`);
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));

    // 2. 정렬 기능 테스트
    if (coinCount > 0) {
      await testSorting(page);
    }

    // 3. 필터링 기능 테스트
    await testFiltering(page);

    // 4. 즐겨찾기 기능 테스트
    await testFavorites(page);

    // 5. 실시간 업데이트 테스트
    await testRealtimeUpdates(page);

    // 6. 가상화 기능 테스트
    await testVirtualization(page);

    // 결과 요약
    const allPassed = printSummary();

    // 브라우저를 잠시 열어두어 결과 확인 가능하게
    console.log('\n⏳ 10초 후 브라우저를 닫습니다...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await browser.close();

    // 테스트 결과에 따라 종료 코드 설정
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error);
    if (browser) {
      await browser.close();
    }
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

module.exports = { main };

