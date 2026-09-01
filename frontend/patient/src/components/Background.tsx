export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-alabaster-100" aria-hidden>
      {/* Aurora blobs */}
      <div className="animate-drift absolute -left-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-forest-300/35 blur-[130px]" />
      <div
        className="animate-drift absolute -right-52 top-28 h-[32rem] w-[32rem] rounded-full bg-champagne-300/50 blur-[130px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="animate-drift absolute -bottom-44 left-1/3 h-[38rem] w-[38rem] rounded-full bg-forest-200/45 blur-[150px]"
        style={{ animationDelay: "-13s" }}
      />
      <div
        className="animate-drift absolute right-1/4 top-2/3 h-72 w-72 rounded-full bg-champagne-200/40 blur-[110px]"
        style={{ animationDelay: "-3s" }}
      />

      {/* Faint architectural grid */}
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(18,43,34,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(18,43,34,0.045)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />

      {/* Film grain */}
      <div className="grain absolute inset-0 opacity-[0.05] mix-blend-multiply" />

      {/* Soft vignette at very top for header contrast */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-alabaster-50/90 to-transparent" />
    </div>
  );
}
