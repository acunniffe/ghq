"use client";

import { useEffect, useRef } from "react";

export function usePageTitle(title: string) {
  const originalTitle = useRef<string>("");

  useEffect(() => {
    if (typeof document !== "undefined") {
      originalTitle.current = document.title;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined" && title) {
      document.title = `(${title}) ${originalTitle.current}`;
    } else if (typeof document !== "undefined") {
      document.title = originalTitle.current;
    }

    return () => {
      if (typeof document !== "undefined") {
        document.title = originalTitle.current;
      }
    };
  }, [title]);
}
