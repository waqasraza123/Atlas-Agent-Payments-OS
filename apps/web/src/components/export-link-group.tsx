type ExportLinkGroupProps = Readonly<{
  links: Array<{
    label: string;
    href: string;
  }>;
}>;

export function ExportLinkGroup({ links }: ExportLinkGroupProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="inline-flex items-center rounded-full border border-[var(--atlas-line)] bg-white/5 px-4 py-2 text-sm text-[var(--atlas-ink)] transition hover:border-[var(--atlas-accent-strong)] hover:text-[var(--atlas-accent-strong)]"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

