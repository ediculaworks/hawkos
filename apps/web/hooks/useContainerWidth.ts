import { useCallback, useEffect, useRef, useState } from 'react';

interface UseContainerWidthOptions {
  initialWidth?: number;
}

interface UseContainerWidthResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  width: number;
}

export function useContainerWidth(options: UseContainerWidthOptions = {}): UseContainerWidthResult {
  const { initialWidth = 1200 } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [updateWidth]);

  return { containerRef, width };
}
