import { Route, Switch } from 'wouter';

import { TooltipProvider } from '@/components/ui/tooltip';
import { FeltBoard } from './pages/FeltBoard';
import { AdminPage } from './pages/admin/AdminPage';
import NotFound from './pages/not-found';

function App() {
  return (
    <TooltipProvider>
      <Switch>
        <Route path="/" component={FeltBoard} />
        {/* Unlisted: reachable by URL, never linked from the experience. */}
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </TooltipProvider>
  );
}

export default App;
