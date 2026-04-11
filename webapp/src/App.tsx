import { useStore } from './state/store';
import Home from './ui/screens/Home';
import MintSettings from './ui/screens/MintSettings';

function App() {
  const { state } = useStore();

  if (state.selectedMint) {
    const selectedScore = state.scores.find(s => s.url === state.selectedMint);
    if (selectedScore) {
      return <MintSettings />;
    }
  }

  return <Home />;
}

export default App;
