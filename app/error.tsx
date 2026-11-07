"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="studio-shell flex min-h-screen items-center justify-center px-6 text-[#f8f4ea]">
      <section className="w-full max-w-lg rounded-lg border border-white/15 bg-[#181d1f]/90 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#f05d3b]/18 text-[#ffb59f]">
          <TriangleAlert size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-black">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-[#d6ded5]">The interface can retry without changing your project files or dataset.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#f8f4ea] px-5 text-sm font-black text-[#101315] transition hover:bg-white">
          Retry
        </button>
      </section>
    </main>
  );
}