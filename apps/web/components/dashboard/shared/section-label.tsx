interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-widest text-[#F97316]">
      {children}
    </span>
  );
}
