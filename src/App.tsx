import { WalletProvider, useWallet } from './context/WalletContext';
import { Home } from './components/Home';
import { Receive } from './components/Receive';
import { Send } from './components/Send';
import { MintSettings } from './components/MintSettings';
import { About } from './components/About';
import { GraduationModal } from './components/GraduationModal';

function AppContent() {
  const { currentScreen, setCurrentScreen } = useWallet();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-50">
      {/* Navigation */}
      <nav className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setCurrentScreen('home')}
            className="text-sm font-bold bg-gradient-to-r from-amber-400 to-green-400 bg-clip-text text-transparent"
          >
            Freedom Wallet
          </button>
          <div className="flex gap-1">
            <NavButton
              label="Home"
              active={currentScreen === 'home'}
              onClick={() => setCurrentScreen('home')}
            />
            <NavButton
              label="Mints"
              active={currentScreen === 'settings'}
              onClick={() => setCurrentScreen('settings')}
            />
            <NavButton
              label="About"
              active={currentScreen === 'about'}
              onClick={() => setCurrentScreen('about')}
            />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pb-8">
        {currentScreen === 'home' && <Home />}
        {currentScreen === 'receive' && <Receive />}
        {currentScreen === 'send' && <Send />}
        {currentScreen === 'settings' && <MintSettings />}
        {currentScreen === 'about' && <About />}
      </main>

      {/* Graduation Modal */}
      <GraduationModal />
    </div>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
