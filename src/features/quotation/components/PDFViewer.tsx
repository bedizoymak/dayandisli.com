import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

// Import pdfjs-dist
import * as pdfjsLib from "pdfjs-dist";
// Import worker using Vite's ?url suffix for proper bundling
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

// Configure PDF.js worker - must be set before any PDF operations
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * PDFViewer Component
 * 
 * Displays a PDF using pdf.js with support for:
 * - Mobile gestures (pinch-to-zoom, swipe navigation, swipe-to-close)
 * - Desktop zoom and navigation
 * - Scroll-snap for one-page-per-viewport on mobile
 * 
 * API:
 * - blob: Blob | null - The PDF blob to display. Must be a valid PDF Blob with type "application/pdf"
 *   The blob will be converted to ArrayBuffer internally for pdf.js
 * 
 * Note: This component expects a Blob, not a URL. If you have a URL, create a Blob first:
 *   const response = await fetch(url);
 *   const blob = await response.blob();
 */
interface PDFViewerProps {
  blob: Blob | null;
  onClose?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  canNavigateLeft?: boolean;
  canNavigateRight?: boolean;
  suppressLoading?: boolean; // Suppress loading screen during transitions
  disableScrollReset?: boolean; // Prevent scroll position resets during transitions
}

export function PDFViewer({
  blob,
  onClose,
  onNavigateLeft,
  onNavigateRight,
  canNavigateLeft = false,
  canNavigateRight = false,
  suppressLoading = false,
  disableScrollReset = false,
}: PDFViewerProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null); // PDFDocumentProxy from pdfjs-dist
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map()); // RenderTask from pdfjs-dist
  const pdfDocRef = useRef<any>(null); // PDFDocumentProxy from pdfjs-dist
  const lastBlobRef = useRef<Blob | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Calculate base scale to fit viewport
  const calculateBaseScale = useCallback(async (pdf: any) => {
    if (!pagesRef.current) return 1;

    const container = pagesRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      
      // Calculate scale to fit width and height
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      return Math.min(scaleX, scaleY);
    } catch (err) {
      console.error("Error calculating base scale:", err);
      return 1;
    }
  }, []);

  // Cleanup function - use ref to avoid dependency issues
  const cleanup = useCallback(() => {
    // Cancel all render tasks
    renderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
    });
    renderTasksRef.current.clear();

    // Clear canvas refs
    canvasRefs.current.clear();
    pageContainersRef.current.clear();

    // Close PDF document using ref
    if (pdfDocRef.current) {
      try {
        pdfDocRef.current.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
      pdfDocRef.current = null;
    }
    
    // Revoke blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Load PDF document
  useEffect(() => {
    if (!blob) {
      cleanup();
      pdfDocRef.current = null;
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);
      setBaseScale(1);
      lastBlobRef.current = null;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      // Reset scroll position only if not disabled
      if (!disableScrollReset && pagesRef.current) {
        pagesRef.current.scrollTop = 0;
      }
      return;
    }

    // Check if blob actually changed (avoid reload if same blob)
    const blobChanged = lastBlobRef.current !== blob;
    
    if (!blobChanged && pdfDoc) {
      // Same blob, don't reload
      return;
    }

    lastBlobRef.current = blob;

    setIsLoading(true);
    setError(null);

    const loadPDF = async () => {
      try {
        // Validate blob
        if (!blob || blob.size === 0) {
          throw new Error("Invalid or empty PDF blob");
        }

        if (blob.type && blob.type !== "application/pdf") {
          console.warn("Blob type is not application/pdf:", blob.type);
        }

        // Cleanup previous PDF
        cleanup();
        
        // Revoke previous blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const arrayBuffer = await blob.arrayBuffer();
        
        // Validate array buffer
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("Invalid PDF data");
        }

        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          verbosity: 0 // Reduce console noise
        });
        const pdf = await loadingTask.promise;
        
        // Validate PDF document
        if (!pdf || pdf.numPages === 0) {
          throw new Error("Invalid PDF document");
        }
        
        // Calculate base scale to fit viewport
        const fitScale = await calculateBaseScale(pdf);
        setBaseScale(fitScale);
        
        pdfDocRef.current = pdf;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        
        // Only reset scroll when blob actually changed and not disabled
        if (blobChanged && !disableScrollReset && pagesRef.current) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            if (pagesRef.current) {
              pagesRef.current.scrollTop = 0;
            }
          });
        }
      } catch (err) {
        console.error("Error loading PDF:", err);
        const errorMessage = err instanceof Error ? err.message : "PDF yüklenemedi";
        setError(errorMessage);
        pdfDocRef.current = null;
        setPdfDoc(null);
        setNumPages(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [blob, calculateBaseScale, cleanup, disableScrollReset, pdfDoc]);

  // Render a single page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;

      const canvas = canvasRefs.current.get(pageNum);
      const container = pageContainersRef.current.get(pageNum);
      if (!canvas || !container) return;

      try {
        // Cancel previous render task for this page
        const existingTask = renderTasksRef.current.get(pageNum);
        if (existingTask) {
          try {
            existingTask.cancel();
          } catch (e) {
            // Ignore cancellation errors
          }
        }

        const page = await pdfDoc.getPage(pageNum);
        
        // Calculate final scale: baseScale fits viewport (zoom is handled by parent transform)
        const finalScale = baseScale;
        const viewport = page.getViewport({ scale: finalScale * window.devicePixelRatio });

        // Set canvas size
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Set container size for proper display (fit to viewport when scale = 1)
        const displayWidth = viewport.width / window.devicePixelRatio;
        const displayHeight = viewport.height / window.devicePixelRatio;
        container.style.width = `${displayWidth}px`;
        container.style.height = `${displayHeight}px`;

        // Render page
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTasksRef.current.set(pageNum, renderTask);
        await renderTask.promise;
        renderTasksRef.current.delete(pageNum);
      } catch (err) {
        // Ignore cancellation errors
        if ((err as Error).name !== "RenderingCancelledException") {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
        renderTasksRef.current.delete(pageNum);
      }
    },
    [pdfDoc, baseScale]
  );

  // Recalculate base scale on resize
  useEffect(() => {
    if (!pdfDoc || !pagesRef.current) return;

    const handleResize = async () => {
      const newBaseScale = await calculateBaseScale(pdfDoc);
      setBaseScale(newBaseScale);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (pagesRef.current) {
      resizeObserver.observe(pagesRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [pdfDoc, calculateBaseScale]);

  // Track if we've rendered this PDF document already
  const renderedPdfRef = useRef<any>(null);
  const renderedScaleRef = useRef<number>(0);

  // Render all pages when PDF or baseScale changes
  useEffect(() => {
    if (!pdfDoc || numPages === 0 || baseScale === 0) return;

    // Avoid re-rendering if same PDF and same scale
    if (renderedPdfRef.current === pdfDoc && Math.abs(renderedScaleRef.current - baseScale) < 0.01) {
      return;
    }

    renderedPdfRef.current = pdfDoc;
    renderedScaleRef.current = baseScale;

    const renderAll = async () => {
      for (let i = 1; i <= numPages; i++) {
        await renderPage(i);
      }
    };

    renderAll();
  }, [pdfDoc, numPages, baseScale, renderPage]);


  // Handle scroll to detect page changes
  useEffect(() => {
    const pagesContainer = pagesRef.current;
    if (!pagesContainer) return;

    const handleScroll = () => {
      const scrollTop = pagesContainer.scrollTop;
      const containerHeight = pagesContainer.clientHeight;
      const pageNumber = Math.round(scrollTop / containerHeight) + 1;
      if (pageNumber !== currentPage && pageNumber >= 1 && pageNumber <= numPages) {
        setCurrentPage(pageNumber);
      }
    };

    // Use passive listener for better performance
    pagesContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => pagesContainer.removeEventListener("scroll", handleScroll);
  }, [currentPage, numPages]);

  // Keyboard handler for ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (isLoading && !suppressLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        <span>PDF yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (!pdfDoc || numPages === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        PDF yüklenemedi
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden relative bg-slate-900" style={{ transform: "translateZ(0)", isolation: "isolate", contain: "layout style paint" }}>
      {/* Pages container with scroll-snap */}
      <div
        ref={pagesRef}
        className="w-full h-full overflow-y-auto overflow-x-hidden"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "auto",
          WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
          willChange: "scroll-position",
          backfaceVisibility: "hidden",
          transform: "translateZ(0)",
        }}
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageNum = i + 1;
          return (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageContainersRef.current.set(pageNum, el);
              }}
              className="flex items-center justify-center w-full"
              style={{
                height: "100%",
                minHeight: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                willChange: "scroll-position",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
                contain: "layout style paint",
              }}
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(pageNum, el);
                }}
                className="block"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  transform: "translateZ(0)",
                  imageRendering: "-webkit-optimize-contrast",
                  WebkitFontSmoothing: "subpixel-antialiased",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Page indicator */}
      {numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800/80 text-white px-3 py-1 rounded-full text-sm">
          {currentPage} / {numPages}
        </div>
      )}
    </div>
  );
}

//test