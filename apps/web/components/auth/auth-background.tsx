export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--landing-border) 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Ambient glow orbs */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#F97316]/[0.04] blur-3xl" />
      <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-[#F97316]/[0.04] blur-3xl" />
    </div>
  );
}
