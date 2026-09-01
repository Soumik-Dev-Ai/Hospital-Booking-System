export default function Background() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden bg-forest-950"
    >
      {/* base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_-12%,#17382a_0%,#0b1d16_46%,#071210_100%)]" />

      {/* aurora blobs */}
      <div className="absolute -top-44 -left-44 h-[36rem] w-[36rem] rounded-full bg-forest-400/25 blur-[130px] animate-drift-a" />
      <div className="absolute top-1/3 -right-52 h-[40rem] w-[40rem] rounded-full bg-gold/12 blur-[150px] animate-drift-b" />
      <div className="absolute -bottom-60 left-1/4 h-[38rem] w-[38rem] rounded-full bg-forest-600/30 blur-[150px] animate-drift-c" />
      <div className="absolute top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-mint/[0.07] blur-[110px]" />

      {/* fine grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245,242,234,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(245,242,234,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_78%_62%_at_50%_0%,black_28%,transparent_78%)]" />

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_105%_at_50%_42%,transparent_52%,rgba(4,10,8,0.88)_100%)]" />

      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
