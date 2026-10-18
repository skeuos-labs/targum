export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground select-none">
      {/* Window TitleBar / TopBar */}
      <header
        className="flex h-10 w-full items-center justify-between border-b border-border bg-card px-4"
        data-tauri-drag-region
      >
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Show Converter
          </span>
        </div>
        <div className="text-xs text-muted-foreground">Desktop Shell</div>
      </header>

      {/* 3-Column Workspace Shell */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Sources */}
        <aside className="w-72 border-r border-border bg-card/50 p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Sources</h2>
        </aside>

        {/* Center - Review Workspace */}
        <main className="flex flex-1 items-center justify-center p-6 bg-background">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium">Ready to Convert</p>
            <p className="text-xs mt-1">Import presentations or folders to start</p>
          </div>
        </main>

        {/* Right Sidebar - Export */}
        <aside className="w-80 border-l border-border bg-card/50 p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Export</h2>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="flex h-6 w-full items-center justify-between border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
        <span>Ready</span>
        <span>v0.1.0</span>
      </footer>
    </div>
  );
}
