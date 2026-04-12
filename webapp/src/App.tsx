import { useStore } from './state/store';
import AppShell from './ui/layout/AppShell';
import DashboardScreen from './ui/screens/DashboardScreen';
import MintsScreen from './ui/screens/MintsScreen';
import AlertsScreen from './ui/screens/AlertsScreen';
import SimulationScreen from './ui/screens/SimulationScreen';
import MigrationsScreen from './ui/screens/MigrationsScreen';
import WalletScreen from './ui/screens/WalletScreen';

function ActiveScreen() {
  const { state } = useStore();
  switch (state.currentView) {
    case 'mints':       return <MintsScreen />;
    case 'alerts':      return <AlertsScreen />;
    case 'simulation':  return <SimulationScreen />;
    case 'migrations':  return <MigrationsScreen />;
    case 'wallet':      return <WalletScreen />;
    default:            return <DashboardScreen />;
  }
}

function App() {
  return (
    <AppShell>
      <ActiveScreen />
    </AppShell>
  );
}

export default App;
