"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6">
          <section className="rounded-[28px] border border-[rgba(255,126,126,0.35)] bg-[rgba(58,19,19,0.42)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--atlas-muted)]">Atlas</p>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--atlas-ink)]">Unexpected application error</h2>
              <p className="max-w-3xl text-sm leading-7 text-[var(--atlas-muted)] sm:text-base">
                Atlas hit an unrecoverable application error while rendering this route.
              </p>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
