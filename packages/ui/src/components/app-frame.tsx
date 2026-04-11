import type { ReactNode } from "react";

type AppFrameProps = Readonly<{
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}>;

export function AppFrame({ sidebar, topBar, children }: AppFrameProps) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside>{sidebar}</aside>
        <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4 lg:min-h-[calc(100vh-3rem)]">
          {topBar}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
