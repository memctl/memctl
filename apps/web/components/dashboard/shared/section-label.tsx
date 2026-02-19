interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <h2 className="text-sm font-medium text-[var(--landing-text)]">
      {children}
    </h2>
  );
}
