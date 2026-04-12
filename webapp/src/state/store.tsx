import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AppState, AppView, MintConfig, MintScore, MigrationEvent, WalletBalance, ProbeResult, AutomationMode, TrustAlert, DemoMode, EntityWallet, Federation, WalletConnection } from './types';
import { getMintsForMode } from '../core/config';
import { probeMintInfo, probeMintKeysets } from '../core/network';
import { scoreAllMints } from '../core/trustEngine';
import { walletApi } from '../core/walletApi';
import { computeMigrationPlans, executeMigration } from '../core/migrationEngine';
import { discoverMints } from '../core/mintDiscovery';
import {
  generateScoreAlerts,
  generateAutoMigrationAlerts,
  generateAlertModeSuggestions,
} from '../core/alertEngine';

const initialState: AppState = {
  discoveredMints: [],
  scores: [],
  probeResults: new Map(),
  migrations: [],
  balances: [],
  totalBalance: 0,
  isScoring: false,
  lastScoredAt: null,
  currentView: 'dashboard',
  selectedMint: null,
  automationMode: 'auto',
  alerts: [],
  simulationActive: false,
  simulationScores: null,
  demoMode: 'mutinynet',
  entityWallets: [],
  federations: [],
};

type Action =
  | { type: 'SET_SCORING'; isScoring: boolean }
  | { type: 'SET_SCORES'; scores: MintScore[] }
  | { type: 'SET_PROBE_RESULT'; url: string; result: ProbeResult }
  | { type: 'ADD_MIGRATION'; event: MigrationEvent }
  | { type: 'UPDATE_MIGRATION'; id: string; status: MigrationEvent['status'] }
  | { type: 'SET_BALANCES'; balances: WalletBalance[]; total: number }
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_SELECTED_MINT'; url: string | null }
  | { type: 'SET_AUTOMATION_MODE'; mode: AutomationMode }
  | { type: 'ADD_ALERT'; alert: TrustAlert }
  | { type: 'DISMISS_ALERT'; id: string }
  | { type: 'SET_ALERT_ACTION'; id: string; action: TrustAlert['actionTaken'] }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'SET_SIMULATION_ACTIVE'; active: boolean }
  | { type: 'SET_SIMULATION_SCORES'; scores: MintScore[] | null }
  | { type: 'SET_DEMO_MODE'; mode: DemoMode }
  | { type: 'SET_ENTITY_WALLETS'; wallets: EntityWallet[] }
  | { type: 'SET_FEDERATIONS'; federations: Federation[] }
  | { type: 'SET_TOTAL_BALANCE'; amount: number }
  | { type: 'SET_DISCOVERED_MINTS'; mints: MintConfig[] };

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
    case 'SET_AUTOMATION_MODE':
      return { ...state, automationMode: action.mode };
    case 'ADD_ALERT':
      return { ...state, alerts: [action.alert, ...state.alerts].slice(0, 100) };
    case 'DISMISS_ALERT':
      return { ...state, alerts: state.alerts.map(a => a.id === action.id ? { ...a, dismissed: true } : a) };
    case 'SET_ALERT_ACTION':
      return { ...state, alerts: state.alerts.map(a => a.id === action.id ? { ...a, actionTaken: action.action } : a) };
    case 'CLEAR_ALERTS':
      return { ...state, alerts: [] };
    case 'SET_SIMULATION_ACTIVE':
      return { ...state, simulationActive: action.active, simulationScores: action.active ? state.simulationScores : null };
    case 'SET_SIMULATION_SCORES':
      return { ...state, simulationScores: action.scores };
    case 'SET_DEMO_MODE':
      return { ...state, demoMode: action.mode };
    case 'SET_ENTITY_WALLETS':
      return { ...state, entityWallets: action.wallets };
    case 'SET_FEDERATIONS':
      return { ...state, federations: action.federations };
    case 'SET_TOTAL_BALANCE':
      return { ...state, totalBalance: action.amount };
    case 'SET_DISCOVERED_MINTS':
      return { ...state, discoveredMints: action.mints };
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
  approveMigration: (alertId: string, mintName: string, score: number) => Promise<void>;
  /**
   * (Re-)initialise the server wallet engine with discovered mints.
   * Resolves with a WalletConnection describing per-mint status.
   */
  connectWallet: () => Promise<WalletConnection>;
  /** Returns the effective scores (simulation overrides real when active) */
  effectiveScores: MintScore[];
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const cachedKeysets = useRef<Map<string, string[]>>(new Map());
  const scoringRef = useRef(false);
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const mintsRef = useRef<MintConfig[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshBalances = useCallback(() => {
    walletApi.getAllBalances().then(({ balances, total }) => {
      dispatch({ type: 'SET_BALANCES', balances, total });
    });
  }, []);

  /** Step 1: Fire all mint probes in parallel, dispatch each result as it arrives */
  async function probeAllMints(mints: MintConfig[]): Promise<Map<string, ProbeResult>> {
    const probeResults = new Map<string, ProbeResult>();
    await Promise.allSettled(
      mints.map(async (mint) => {
        const [info, keysets] = await Promise.all([
          probeMintInfo(mint.url),
          probeMintKeysets(mint.url),
        ]);
        const result: ProbeResult = { info, keysets };
        probeResults.set(mint.url, result);
        dispatch({ type: 'SET_PROBE_RESULT', url: mint.url, result });
      }),
    );
    return probeResults;
  }

  /** Step 2: Update the mutable keyset cache from newly scored results */
  function updateKeysetCache(scores: MintScore[]): void {
    for (const score of scores) {
      const keysetSignal = score.signals.find((s) => s.name === 'keyset_stability');
      if (keysetSignal?.rawData?.keysets) {
        cachedKeysets.current.set(score.url, keysetSignal.rawData.keysets as string[]);
      }
    }
  }

  /** Step 3: Execute auto or alert-mode migration logic after scoring */
  async function executeAutoMigrations(
    scores: MintScore[],
    currentState: AppState,
  ): Promise<TrustAlert[]> {
    const modeAlerts: TrustAlert[] = [];

    if (currentState.automationMode === 'auto' && currentState.totalBalance > 0) {
      const plans = computeMigrationPlans(scores, currentState.balances, currentState.totalBalance);

      const autoAlerts = generateAutoMigrationAlerts(plans, scores);
      autoAlerts.forEach((alert) => dispatch({ type: 'ADD_ALERT', alert }));
      modeAlerts.push(...autoAlerts);

      for (const plan of plans) {
        const event = await executeMigration(plan);
        if (event) dispatch({ type: 'ADD_MIGRATION', event });
      }

      if (plans.length > 0) refreshBalances();
    } else if (currentState.automationMode === 'alert') {
      const plans = computeMigrationPlans(scores, currentState.balances, currentState.totalBalance);
      const suggestAlerts = generateAlertModeSuggestions(plans, scores);
      suggestAlerts.forEach((alert) => dispatch({ type: 'ADD_ALERT', alert }));
      modeAlerts.push(...suggestAlerts);
    }

    return modeAlerts;
  }

  /** Coordinator: probe → score → alert → (auto-)migrate */
  const runScoring = useCallback(async () => {
    if (scoringRef.current) return;
    const allMints = mintsRef.current;
    if (allMints.length === 0) return;

    const mints = getMintsForMode(allMints, stateRef.current.demoMode);

    scoringRef.current = true;
    dispatch({ type: 'SET_SCORING', isScoring: true });

    try {
      const probeResults = await probeAllMints(mints);
      const scores = await scoreAllMints(mints, probeResults, cachedKeysets.current, prevScoresRef.current);

      updateKeysetCache(scores);

      const scoreAlerts = generateScoreAlerts(scores, prevScoresRef.current);
      scoreAlerts.forEach((alert) => dispatch({ type: 'ADD_ALERT', alert }));
      scores.forEach((s) => prevScoresRef.current.set(s.url, s.compositeScore));

      dispatch({ type: 'SET_SCORES', scores });
      const modeAlerts = await executeAutoMigrations(scores, stateRef.current);

      // Send to Discord if in alert or auto mode and there are alerts
      const allAlerts = [...scoreAlerts, ...modeAlerts];
      if (stateRef.current.automationMode !== 'manual' && allAlerts.length > 0) {
        walletApi.notifyDiscord(allAlerts).catch((err) =>
          console.warn('[L3] Discord notification failed:', err),
        );
      }
    } catch (err) {
      console.error('[L3] Scoring failed:', err);
      dispatch({ type: 'SET_SCORING', isScoring: false });
    } finally {
      scoringRef.current = false;
    }
  }, []);

  const setView = useCallback((view: AppView) => {
    dispatch({ type: 'SET_VIEW', view });
  }, []);

  /** Approve a pending migration_suggested alert — execute the migration */
  const approveMigration = useCallback(
    async (alertId: string, mintName: string, score: number) => {
      dispatch({ type: 'SET_ALERT_ACTION', id: alertId, action: 'migrated' });

      const currentState = stateRef.current;
      const plans = computeMigrationPlans(
        currentState.scores,
        currentState.balances,
        currentState.totalBalance,
      );
      const plan = plans.find((p) => p.fromName === mintName) ?? plans[0];

      if (plan) {
        const event = await executeMigration(plan);
        if (event) dispatch({ type: 'ADD_MIGRATION', event });
      } else {
        dispatch({
          type: 'ADD_MIGRATION',
          event: {
            id: crypto.randomUUID(),
            fromMint: mintName,
            toMint: 'Best available',
            amount: 0,
            reason: `Manual approval: trust score ${score.toFixed(0)} — no eligible target found`,
            timestamp: new Date().toISOString(),
            status: 'failed',
          },
        });
      }
    },
    [],
  );

  /** Re-initialise wallet engine on the server, optionally with discovered mints. */
  const connectWallet = useCallback(async (): Promise<WalletConnection> => {
    const currentState = stateRef.current;
    const allMints = mintsRef.current;
    const filteredMints = getMintsForMode(allMints, currentState.demoMode);

    const mintStatuses: Record<string, 'idle' | 'connecting' | 'failed' | 'connected'> = {};
    filteredMints.forEach((m) => { mintStatuses[m.url] = 'connecting'; });

    const result = await walletApi.setMode(currentState.demoMode, filteredMints);
    filteredMints.forEach((m) => {
      mintStatuses[m.url] = result.ok ? 'connected' : 'failed';
    });

    refreshBalances();

    // Auto-run scoring so trust scores are available immediately
    if (result.ok) {
      runScoring();
    }

    return {
      connected: result.ok,
      hasSeed: false,
      mintStatuses,
    };
  }, [refreshBalances, runScoring]);

  const effectiveScores =
    state.simulationActive && state.simulationScores ? state.simulationScores : state.scores;

  // Discover mints on mount, tell server about them, then score
  useEffect(() => {
    discoverMints().then((mints) => {
      console.log(`[L3] Discovered ${mints.length} mints from NIP-87`);
      mintsRef.current = mints;
      dispatch({ type: 'SET_DISCOVERED_MINTS', mints });

      const filteredMints = getMintsForMode(mints, stateRef.current.demoMode);
      walletApi.setMode(stateRef.current.demoMode, filteredMints).then(() => {
        refreshBalances();
        // Run initial scoring so trust scores are available right away
        runScoring();
      });
    });

    return () => {};
  }, [refreshBalances]);

  // Re-initialize wallet engine when demoMode changes
  const prevModeRef = useRef(state.demoMode);
  useEffect(() => {
    if (state.demoMode === prevModeRef.current) return;
    prevModeRef.current = state.demoMode;

    const filteredMints = getMintsForMode(mintsRef.current, state.demoMode);
    walletApi.setMode(state.demoMode, filteredMints).then(() => {
      refreshBalances();
    });

    // Clear stale scores/alerts — they'll repopulate on next scoring cycle
    dispatch({ type: 'SET_SCORES', scores: [] });
    dispatch({ type: 'CLEAR_ALERTS' });
  }, [state.demoMode, refreshBalances]);

  return (
    <StoreContext.Provider
      value={{ state, dispatch, runScoring, refreshBalances, setView, approveMigration, connectWallet, effectiveScores }}
    >
      {children}
    </StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
