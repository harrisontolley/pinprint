// Tiny shared loading/error/empty placeholders for account resource pages.

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="px-1 py-6 text-sm text-muted">{label}</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-hairline bg-surface-strong px-3 py-2 text-sm text-error">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-6 text-sm text-muted">{children}</p>;
}
