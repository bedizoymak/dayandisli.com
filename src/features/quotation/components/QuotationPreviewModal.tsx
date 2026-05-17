import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFViewer } from "./PDFViewer";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGestureControls } from "../hooks/useGestureControls";

interface QuotationPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlob: Blob | null;
  teklifNo: string;
  onDownload?: () => void;
  onNavigateLeft?: () => void | Promise<void>;
  onNavigateRight?: () => void | Promise<void>;
  onPreviewLeft?: () => Promise<Blob | null>;
  onPreviewRight?: () => Promise<Blob | null>;
  canNavigateLeft?: boolean;
  canNavigateRight?: boolean;
  isNavigating?: boolean;
}

type TransitionPhase = "idle" | "drag" | "anim-out" | "anim-in";

// iOS timing constants
const ANIMATION_DURATION = 220; // ms
const IOS_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const SPRING_TRANSITION = `transform ${ANIMATION_DURATION}ms ${IOS_EASING}`;

export function QuotationPreviewModal({
  open,
  onOpenChange,
  pdfBlob,
  teklifNo,
  onDownload,
  onNavigateLeft,
  onNavigateRight,
  onPreviewLeft,
  onPreviewRight,
  canNavigateLeft = false,
  canNavigateRight = false,
  isNavigating = false,
}: QuotationPreviewModalProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State machine
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const [pendingDirection, setPendingDirection] = useState<"next" | "prev" | null>(null);
  
  // Stable blob ref - the PDF shown on screen (MUST NOT change during drag/anim-out)
  const stableBlobRef = useRef<Blob | null>(null);
  
  // Drag state from gesture controls
  const [dragX, setDragX] = useState(0);
  
  // Animation positions
  const [currentPageX, setCurrentPageX] = useState(0);
  const [nextPageX, setNextPageX] = useState(0);
  const [prevPageX, setPrevPageX] = useState(0);
  
  // Preview blobs for next/prev pages
  const [nextPageBlob, setNextPageBlob] = useState<Blob | null>(null);
  const [prevPageBlob, setPrevPageBlob] = useState<Blob | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  
  // Animation refs
  const animationRef = useRef<number | null>(null);
  const containerWidthRef = useRef(0);

  const handleClose = () => {
    onOpenChange(false);
  };

  // Update container width
  useEffect(() => {
    if (containerRef.current) {
      containerWidthRef.current = containerRef.current.clientWidth;
    }
    
    const updateWidth = () => {
      if (containerRef.current) {
        containerWidthRef.current = containerRef.current.clientWidth;
      }
    };
    
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [open]);

  // Initialize stable blob when modal opens or pdfBlob changes (only in idle state)
  useEffect(() => {
    if (open && pdfBlob && transitionPhase === "idle") {
      stableBlobRef.current = pdfBlob;
    }
  }, [open, pdfBlob, transitionPhase]);

  // Handle dragX changes from gesture controls
  const handleDragXChange = useCallback((x: number) => {
    if (transitionPhase !== "idle" && transitionPhase !== "drag") return;
    
    setDragX(x);
    
    if (transitionPhase === "idle" && Math.abs(x) > 10) {
      setTransitionPhase("drag");
    }
    
    // Update positions with iOS-like parallax
    const width = containerWidthRef.current || window.innerWidth;
    
    // Current page follows finger exactly
    setCurrentPageX(x);
    
    // Next page with parallax: width * 0.25 + dragX * 0.2
    if (x < 0) {
      setNextPageX(width * 0.25 + x * 0.2);
    } else {
      setNextPageX(width);
    }
    
    // Previous page with parallax: -width * 0.25 + dragX * 0.2
    if (x > 0) {
      setPrevPageX(-width * 0.25 + x * 0.2);
    } else {
      setPrevPageX(-width);
    }
    
    // Preload next/prev pages when dragging
    const threshold = width * 0.1; // Start loading at 10% drag
    
    if (x < -threshold && canNavigateRight && !nextPageBlob && !isLoadingNext && onPreviewRight) {
      setIsLoadingNext(true);
      onPreviewRight()
        .then((blob) => {
          if (blob instanceof Blob) {
            setNextPageBlob(blob);
          }
        })
        .catch((err) => {
          console.error("Failed to load next page preview:", err);
        })
        .finally(() => {
          setIsLoadingNext(false);
        });
    }
    
    if (x > threshold && canNavigateLeft && !prevPageBlob && !isLoadingPrev && onPreviewLeft) {
      setIsLoadingPrev(true);
      onPreviewLeft()
        .then((blob) => {
          if (blob instanceof Blob) {
            setPrevPageBlob(blob);
          }
        })
        .catch((err) => {
          console.error("Failed to load prev page preview:", err);
        })
        .finally(() => {
          setIsLoadingPrev(false);
        });
    }
  }, [transitionPhase, canNavigateRight, canNavigateLeft, nextPageBlob, prevPageBlob, isLoadingNext, isLoadingPrev, onPreviewRight, onPreviewLeft]);

  // Unified navigation function for both buttons and gestures
  const startAnimatedNavigation = useCallback((direction: "next" | "prev") => {
    if (transitionPhase !== "idle" && transitionPhase !== "drag") return;
    
    const width = containerWidthRef.current || window.innerWidth;
    
    // Validate navigation
    if (direction === "next" && (!onNavigateRight || !canNavigateRight)) return;
    if (direction === "prev" && (!onNavigateLeft || !canNavigateLeft)) return;
    
    // Set pending direction and start anim-out phase
    setPendingDirection(direction);
    
    // Capture current positions if dragging
    const currentDragX = transitionPhase === "drag" ? dragX : 0;
    const currentNextX = transitionPhase === "drag" ? nextPageX : width;
    const currentPrevX = transitionPhase === "drag" ? prevPageX : -width;
    
    // Set starting positions (to avoid jump)
    setCurrentPageX(currentDragX);
    if (direction === "next") {
      setNextPageX(currentNextX);
    } else {
      setPrevPageX(currentPrevX);
    }
    
    // Transition to anim-out phase
    setTransitionPhase("anim-out");
    
    // Use requestAnimationFrame to ensure starting positions are applied before animating
    requestAnimationFrame(() => {
      // Animate current page off-screen
      const targetX = direction === "next" ? -width : width;
      setCurrentPageX(targetX);
      
      // Animate next/prev page to center
      if (direction === "next") {
        setNextPageX(0);
      } else {
        setPrevPageX(0);
      }
    });
    
    // After anim-out completes, update blob and start anim-in
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    
    animationRef.current = window.setTimeout(() => {
      // Phase 2: Update stable blob (THIS IS WHEN PDF CHANGES)
      if (direction === "next" && nextPageBlob) {
        stableBlobRef.current = nextPageBlob;
      } else if (direction === "prev" && prevPageBlob) {
        stableBlobRef.current = prevPageBlob;
      } else if (pdfBlob) {
        // Fallback: use current pdfBlob prop (will be updated by parent)
        stableBlobRef.current = pdfBlob;
      }
      
      // Call navigation callback
      if (direction === "next" && onNavigateRight) {
        onNavigateRight();
      } else if (direction === "prev" && onNavigateLeft) {
        onNavigateLeft();
      }
      
      // Start anim-in phase
      setTransitionPhase("anim-in");
      
      // Reset positions for anim-in
      setCurrentPageX(0);
      setNextPageX(width);
      setPrevPageX(-width);
      
      // After anim-in completes, return to idle
      animationRef.current = window.setTimeout(() => {
        setTransitionPhase("idle");
        setPendingDirection(null);
        setDragX(0);
        setNextPageBlob(null);
        setPrevPageBlob(null);
        animationRef.current = null;
      }, ANIMATION_DURATION);
    }, ANIMATION_DURATION);
  }, [transitionPhase, onNavigateRight, onNavigateLeft, canNavigateRight, canNavigateLeft, nextPageBlob, prevPageBlob, pdfBlob]);

  // Handle swipe end with velocity and distance
  const handleSwipeEnd = useCallback(
    (velocity: number, distance: number, direction: "left" | "right" | null) => {
      if (transitionPhase !== "drag") return;
      
      const width = containerWidthRef.current || window.innerWidth;
      const distanceThreshold = width * 0.3; // 30% of width
      const velocityThreshold = 0.35; // px/ms
      
      const shouldCommit =
        (velocity > velocityThreshold || Math.abs(distance) > distanceThreshold) &&
        direction !== null;
      
      if (shouldCommit) {
        // Commit: start animated navigation
        if (direction === "left" && canNavigateRight) {
          startAnimatedNavigation("next");
        } else if (direction === "right" && canNavigateLeft) {
          startAnimatedNavigation("prev");
        } else {
          // Cancel: snap back
          setTransitionPhase("anim-out");
          setCurrentPageX(0);
          setNextPageX(width);
          setPrevPageX(-width);
          
          if (animationRef.current) {
            clearTimeout(animationRef.current);
          }
          animationRef.current = window.setTimeout(() => {
            setTransitionPhase("idle");
            setDragX(0);
            setNextPageBlob(null);
            setPrevPageBlob(null);
            animationRef.current = null;
          }, ANIMATION_DURATION);
        }
      } else {
        // Cancel: snap back
        setTransitionPhase("anim-out");
        setCurrentPageX(0);
        setNextPageX(width);
        setPrevPageX(-width);
        
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
        animationRef.current = window.setTimeout(() => {
          setTransitionPhase("idle");
          setDragX(0);
          setNextPageBlob(null);
          setPrevPageBlob(null);
          animationRef.current = null;
        }, ANIMATION_DURATION);
      }
    },
    [transitionPhase, canNavigateLeft, canNavigateRight, startAnimatedNavigation]
  );

  // Gesture controls
  const { scale, offset, isPinching, isDragging, resetScale } = useGestureControls({
    containerRef: viewerRef,
    onClose: handleClose,
    onNext: () => {}, // Handled by swipe end
    onPrev: () => {}, // Handled by swipe end
    onDragXChange: handleDragXChange,
    onSwipeEnd: handleSwipeEnd,
  });

  // Button navigation handlers
  const handleNextWithAnimation = useCallback(() => {
    startAnimatedNavigation("next");
  }, [startAnimatedNavigation]);

  const handlePrevWithAnimation = useCallback(() => {
    startAnimatedNavigation("prev");
  }, [startAnimatedNavigation]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (stableBlobRef.current) {
      const link = document.createElement("a");
      const url = URL.createObjectURL(stableBlobRef.current);
      link.href = url;
      link.download = `${teklifNo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      resetScale();
      setDragX(0);
      setCurrentPageX(0);
      setNextPageX(containerWidthRef.current || window.innerWidth);
      setPrevPageX(-(containerWidthRef.current || window.innerWidth));
      setTransitionPhase("idle");
      setPendingDirection(null);
      setNextPageBlob(null);
      setPrevPageBlob(null);
      if (pdfBlob) {
        stableBlobRef.current = pdfBlob;
      }
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [open, resetScale, pdfBlob]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  // Calculate positions for rendering
  const width = containerWidthRef.current || window.innerWidth;
  
  // During drag: use live dragX
  // During anim-out/anim-in: use animated positions
  const displayCurrentX = transitionPhase === "drag" ? dragX : currentPageX;
  
  // Next page position
  let displayNextX = width;
  if (transitionPhase === "drag" && dragX < 0) {
    displayNextX = nextPageX;
  } else if (transitionPhase === "anim-out" && pendingDirection === "next") {
    displayNextX = 0;
  } else if (transitionPhase === "anim-in" && pendingDirection === "next") {
    displayNextX = 0; // Already at center
  }
  
  // Previous page position
  let displayPrevX = -width;
  if (transitionPhase === "drag" && dragX > 0) {
    displayPrevX = prevPageX;
  } else if (transitionPhase === "anim-out" && pendingDirection === "prev") {
    displayPrevX = 0;
  } else if (transitionPhase === "anim-in" && pendingDirection === "prev") {
    displayPrevX = 0; // Already at center
  }

  const isAnimating = transitionPhase === "anim-out" || transitionPhase === "anim-in";
  const isTransitioning = transitionPhase !== "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col bg-slate-800 border-slate-700 p-0 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">
              Teklif Önizleme - {teklifNo}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {(canNavigateLeft || canNavigateRight) && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePrevWithAnimation}
                    disabled={!canNavigateLeft || transitionPhase !== "idle"}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 w-8 p-0"
                    title="Önceki teklif"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNextWithAnimation}
                    disabled={!canNavigateRight || transitionPhase !== "idle"}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 w-8 p-0"
                    title="Sonraki teklif"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!stableBlobRef.current}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 px-3"
              >
                <Download className="w-4 h-4 mr-2" />
                İndir
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden relative bg-slate-900"
          style={{
            isolation: "isolate",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
          }}
        >
          {/* Previous page preview (left side) */}
          {canNavigateLeft && onPreviewLeft && (
  <div
    className="absolute inset-0 w-full h-full"
    style={{
      transform: `translate3d(${displayPrevX}px, 0, 0)`,
      transition: isAnimating ? SPRING_TRANSITION : "none",
      zIndex:
        (transitionPhase === "drag" && dragX > 0) ||
        (transitionPhase === "anim-out" && pendingDirection === "prev") ||
        (transitionPhase === "anim-in" && pendingDirection === "prev")
          ? 2
          : 1,
      willChange: "transform",
      backfaceVisibility: "hidden",
      contain: "layout style paint",
      isolation: "isolate",
      pointerEvents: displayPrevX < -width * 0.8 ? "none" : "auto",
    }}
  >
    {prevPageBlob ? (
      <PDFViewer
        blob={prevPageBlob}
        onClose={handleClose}
        suppressLoading={true}
        disableScrollReset={true}
      />
    ) : null}
  </div>
)}


          {/* Current page - uses stableBlobRef */}
          <div
            ref={viewerRef}
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translate3d(${displayCurrentX + offset.x}px, ${offset.y}px, 0) scale(${scale})`,
              transformOrigin: "center center",
              transition: isAnimating
                ? SPRING_TRANSITION
                : isPinching
                ? "none"
                : "transform 0.12s ease-out",
              willChange: "transform",
              backfaceVisibility: "hidden",
              zIndex: 3,
              contain: "layout style paint",
              isolation: "isolate",
            }}
          >
            <PDFViewer
              blob={stableBlobRef.current}
              onClose={handleClose}
              onNavigateLeft={handlePrevWithAnimation}
              onNavigateRight={handleNextWithAnimation}
              canNavigateLeft={canNavigateLeft}
              canNavigateRight={canNavigateRight}
              suppressLoading={isTransitioning}
              disableScrollReset={isTransitioning}
            />
          </div>

          {/* Next page preview (right side) */}
          {canNavigateRight && onPreviewRight && (
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translate3d(${displayNextX}px, 0, 0)`,
                transition: isAnimating ? SPRING_TRANSITION : "none",
                zIndex: (transitionPhase === "drag" && dragX < 0) || (transitionPhase === "anim-out" && pendingDirection === "next") || (transitionPhase === "anim-in" && pendingDirection === "next") ? 2 : 1,
                willChange: "transform",
                backfaceVisibility: "hidden",
                contain: "layout style paint",
                isolation: "isolate",
                pointerEvents: displayNextX > width * 0.8 ? "none" : "auto",
              }}
            >
              {nextPageBlob ? (
                <PDFViewer
                  blob={nextPageBlob}
                  onClose={handleClose}
                  canNavigateLeft={false}
                  canNavigateRight={false}
                  suppressLoading={true}
                  disableScrollReset={true}
                />
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
