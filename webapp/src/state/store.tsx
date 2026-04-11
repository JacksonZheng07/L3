import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AppState, AppView, MintScore, MigrationEvent, WalletBalance, ProbeResult } from './types';
import { MINTS, SCORING_INTERVAL_MS } from '../core/config';
import { probeMintInfo, probeMintKeysets } from '../core/network';
import { scoreAllMints } from '../core/trustEngine';
import { walletEngine } from '../core/walletEngine';

const initialState: AppState = {
  scores: [],
  probeResults: new Map(),
  migrations: [],
  balances: [],
  totalBalance: 0,
  isScoring: false,
  lastScoredAt: null,
  currentView: 'dashboard',
  selectedMint: null,
};

type Action =
  | { type: 'SET_SCORING'; isScoring: boolean }
  | { type: 'SET_SCORES'; scores: MintScore[] }
  | { type: 'SET_PROBE_RESULT'; url: string; result: ProbeResult }
  | { type: 'ADD_MIGRATION'; event: MigrationEvent }
  | { type: 'UPDATE_MIGRATION'; id: string; status: MigrationEvent['status'] }
  | { type: 'SET_BALANCES'; balances: WalletBalance[]; total: number }
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_SELECTED_MINT'; url: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCORING':
      return { ...state, isScoring: action.isScoring };
    case 'SET_SCORES':
      return { ...state, scores: action.scores, lastScoredAt: new Date().toISOString(), isScoring: false };
    case 'SET_PROBE_RESULT': {
      const newMap = new Map(state.probeResults);
      newMap.set(action.url, action.result);
      return { ...state, probeResults: newMap };
    }
    case 'ADD_MIGRATION':
      return { ...state, migrations: [action.event, ...state.migrations].slice(0, 50) };
    case 'UPDATE_MIGRATION':
      return {
        ...state,
        migrations: state.migrations.map(m =>
          m.id === action.id ? { ...m, status: action.status } : m
        ),
      };
    case 'SET_BALANCES':
      return { ...state, balances: action.balances, totalBalance: action.total };
    case 'SET_VIEW':
      return { ...state, currentView: action.view };
    case 'SET_SELECTED_MINT':
      return { ...state, selectedMint: action.url };
    default:
      return state;
  }
}

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  runScoring: () => Promise<void>;
  refreshBalances: () => void;
  setView: (view: AppView) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const cachedKeysets = useRef<Map<string, string[]>>(new Map());
  const scoringRef = useRef(false);

  const refreshBalances = useCallback(() => {
    const balances = walletEngine.getAllBalances();
    const total = walletEngine.getTotalBalance();
    dispatch({ type: 'SET_BALANCES', balances, total });
  }, []);

  const runScoring = useCallback(async () => {
    if (scoringRef.current) return;
    scoringRef.current = true;
    dispatch({ type: 'SET_SCORING', isScoring: true });

    // Probe all mints in parallel
    const probeResults = new Map<string, ProbeResult>();
    const probePromises = MINTS.map(async (mint) => {
      const [info, keysets] = await Promise.all([
        probeMintInfo(mint.url),
        probeMintKeysets(mint.url),
      ]);
      const result: ProbeResult = { info, keysets };
      probeResults.set(mint.url, result);
      dispatch({ type: 'SET_PROBE_RESULT', url: mint.url, result });
    });

    await Promise.allSettled(probePromises);

    // Score all mints
    const scores = await scoreAllMints(MINTS, probeResults, cachedKeysets.current);

    // Update keyset cache
    for (const score of scores) {
      const keysetSignal = score.signals.find(s => s.name === 'keyset_stability');
      if (keysetSignal?.rawData?.keysets) {
        cachedKeysets.current.set(score.url, keysetSignal.rawData.keysets as string[]);
      }
    }

    dispatch({ type: 'SET_SCORES', scores });
    scoringRef.current = false;
  }, []);

  const setView = useCallback((view: AppView) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  // Initial scoring + interval
  useEffect(() => {
    walletEngine.initialize().then(() => {
      refreshBalances();
      runScoring();
    });

    const interval = setInterval(() => {
      runScoring();
    }, SCORING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [runScoring, refreshBalances]);

  return (
    <StoreContext.Provider value={{ state, dispatch, runScoring, refreshBalances, setView }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
