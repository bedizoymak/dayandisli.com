import { useEffect, useRef, useState, useCallback } from "react";

interface GestureOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onDragXChange?: (dragX: number) => void;
  onSwipeEnd?: (velocity: number, distance: number, direction: "left" | "right" | null) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_DISTANCE = 50;
const SWIPE_TIME = 400;
const SWIPE_VELOCITY_THRESHOLD = 0.35; // px/ms

export function useGestureControls({
  containerRef,
  onClose,
  onNext,
  onPrev,
  onDragXChange,
  onSwipeEnd,
}: GestureOptions) {
  // Visible state
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Internal refs (never read React state directly in handlers)
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragXRef = useRef(0);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const isZoomingRef = useRef(false);
  const isDraggingRef = useRef(false);

  const updateScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    scaleRef.current = clamped;
    setScale(clamped);
  }, []);

  const updateOffset = useCallback((dx: number, dy: number) => {
    const current = offsetRef.current;
    const next = { x: current.x + dx, y: current.y + dy };
    offsetRef.current = next;
    setOffset(next);
  }, []);

  const updateDragX = useCallback((x: number) => {
    dragXRef.current = x;
    setDragX(x);
    onDragXChange?.(x);
  }, [onDragXChange]);

  const resetScaleAndOffset = useCallback(() => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    dragXRef.current = 0;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragX(0);
    setIsPinching(false);
    setIsDragging(false);
    isDraggingRef.current = false;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();

      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      touchMoveRef.current = null;
      
      // Reset drag state
      if (scaleRef.current === 1) {
        isDraggingRef.current = false;
        updateDragX(0);
        setIsDragging(false);
      }
    } else if (e.touches.length === 2) {
      // Start pinch zoom
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      pinchStartRef.current = { distance, scale: scaleRef.current };
      isZoomingRef.current = true;
      setIsPinching(true);
      
      // Cancel drag if zooming
      isDraggingRef.current = false;
      updateDragX(0);
      setIsDragging(false);
    }
  }, [updateDragX]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      // Pinch zoom
      if (isZoomingRef.current && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (pinchStartRef.current) {
          const scaleFactor = distance / pinchStartRef.current.distance;
          const newScale = pinchStartRef.current.scale * scaleFactor;
          updateScale(newScale);
        }
        return;
      }

      // Single finger
      if (e.touches.length === 1 && touchStartRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;

        touchMoveRef.current = { x: touch.clientX, y: touch.clientY };

        // When NOT zoomed: track horizontal drag for iOS-style navigation
        if (scaleRef.current === 1) {
          // If clearly horizontal, prevent native scroll and track drag
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            e.preventDefault();
            e.stopPropagation();
            
            // Start dragging if not already
            if (!isDraggingRef.current) {
              isDraggingRef.current = true;
              setIsDragging(true);
            }
            
            // Update dragX to follow finger exactly
            updateDragX(dx);
          } else if (isDraggingRef.current) {
            // Continue tracking if already dragging
            updateDragX(dx);
          }
          return;
        }

        // When zoomed: pan
        if (scaleRef.current > 1 && lastTouchRef.current) {
          e.preventDefault();
          const moveDx = touch.clientX - lastTouchRef.current.x;
          const moveDy = touch.clientY - lastTouchRef.current.y;
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
          updateOffset(moveDx, moveDy);
        }
      }
    },
    [updateScale, updateOffset, updateDragX]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (isZoomingRef.current) {
        isZoomingRef.current = false;
        pinchStartRef.current = null;
        setIsPinching(false);
      }

      // Handle drag end for iOS-style transitions
      if (isDraggingRef.current && scaleRef.current === 1 && touchStartRef.current && touchMoveRef.current) {
        const dx = touchMoveRef.current.x - touchStartRef.current.x;
        const dy = touchMoveRef.current.y - touchStartRef.current.y;
        const dt = Date.now() - touchStartRef.current.time;
        const velocity = dt > 0 ? Math.abs(dx) / dt : 0;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Determine direction
        let direction: "left" | "right" | null = null;
        if (absDx > absDy) {
          direction = dx > 0 ? "right" : "left";
        }

        // Call onSwipeEnd with velocity and distance for iOS-style decision
        if (onSwipeEnd) {
          onSwipeEnd(velocity, dx, direction);
        } else {
          // Fallback to old behavior if onSwipeEnd not provided
          if (dt < SWIPE_TIME && (absDx > SWIPE_DISTANCE || absDy > SWIPE_DISTANCE)) {
            if (absDx > absDy) {
              if (dx > SWIPE_DISTANCE) {
                onPrev();
              } else if (dx < -SWIPE_DISTANCE) {
                onNext();
              }
            } else {
              if (dy < -SWIPE_DISTANCE) {
                onClose();
              }
            }
          }
        }

        // Reset drag state (will be handled by parent if commit/cancel)
        isDraggingRef.current = false;
        setIsDragging(false);
      } else if (!touchStartRef.current || !touchMoveRef.current) {
        // No drag, check for vertical swipe to close
        if (touchStartRef.current && touchMoveRef.current) {
          const dx = touchMoveRef.current.x - touchStartRef.current.x;
          const dy = touchMoveRef.current.y - touchStartRef.current.y;
          const dt = Date.now() - (touchStartRef.current?.time || Date.now());
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (
            scaleRef.current === 1 &&
            dt < SWIPE_TIME &&
            absDy > absDx &&
            absDy > SWIPE_DISTANCE &&
            dy < -SWIPE_DISTANCE
          ) {
            onClose();
          }
        }
      }

      touchStartRef.current = null;
      touchMoveRef.current = null;
      lastTouchRef.current = null;
    },
    [onClose, onNext, onPrev, onSwipeEnd]
  );

  const handleTouchCancel = useCallback(() => {
    isZoomingRef.current = false;
    pinchStartRef.current = null;
    touchStartRef.current = null;
    touchMoveRef.current = null;
    lastTouchRef.current = null;
    setIsPinching(false);
    
    // Cancel drag
    isDraggingRef.current = false;
    updateDragX(0);
    setIsDragging(false);
  }, [updateDragX]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchCancel);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, containerRef]);

  return {
    scale,
    offset,
    isPinching,
    dragX,
    isDragging,
    resetScale: resetScaleAndOffset,
  };
}
