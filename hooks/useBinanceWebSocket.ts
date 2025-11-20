/**
 * Binance WebSocket 훅
 * WebSocket 연결 관리 및 실시간 데이터를 스토어에 업데이트
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { BinanceWebSocketClient } from '@/lib/websocket/binanceWebSocket';
import { useTickerStore } from '@/stores/tickerStore';
import { adaptBinanceTickerStream } from '@/adapters/binance';
import type { WebSocketStatus } from '@/types';

interface UseBinanceWebSocketOptions {
  /**
   * 구독할 심볼 목록
   */
  symbols?: string[];
  /**
   * 연결 상태 변경 콜백
   */
  onStatusChange?: (status: WebSocketStatus) => void;
  /**
   * 에러 발생 콜백
   */
  onError?: (error: Error) => void;
  /**
   * 자동 연결 여부 (기본값: true)
   */
  autoConnect?: boolean;
}

/**
 * Binance WebSocket 훅
 */
export function useBinanceWebSocket(options: UseBinanceWebSocketOptions = {}) {
  const {
    symbols = [],
    onStatusChange,
    onError,
    autoConnect = true,
  } = options;

  const { updateTicker } = useTickerStore();
  const clientRef = useRef<BinanceWebSocketClient | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // 핸들러를 ref로 저장하여 의존성 문제 해결
  const handlersRef = useRef({
    updateTicker,
    onStatusChange,
    onError,
  });

  // ref 업데이트
  useEffect(() => {
    handlersRef.current = {
      updateTicker,
      onStatusChange,
      onError,
    };
  }, [updateTicker, onStatusChange, onError]);

  /**
   * WebSocket 클라이언트 초기화
   */
  useEffect(() => {
    if (!autoConnect) {
      return;
    }

    // 클라이언트 생성
    clientRef.current = new BinanceWebSocketClient({
      onTickerMessage: (message) => {
        try {
          const ticker = adaptBinanceTickerStream(message);
          handlersRef.current.updateTicker(ticker);
        } catch (error) {
          console.error('Failed to process ticker message:', error);
          handlersRef.current.onError?.(error as Error);
        }
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        handlersRef.current.onStatusChange?.(newStatus);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        handlersRef.current.onError?.(error);
      },
    });

    return () => {
      // 클린업: 연결 해제
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [autoConnect]);

  /**
   * 심볼 구독 관리
   * 심볼이 있을 때만 구독하고 연결
   */
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !autoConnect) {
      return;
    }

    // 심볼이 있을 때만 구독 (subscribe 내부에서 자동으로 connect 호출)
    if (symbols.length > 0) {
      client.subscribe(symbols, 'ticker');
    } else {
      // 심볼이 없으면 연결 해제
      client.disconnect();
    }

    return () => {
      // 클린업: 구독 해제
      if (client && symbols.length > 0) {
        client.unsubscribe(symbols, 'ticker');
      }
    };
  }, [symbols, autoConnect]);

  /**
   * 연결 함수
   */
  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.connect();
    }
  }, []);

  /**
   * 연결 해제 함수
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  /**
   * 현재 상태 조회
   */
  const getStatus = useCallback((): WebSocketStatus => {
    return clientRef.current?.getStatus() ?? 'disconnected';
  }, []);

  return {
    connect,
    disconnect,
    getStatus,
    status,
  };
}

