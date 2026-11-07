export default function Loading() {
  return (
    <main className="studio-shell flex min-h-screen items-center justify-center px-6 text-[#f8f4ea]">
      <section className="rounded-lg border border-white/15 bg-[#181d1f]/85 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#7ddac8]/20 border-t-[#7ddac8]" />
        <h1 className="mt-5 text-2xl font-black">Loading search workspace</h1>
        <p className="mt-2 text-sm text-[#d6ded5]">Preparing the retrieval studio.</p>
      </section>
    </main>
  );
}