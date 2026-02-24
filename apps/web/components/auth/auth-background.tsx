export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Diagonal hatching */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      {/* Colored glow orbs — asymmetric */}
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/[0.06] blur-[100px]" />
      <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-cyan-500/[0.05] blur-[100px]" />
      <div className="absolute left-1/2 top-[40%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-purple-500/[0.03] blur-[120px]" />
    </div>
  );
}
