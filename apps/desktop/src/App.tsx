import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { SourcesSidebar } from './components/SourcesSidebar';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { ExportSidebar } from './components/ExportSidebar';
import { BatchProgressModal } from './components/BatchProgressModal';

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground select-none overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SourcesSidebar />
        <ReviewWorkspace />
        <ExportSidebar />
      </div>
      <StatusBar />
      <BatchProgressModal />
    </div>
  );
}
