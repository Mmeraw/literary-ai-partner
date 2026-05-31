'use client';

import { useEffect } from 'react';

type AutoPrintOnLoadProps = {
  enabled?: boolean;
};

export default function AutoPrintOnLoad({ enabled = false }: AutoPrintOnLoadProps) {
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}
