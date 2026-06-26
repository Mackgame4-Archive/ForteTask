"use client";

import { usePathname, useSearchParams } from "next/navigation";

function BoardRedirectInput() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <input
      type="hidden"
      name="redirectTo"
      value={query ? `${pathname}?${query}` : pathname}
    />
  );
}

export { BoardRedirectInput };
