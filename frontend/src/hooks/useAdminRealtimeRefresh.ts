import { useCallback, useEffect, useRef } from "react";
import { type DashboardActivityEvent, subscribeAdminDashboardEvents } from "../api/adminDashboardEventsApi";

type UseAdminRealtimeRefreshOptions = {
  token: string;
  enabled?: boolean;
  shouldRefresh?: (event: DashboardActivityEvent) => boolean;
  onRefresh: () => Promise<void> | void;
};

export function useAdminRealtimeRefresh({
  token,
  enabled = true,
  shouldRefresh,
  onRefresh
}: UseAdminRealtimeRefreshOptions): { refreshNow: () => void } {
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const pendingUntilVisibleRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const shouldRefreshRef = useRef(shouldRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    shouldRefreshRef.current = shouldRefresh;
  }, [shouldRefresh]);

  const runRefresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    try {
      await onRefreshRef.current();
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void runRefresh();
      }
    }
  }, []);

  useEffect(() => {
    if (!token || !enabled) return;

    let reconnectTimer: number | undefined;
    let stopped = false;
    const controller = new AbortController();

    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return;
      if (!pendingUntilVisibleRef.current) return;
      pendingUntilVisibleRef.current = false;
      void runRefresh();
    }

    function requestRefresh(event: DashboardActivityEvent) {
      if (shouldRefreshRef.current && !shouldRefreshRef.current(event)) return;
      if (document.visibilityState === "visible") {
        void runRefresh();
      } else {
        pendingUntilVisibleRef.current = true;
      }
    }

    function reconnect() {
      if (stopped || controller.signal.aborted) return;
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, 5000);
    }

    async function connect() {
      try {
        await subscribeAdminDashboardEvents(token, controller.signal, requestRefresh);
        reconnect();
      } catch {
        reconnect();
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);
    void connect();
    return () => {
      stopped = true;
      controller.abort();
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [enabled, runRefresh, token]);

  return { refreshNow: () => void runRefresh() };
}
