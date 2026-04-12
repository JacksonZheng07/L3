import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AppState, AppView, MintConfig, MintScore, MigrationEvent, WalletBalance, ProbeResult, AutomationMode, TrustAlert, DemoMode, EntityWallet, Federation } from './types';
import '../core/config';
import { probeMintInfo, probeMintKeysets } from '../core/network';
import { scoreAllMints } from '../core/trustEngine';
import { walletEngine } from '../core/walletEngine';
import { computeMigrationPlans, executeMigration } from '../core/migrationEngine';
import { discoverMints } from '../core/mintDiscovery';

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
  automationMode: 'alert',
  alerts: [],
  simulationActive: false,
  simulationScores: null,
  demoMode: 'mock',
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
    const balances = walletEngine.getAllBalances();
    const total = walletEngine.getTotalBalance();
    dispatch({ type: 'SET_BALANCES', balances, total });
  }, []);

  const runScoring = useCallback(async () => {
    if (scoringRef.current) return;
    const mints = mintsRef.current;
    if (mints.length === 0) return; // not yet discovered
    scoringRef.current = true;
    dispatch({ type: 'SET_SCORING', isScoring: true });

    try {
      const probeResults = new Map<string, ProbeResult>();
      const probePromises = mints.map(async (mint) => {
        const [info, keysets] = await Promise.all([
          probeMintInfo(mint.url),
          probeMintKeysets(mint.url),
        ]);
        const result: ProbeResult = { info, keysets };
        probeResults.set(mint.url, result);
        dispatch({ type: 'SET_PROBE_RESULT', url: mint.url, result });
      });

      await Promise.allSettled(probePromises);

      const scores = await scoreAllMints(mints, probeResults, cachedKeysets.current);

      // Update keyset cache
      for (const score of scores) {
        const keysetSignal = score.signals.find(s => s.name === 'keyset_stability');
        if (keysetSignal?.rawData?.keysets) {
          cachedKeysets.current.set(score.url, keysetSignal.rawData.keysets as string[]);
        }
      }

      // Generate alerts by comparing with previous scores
      for (const score of scores) {
        const prevScore = prevScoresRef.current.get(score.url);
        if (prevScore !== undefined) {
          const drop = prevScore - score.compositeScore;
          if (score.grade === 'critical' && drop > 0) {
            dispatch({
              type: 'ADD_ALERT',
              alert: {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                mintUrl: score.url,
                mintName: score.name,
                type: 'critical',
                message: `${score.name} dropped to CRITICAL (${score.compositeScore.toFixed(0)}/100). Funds at risk.`,
                score: score.compositeScore,
                previousScore: prevScore,
                dismissed: false,
                actionTaken: 'pending',
              },
            });
          } else if (drop >= 10) {
            dispatch({
              type: 'ADD_ALERT',
              alert: {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                mintUrl: score.url,
                mintName: score.name,
                type: 'score_drop',
                message: `${score.name} score dropped ${drop.toFixed(0)} points (${prevScore.toFixed(0)} -> ${score.compositeScore.toFixed(0)})`,
                score: score.compositeScore,
                previousScore: prevScore,
                dismissed: false,
              },
            });
          } else if (prevScore < 50 && score.compositeScore >= 75) {
            dispatch({
              type: 'ADD_ALERT',
              alert: {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                mintUrl: score.url,
                mintName: score.name,
                type: 'recovery',
                message: `${score.name} recovered to SAFE (${score.compositeScore.toFixed(0)}/100)`,
                score: score.compositeScore,
                previousScore: prevScore,
                dismissed: false,
              },
            });
          }
        }
        prevScoresRef.current.set(score.url, score.compositeScore);
      }

      dispatch({ type: 'SET_SCORES', scores });

      // ── Auto-migration: compute and execute migration plans ──────
      const currentState = stateRef.current;
      if (currentState.automationMode === 'auto' && currentState.totalBalance > 0) {
        const plans = computeMigrationPlans(
          scores,
          currentState.balances,
          currentState.totalBalance,
        );

        for (const plan of plans) {
          // Dispatch alert about the migration
          dispatch({
            type: 'ADD_ALERT',
            alert: {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              mintUrl: plan.fromMint,
              mintName: plan.fromName,
              type: 'migration_executed',
              message: `Auto-migrating ${plan.amount.toLocaleString()} sats from ${plan.fromName} to ${plan.toName}: ${plan.reason}`,
              score: scores.find((s) => s.url === plan.fromMint)?.compositeScore ?? 0,
              dismissed: false,
              actionTaken: 'migrated',
            },
          });

          // Execute the actual migration
          const event = await executeMigration(plan);
          if (event) {
            dispatch({ type: 'ADD_MIGRATION', event });
          }
        }

        // Refresh balances after migrations
        if (plans.length > 0) {
          refreshBalances();
        }
      } else if (currentState.automationMode === 'alert') {
        // In alert mode, just suggest migrations
        const plans = computeMigrationPlans(
          scores,
          currentState.balances,
          currentState.totalBalance,
        );

        for (const plan of plans) {
          dispatch({
            type: 'ADD_ALERT',
            alert: {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              mintUrl: plan.fromMint,
              mintName: plan.fromName,
              type: 'migration_suggested',
              message: `Suggested: move ${plan.amount.toLocaleString()} sats from ${plan.fromName} to ${plan.toName}. ${plan.reason}`,
              score: scores.find((s) => s.url === plan.fromMint)?.compositeScore ?? 0,
              dismissed: false,
              actionTaken: 'pending',
            },
          });
        }
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

  const effectiveScores = state.simulationActive && state.simulationScores
    ? state.simulationScores
    : state.scores;

  useEffect(() => {
    // Discover mints from Nostr NIP-87, then init wallet (no auto-scoring)
    discoverMints().then((mints) => {
      console.log(`[L3] Discovered ${mints.length} mints from NIP-87`);
      mintsRef.current = mints;
      dispatch({ type: 'SET_DISCOVERED_MINTS', mints });

      walletEngine.initialize().then(() => {
        refreshBalances();
      });
    });

    return () => {};
  }, [runScoring, refreshBalances]);

  return (
    <StoreContext.Provider value={{ state, dispatch, runScoring, refreshBalances, setView, effectiveScores }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
