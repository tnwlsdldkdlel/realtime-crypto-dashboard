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
        this.setStatus('connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          this.config.onError?.(new Error('Failed to parse WebSocket message'));
        }
      };

      this.ws.onerror = () => {
        this.setStatus('error');
        this.config.onError?.(new Error('WebSocket error occurred'));
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      this.setStatus('error');
      this.config.onError?.(error as Error);
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
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
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
      this.config.onStatusChange?.(status);
    }
  }

  /**
   * 지수 백오프 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = getReconnectDelay(this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }
}

