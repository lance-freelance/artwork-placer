import { StoreProvider } from '../state/Store';
import { MainLayout } from '../components/MainLayout';

/** The felt board itself, at the root route. */
export function FeltBoard() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}
