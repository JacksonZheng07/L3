import { useState } from 'react';
import { StateProvider, useAppState, useDispatch, getTotalBalance } from './state/store';
import { config, validateConfig } from './core/config';
import { Home } from './ui/screens/Home';
import { Receive } from './ui/screens/Receive';
import { Send } from './ui/screens/Send';
import { MintSettings } from './ui/screens/MintSettings';
import { GraduationModal } from './ui/screens/GraduationModal';

validateConfig();

type Screen = 'home' | 'receive' | 'send' | 'settings';

function AppInner() {
  const [screen, setScreen] = useState<Screen>('home');
  const [showGraduation, setShowGraduation] = useState(false);
  const state = useAppState();
  const dispatch = useDispatch();
  const totalBalance = getTotalBalance(state);

  const handleNavigate = (target: 'receive' | 'send' | 'settings') => {
    setScreen(target);
  };

  const handleBack = () => setScreen('home');

  // Check graduation threshold
  if (
    !state.graduationShown &&
    !showGraduation &&
    totalBalance >= config.ui.graduationThresholdDemo
  ) {
    setShowGraduation(true);
  }

  return (
    <>
      {screen === 'home' && <Home onNavigate={handleNavigate} />}
      {screen === 'receive' && <Receive onBack={handleBack} />}
      {screen === 'send' && <Send onBack={handleBack} />}
      {screen === 'settings' && <MintSettings onBack={handleBack} />}

      {showGraduation && (
        <GraduationModal
          onClose={() => {
            setShowGraduation(false);
            dispatch({ type: 'SET_GRADUATION_SHOWN', value: true });
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <StateProvider>
      <AppInner />
    </StateProvider>
  );
}
