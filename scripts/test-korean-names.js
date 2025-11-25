/**
 * 한국어 코인 이름 테스트 스크립트
 * 하이브리드 방식 (JSON + CoinGecko API) 동작 확인
 */

const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';

async function testKoreanNames() {
  console.log('🚀 한국어 코인 이름 테스트 시작...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  try {
    // 페이지 로드
    console.log(`📄 페이지 로드: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // WebSocket 연결 대기 (더 유연한 선택자)
    console.log('⏳ WebSocket 연결 대기...');
    try {
      await page.waitForFunction(
        () => {
          const statusText = document.body.innerText;
          return statusText.includes('연결됨') || statusText.includes('연결 중') || statusText.includes('connected');
        },
        { timeout: 15000 }
      );
    } catch (error) {
      console.log('⚠️  WebSocket 상태 확인 스킵, 계속 진행...');
    }
    
    // 추가 로딩 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // 테이블 데이터 확인
    console.log('\n📊 한국어 이름 표시 확인...');
    
    const koreanNames = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[style*="grid-template-columns"]'));
      const results = [];
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('div');
        if (cells.length >= 3) {
          const symbol = cells[1]?.textContent?.trim() || '';
          const koreanName = cells[2]?.textContent?.trim() || '';
          
          if (symbol && koreanName) {
            results.push({
              symbol,
              koreanName,
              hasKoreanName: koreanName !== symbol && !koreanName.endsWith('USDT'),
            });
          }
        }
      });
      
      return results;
    });
    
    // 결과 분석
    const totalCoins = koreanNames.length;
    const coinsWithKoreanName = koreanNames.filter((c) => c.hasKoreanName).length;
    const coinsWithoutKoreanName = totalCoins - coinsWithKoreanName;
    
    console.log(`\n✅ 테스트 결과:`);
    console.log(`   전체 코인 수: ${totalCoins}`);
    console.log(`   한국어 이름 있음: ${coinsWithKoreanName} (${((coinsWithKoreanName / totalCoins) * 100).toFixed(1)}%)`);
    console.log(`   한국어 이름 없음: ${coinsWithoutKoreanName} (${((coinsWithoutKoreanName / totalCoins) * 100).toFixed(1)}%)`);
    
    // 샘플 출력
    console.log(`\n📝 샘플 데이터 (처음 10개):`);
    koreanNames.slice(0, 10).forEach((coin, index) => {
      const status = coin.hasKoreanName ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${coin.symbol} → ${coin.koreanName}`);
    });
    
    // 한국어 이름이 없는 코인들
    const missingNames = koreanNames.filter((c) => !c.hasKoreanName);
    if (missingNames.length > 0) {
      console.log(`\n⚠️  한국어 이름이 없는 코인 (처음 5개):`);
      missingNames.slice(0, 5).forEach((coin) => {
        console.log(`   - ${coin.symbol}`);
      });
    }
    
    // WebSocket 업데이트 후 한국어 이름 유지 확인
    console.log('\n🔄 WebSocket 업데이트 후 한국어 이름 유지 확인...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5초 대기
    
    const koreanNamesAfterUpdate = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[style*="grid-template-columns"]'));
      const results = [];
      
      rows.forEach((row) => {
        const cells = row.querySelectorAll('div');
        if (cells.length >= 3) {
          const symbol = cells[1]?.textContent?.trim() || '';
          const koreanName = cells[2]?.textContent?.trim() || '';
          
          if (symbol && koreanName) {
            results.push({
              symbol,
              koreanName,
            });
          }
        }
      });
      
      return results;
    });
    
    // 업데이트 전후 비교
    const maintainedNames = koreanNames.filter((before) => {
      const after = koreanNamesAfterUpdate.find((a) => a.symbol === before.symbol);
      return after && after.koreanName === before.koreanName;
    }).length;
    
    console.log(`   업데이트 전후 일치: ${maintainedNames}/${totalCoins} 코인`);
    
    // 최종 평가
    const successRate = (coinsWithKoreanName / totalCoins) * 100;
    console.log(`\n${successRate >= 80 ? '✅' : '⚠️'} 최종 평가:`);
    if (successRate >= 80) {
      console.log(`   성공! ${successRate.toFixed(1)}%의 코인에 한국어 이름이 표시됩니다.`);
    } else if (successRate >= 50) {
      console.log(`   부분 성공. ${successRate.toFixed(1)}%의 코인에 한국어 이름이 표시됩니다.`);
      console.log(`   CoinGecko API 호출이 필요할 수 있습니다.`);
    } else {
      console.log(`   실패. ${successRate.toFixed(1)}%의 코인에만 한국어 이름이 표시됩니다.`);
      console.log(`   API 호출 또는 JSON 파일 업데이트가 필요합니다.`);
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// 실행
testKoreanNames()
  .then(() => {
    console.log('\n✅ 테스트 완료!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  });

