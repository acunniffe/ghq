import React, { useState, useCallback } from "react";
import classNames from "classnames";
import { Coordinate } from "@/game/engine";

interface MouseTrackerProps {
  children: React.ReactNode;
  onRightClickDrag: (start: Coordinate, end: Coordinate) => void;
  onLeftClickDown: (coordinate: Coordinate) => void;
  onLeftClickUp: (coordinate: Coordinate) => void;
  onMouseOver: (coordinate: Coordinate) => void;
  ref: (instance: Element | null) => void;
  flipped: boolean;
  isTutorial: boolean;
}

export default function BoardContainer({
  children,
  onRightClickDrag,
  onLeftClickDown,
  onLeftClickUp,
  onMouseOver,
  ref,
  flipped,
  isTutorial,
}: MouseTrackerProps) {
  const [startCoords, setStartCoords] = useState<Coordinate | null>(null);

  // There's a weird thing (it seems in Chrome dev tools) where a single tap
  // can trigger both a touch and a mouse event simultaneously. We use this
  // to record our best guess of whether we're on mobile, and stick to that if so.
  const [isLikelyMobile, setIsLikelyMobile] = useState(false);

  function coordinateFromHTMLElement(el: HTMLElement): Coordinate | null {
    // Handle both camelCase and kebab-case data attributes
    const rowIndex = el.dataset.rowIndex || el.dataset['row-index'];
    const colIndex = el.dataset.colIndex || el.dataset['col-index'];
    if (!rowIndex || !colIndex) return null;
    const row = parseInt(rowIndex, 10);
    const col = parseInt(colIndex, 10);
    // Validate coordinates are within board bounds (0-7)
    if (isNaN(row) || isNaN(col) || row < 0 || row > 7 || col < 0 || col > 7) return null;
    return [row, col];
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isLikelyMobile) return;

      if (e.button === 0) {
        const coordinate = coordinateFromHTMLElement(e.target as HTMLElement);
        if (!coordinate) return;
        onLeftClickDown(coordinate);
      }
      if (e.button === 2) {
        const coordinate = coordinateFromHTMLElement(e.target as HTMLElement);
        if (!coordinate) return;
        const [row, col] = coordinate;
        setStartCoords([row, col]);
      }
    },
    [onLeftClickDown, isLikelyMobile]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isLikelyMobile) return;

      if (e.button === 0) {
        const coordinate = coordinateFromHTMLElement(e.target as HTMLElement);
        if (!coordinate) return;
        const [row, col] = coordinate;
        onLeftClickUp([row, col]);
      }
      if (e.button === 2 && startCoords) {
        const coordinate = coordinateFromHTMLElement(e.target as HTMLElement);
        if (!coordinate) return;
        const [row, col] = coordinate;
        onRightClickDrag(startCoords, [row, col]);
        setStartCoords(null);
      }
    },
    [startCoords, onRightClickDrag, onLeftClickUp, isLikelyMobile]
  );

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const coordinate = coordinateFromHTMLElement(e.target as HTMLElement);
      if (!coordinate) return;
      const [row, col] = coordinate;
      onMouseOver([row, col]);
    },
    [onMouseOver]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsLikelyMobile(true);
      e.preventDefault(); // Prevent default touch behaviors
      
      const touch = e.touches[0];
      if (!touch) return;
      
      // Try to get coordinate from the direct target first
      let targetElement = touch.target as HTMLElement;
      let coordinate = coordinateFromHTMLElement(targetElement);
      
      // If not found, walk up the DOM tree
      if (!coordinate) {
        let attempts = 0;
        while (targetElement && attempts < 10) {
          coordinate = coordinateFromHTMLElement(targetElement);
          if (coordinate) break;
          targetElement = targetElement.parentElement as HTMLElement;
          attempts++;
        }
      }
      
      if (!coordinate) return;
      onLeftClickDown(coordinate);
    },
    [onLeftClickDown]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      setIsLikelyMobile(true);
      e.preventDefault(); // Prevent default touch behaviors
      
      const touch = e.changedTouches[0];
      if (!touch) return;
      
      // Use clientX/clientY instead of pageX/pageY for viewport-relative coordinates
      let touchedElement = document.elementFromPoint(
        touch.clientX,
        touch.clientY
      );
      
      if (!touchedElement) return;
      
      // Walk up the DOM tree to find an element with coordinate data
      let attempts = 0;
      while (touchedElement && attempts < 10) {
        const coordinate = coordinateFromHTMLElement(
          touchedElement as HTMLElement
        );
        if (coordinate) {
          onLeftClickUp(coordinate);
          return;
        }
        touchedElement = touchedElement.parentElement;
        attempts++;
      }
    },
    [onLeftClickUp]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // Prevent scrolling when touching the game board
      e.preventDefault();
    },
    []
  );

  return (
    <div
      onMouseOver={handleMouseOver}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={classNames(
        isTutorial
          ? "w-[360px] h-[360px]"
          : "w-[360px] h-[360px] lg:w-[600px] lg:h-[600px] cursor-pointer relative",
        {
          "rotate-180": flipped,
        }
      )}
      ref={ref}
      style={{ touchAction: "none" }}
    >
      {children}
    </div>
  );
}
