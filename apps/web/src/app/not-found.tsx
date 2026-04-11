import { StatePanel } from "@atlas/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6">
      <StatePanel
        eyebrow="Atlas"
        title="Page not found"
        description="The requested Atlas route is not available in the current product surface."
        tone="warning"
      />
    </main>
  );
}
