import { StoreProvider } from './state/Store';
import { MainLayout } from './components/MainLayout';
import { TooltipProvider } from '@/components/ui/tooltip';

function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <MainLayout />
      </TooltipProvider>
    </StoreProvider>
  );
}

export default App;