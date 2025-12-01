/**
 * Binance WebSocket 클라이언트
 * 단일 연결에 다중 스트림 구독 방식 구현
 */

import type { BinanceTickerStreamMessage, BinanceKlineStreamMessage } from '@/types/binance';
import type { WebSocketStatus } from '@/types';

export type StreamType = 'ticker' | 'kline';

export interface BinanceWebSocketConfig {
  onTickerMessage?: (message: BinanceTickerStreamMessage) => void;
  onKlineMessage?: (message: BinanceKlineStreamMessage) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
  onError?: (error: Error) => void;
}

const BINANCE_WS_BASE_URL = 'wss://stream.binance.com:9443/stream';

/**
 * 지수 백오프 재연결 전략
 */
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 30000; // 30초
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // 지터 추가 (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return delay + jitter;
}

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // 최대 재연결 시도 횟수
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscribedStreams: Set<string> = new Set();
  private config: BinanceWebSocketConfig;

  constructor(config: BinanceWebSocketConfig) {
    this.config = config;
  }

  /**
   * WebSocket 연결
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setStatus('connecting');

    try {
      // 다중 스트림 구독을 위한 URL 생성
      const streams = Array.from(this.subscribedStreams);
      const streamParams = streams.length > 0 
        ? `?streams=${streams.join('/')}`
        : '';
      
      const url = `${BINANCE_WS_BASE_URL}${streamParams}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // WebSocket이 아직 유효한 경우에만 상태 변경
        if (this.ws && this.config) {
          this.setStatus('connected');
          this.reconnectAttempts = 0; // 연결 성공 시 재연결 시도 횟수 리셋
        }
      };

      this.ws.onmessage = (event) => {
        // WebSocket이 아직 유효한 경우에만 메시지 처리
        if (!this.ws || !this.config) {
          return;
        }
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          if (this.config) {
            this.config.onError?.(new Error('Failed to parse WebSocket message'));
          }
        }
      };

      this.ws.onerror = () => {
        // WebSocket이 아직 유효한 경우에만 상태 변경
        if (this.ws && this.config) {
          this.setStatus('error');
          this.config.onError?.(new Error('WebSocket error occurred'));
        }
      };

      this.ws.onclose = () => {
        // WebSocket이 아직 유효한 경우에만 상태 변경 및 재연결
        if (this.ws && this.config) {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      // config가 유효한 경우에만 에러 처리
      if (this.config) {
        this.setStatus('error');
        this.config.onError?.(error as Error);
      }
    }
  }

  /**
   * 스트림 구독
   * @param symbols 심볼 목록
   * @param type 스트림 타입
   */
  subscribe(symbols: string[], type: StreamType): void {
    const streams = symbols.map((symbol) => {
      const symbolLower = symbol.toLowerCase();
      if (type === 'ticker') {
        return `${symbolLower}@ticker`;
      } else {
        return `${symbolLower}@kline_1m`; // 1분봉
      }
    });

    const hasNewStreams = streams.some((stream) => !this.subscribedStreams.has(stream));
    
    if (!hasNewStreams) {
      // 이미 구독된 스트림이면 스킵
      return;
    }

    streams.forEach((stream) => this.subscribedStreams.add(stream));

    // 재연결이 필요한 경우 디바운스된 재연결
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.reconnect();
    } else {
      this.connect();
    }
  }

  /**
   * 스트림 구독 해제
   */
  unsubscribe(symbols: string[], type: StreamType): void {
    const streams = symbols.map((symbol) => {
      const symbolLower = symbol.toLowerCase();
      if (type === 'ticker') {
        return `${symbolLower}@ticker`;
      } else {
        return `${symbolLower}@kline_1m`;
      }
    });

    streams.forEach((stream) => this.subscribedStreams.delete(stream));

    if (this.subscribedStreams.size === 0) {
      this.disconnect();
    } else {
      this.reconnect();
    }
  }

  /**
   * 구독 전체 업데이트 (대규모 변경 시 사용)
   * 기존 구독을 모두 해제하고 새 구독으로 한 번에 재연결
   * @param symbols 새로 구독할 심볼 목록
   * @param type 스트림 타입
   */
  updateSubscription(symbols: string[], type: StreamType): void {
    const streams = symbols.map((symbol) => {
      const symbolLower = symbol.toLowerCase();
      if (type === 'ticker') {
        return `${symbolLower}@ticker`;
      } else {
        return `${symbolLower}@kline_1m`;
      }
    });

    // 기존 구독 모두 해제 (내부 상태만 정리)
    this.subscribedStreams.clear();
    
    // 새 구독으로 설정
    streams.forEach((stream) => this.subscribedStreams.add(stream));

    // 심볼이 없으면 연결 해제
    if (this.subscribedStreams.size === 0) {
      this.disconnect();
      return;
    }

    // 한 번만 재연결 (연결 끊김 최소화)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.reconnect();
    } else {
      this.connect();
    }
  }

  /**
   * 재연결 (디바운스)
   */
  private reconnect(): void {
    this.disconnect();
    // 디바운스: 300ms 후 재연결
    setTimeout(() => {
      this.connect();
    }, 300);
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // 이벤트 리스너를 먼저 제거하여 페이지 이동 시 오류 방지
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      // WebSocket 닫기
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      
      this.ws = null;
    }

    // 상태 변경 (config가 유효한 경우에만)
    if (this.config) {
      this.setStatus('disconnected');
    }
  }

  /**
   * 메시지 처리
   */
  private handleMessage(message: {
    stream?: string;
    data?: {
      stream?: string;
      k?: { t?: number; T?: number };
    };
  }): void {
    // config가 유효한 경우에만 메시지 처리
    if (!this.config) {
      return;
    }
    
    if (message.stream?.endsWith('@ticker')) {
      this.config.onTickerMessage?.(message as BinanceTickerStreamMessage);
    } else if (message.stream?.endsWith('@kline_1m')) {
      this.config.onKlineMessage?.(message as BinanceKlineStreamMessage);
    }
  }

  /**
   * 상태 변경
   */
  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      // config가 유효한 경우에만 콜백 호출 (페이지 이동 시 오류 방지)
      if (this.config) {
        this.config.onStatusChange?.(status);
      }
    }
  }

  /**
   * 지수 백오프 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.config) {
      return;
    }

    // 최대 재연결 시도 횟수 확인
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error');
      this.config.onError?.(new Error(`최대 재연결 시도 횟수(${this.maxReconnectAttempts}회)에 도달했습니다. 수동으로 재연결해주세요.`));
      return;
    }

    const delay = getReconnectDelay(this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      // 타이머 실행 시점에 config가 유효한지 확인
      if (this.config) {
        this.reconnectTimer = null;
        this.connect();
      }
    }, delay);
  }

  /**
   * 재연결 시도 횟수 리셋 (수동 재연결 시 사용)
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  /**
   * 재연결 시도 횟수 조회
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * 최대 재연결 시도 횟수 도달 여부
   */
  hasReachedMaxAttempts(): boolean {
    return this.reconnectAttempts >= this.maxReconnectAttempts;
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }
}

