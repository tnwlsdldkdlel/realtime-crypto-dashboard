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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

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
        // 재연결 시도 횟수 업데이트
        if (clientRef.current) {
          setReconnectAttempts(clientRef.current.getReconnectAttempts());
        }
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
      // previousSymbols 초기화 (컴포넌트 언마운트 시)
      previousSymbolsRef.current = [];
    };
  }, [autoConnect]);

  /**
   * 심볼 구독 관리
   * 심볼이 있을 때만 구독하고 연결
   */
  const previousSymbolsRef = useRef<string[]>([]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !autoConnect) {
      return;
    }

    const previousSymbols = previousSymbolsRef.current;
    const currentSymbols = symbols;

    // 심볼 목록이 변경되지 않았으면 스킵
    // 단, 클라이언트가 연결되지 않은 상태이고 심볼이 있으면 연결 시도
    const isClientDisconnected = client.getStatus() === 'disconnected';
    const shouldConnect = isClientDisconnected && currentSymbols.length > 0;

    if (
      !shouldConnect &&
      previousSymbols.length === currentSymbols.length &&
      previousSymbols.every((sym, idx) => sym === currentSymbols[idx])
    ) {
      return;
    }

    // 대규모 변경 감지 (즐겨찾기 변경처럼 심볼 목록이 크게 바뀌는 경우)
    const isMajorChange =
      previousSymbols.length === 0 || // 첫 구독
      currentSymbols.length === 0 || // 모두 해제
      // 변경 비율이 50% 이상이면 대규모 변경으로 간주
      (previousSymbols.length > 0 &&
        Math.abs(previousSymbols.length - currentSymbols.length) /
          Math.max(previousSymbols.length, 1) >
          0.5) ||
      // 공통 심볼이 50% 미만이면 대규모 변경
      (previousSymbols.length > 0 &&
        currentSymbols.length > 0 &&
        previousSymbols.filter((sym) => currentSymbols.includes(sym)).length /
          Math.max(previousSymbols.length, currentSymbols.length) <
          0.5);

    if (isMajorChange || shouldConnect) {
      // 대규모 변경 또는 재연결 필요: 전체 재구독 (한 번만 재연결)
      if (currentSymbols.length > 0) {
        client.updateSubscription(currentSymbols, 'ticker');
      } else {
        // 심볼이 없으면 연결 해제
        if (previousSymbols.length > 0) {
          client.disconnect();
        }
      }
    } else {
      // 소규모 변경: 차등 구독 (기존 로직)
      // 이전 구독 해제
      if (previousSymbols.length > 0) {
        const symbolsToUnsubscribe = previousSymbols.filter(
          (sym) => !currentSymbols.includes(sym)
        );
        if (symbolsToUnsubscribe.length > 0) {
          client.unsubscribe(symbolsToUnsubscribe, 'ticker');
        }
      }

      // 새 구독 추가
      if (currentSymbols.length > 0) {
        const symbolsToSubscribe = currentSymbols.filter(
          (sym) => !previousSymbols.includes(sym)
        );
        if (symbolsToSubscribe.length > 0) {
          client.subscribe(symbolsToSubscribe, 'ticker');
        }
      } else {
        // 심볼이 없으면 연결 해제
        if (previousSymbols.length > 0) {
          client.disconnect();
        }
      }
    }

    // 현재 심볼을 이전 심볼로 저장
    previousSymbolsRef.current = currentSymbols;

    return () => {
      // 클린업: 컴포넌트 언마운트 시에만 구독 해제
      // 일반적인 심볼 변경 시에는 위에서 처리
    };
  }, [symbols, autoConnect]);

  /**
   * 연결 함수
   */
  const connect = useCallback(() => {
    if (clientRef.current) {
      // 수동 재연결 시 재연결 시도 횟수 리셋
      if (clientRef.current.hasReachedMaxAttempts()) {
        clientRef.current.resetReconnectAttempts();
        setReconnectAttempts(0);
      }
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
    reconnectAttempts,
    hasReachedMaxAttempts: clientRef.current?.hasReachedMaxAttempts() ?? false,
  };
}

