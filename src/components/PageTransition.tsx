"use client";

import { usePathname } from "next/navigation";

// Brief fade between pages, re-triggered by keying on the pathname. Purely
// cosmetic: no effect on data loading or navigation itself.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="flex flex-1 flex-col animate-page-fade-in">
      {children}
    </div>
  );
}
