import { useEffect, useRef, useCallback } from 'react';

interface UseSmartPollingOptions {
  /**
   * Callback function to execute on each poll
   */
  onPoll: () => void | Promise<void>;
  
  /**
   * Polling interval when tab is active (milliseconds)
   * @default 10000 (10 seconds)
   */
  activeInterval?: number;
  
  /**
   * Polling interval when tab is hidden/inactive (milliseconds)
   * @default 60000 (60 seconds)
   */
  inactiveInterval?: number;
  
  /**
   * Whether to poll immediately on mount
   * @default true
   */
  pollOnMount?: boolean;
}

/**
 * Smart polling hook that adjusts interval based on tab visibility
 * 
 * - Polls frequently (10s default) when user is actively viewing the page
 * - Slows down (60s default) when tab is hidden/backgrounded
 * - Uses recursive setTimeout to prevent interval stacking on slow connections
 */
export function useSmartPolling({
  onPoll,
  activeInterval = 10000,
  inactiveInterval = 60000,
  pollOnMount = true,
}: UseSmartPollingOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const isVisibleRef = useRef(!document.hidden);
  const onPollRef = useRef(onPoll);

  // Keep onPoll fresh
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  const poll = useCallback(async () => {
    if (isPollingRef.current) return;
    
    try {
      isPollingRef.current = true;
      await onPollRef.current();
    } catch (error) {
      console.error('Polling error:', error);
    } finally {
      isPollingRef.current = false;
      
      // Schedule next poll
      const interval = document.hidden ? inactiveInterval : activeInterval;
      timeoutRef.current = setTimeout(poll, interval);
    }
  }, [activeInterval, inactiveInterval]);

  useEffect(() => {
    if (pollOnMount) {
      poll();
    } else {
      // Just start the timer
      const interval = document.hidden ? inactiveInterval : activeInterval;
      timeoutRef.current = setTimeout(poll, interval);
    }

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      
      if (isVisible !== isVisibleRef.current) {
        isVisibleRef.current = isVisible;
        
        // Reset timeout to switch interval immediately
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // If becoming visible, poll immediately
        if (isVisible) {
          poll();
        } else {
          // Just schedule with longer interval
          timeoutRef.current = setTimeout(poll, inactiveInterval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [poll, pollOnMount, inactiveInterval, activeInterval]);
}
