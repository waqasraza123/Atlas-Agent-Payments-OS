import { Panel } from "@atlas/ui";

export default function SellerPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10">
      <Panel className="w-full space-y-4 p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--atlas-muted)]">Seller workspace</p>
        <h1 className="text-3xl font-semibold">Seller organization shell</h1>
        <p className="text-base leading-7 text-[var(--atlas-muted)]">
          This route group is reserved for seller service listings, request fulfillment context,
          settlement records, and receipt delivery.
        </p>
      </Panel>
    </main>
  );
}
