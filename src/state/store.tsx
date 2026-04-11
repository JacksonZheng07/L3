import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { AppState, MintState, TrustScore, Transaction, MigrationEvent } from './types';
import type { Proof } from '@cashu/cashu-ts';
import { config } from '../core/config';

// ─── Initial state ───────────────────────────────────────────
function createInitialMintState(url: string, name: string): MintState {
  return {
    url,
    name,
    proofs: [],
    balance: 0,
    trustScore: {
      signals: {
        availability: 0,
        latency: 0,
        keysetStable: 0,
        txSuccessRate: 0,
        versionCurrent: 0,
        operatorInfo: 0,
      },
      score: 0,
      grade: 'warning',
      lastChecked: 0,
    },
    cachedKeysets: [],
    txTotal: 0,
    txSuccess: 0,
    healthCheckFailures: 0,
  };
}

const initialState: AppState = {
  mints: {
    [config.mints.a]: createInitialMintState(config.mints.a, 'Mint A'),
    [config.mints.b]: createInitialMintState(config.mints.b, 'Mint B'),
  },
  transactions: [],
  migrations: [],
  isMigrating: false,
  graduationShown: false,
};

// ─── Actions ─────────────────────────────────────────────────
export type Action =
  | { type: 'UPDATE_TRUST_SCORE'; mintUrl: string; score: TrustScore }
  | { type: 'ADD_PROOFS'; mintUrl: string; proofs: Proof[] }
  | { type: 'REMOVE_PROOFS'; mintUrl: string; proofs: Proof[] }
  | { type: 'SET_PROOFS'; mintUrl: string; proofs: Proof[] }
  | { type: 'ADD_TRANSACTION'; tx: Transaction }
  | { type: 'ADD_MIGRATION'; event: MigrationEvent }
  | { type: 'UPDATE_MIGRATION'; id: string; updates: Partial<MigrationEvent> }
  | { type: 'SET_MIGRATING'; value: boolean }
  | { type: 'SET_GRADUATION_SHOWN'; value: boolean }
  | { type: 'RECORD_TX_RESULT'; mintUrl: string; success: boolean }
  | { type: 'SET_CACHED_KEYSETS'; mintUrl: string; keysets: string[] };

// ─── Reducer ─────────────────────────────────────────────────
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'UPDATE_TRUST_SCORE': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            trustScore: action.score,
          },
        },
      };
    }

    case 'ADD_PROOFS': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      const newProofs = [...mint.proofs, ...action.proofs];
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            proofs: newProofs,
            balance: newProofs.reduce((sum, p) => sum + p.amount, 0),
          },
        },
      };
    }

    case 'REMOVE_PROOFS': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      const proofIds = new Set(action.proofs.map(p => p.secret));
      const remaining = mint.proofs.filter(p => !proofIds.has(p.secret));
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            proofs: remaining,
            balance: remaining.reduce((sum, p) => sum + p.amount, 0),
          },
        },
      };
    }

    case 'SET_PROOFS': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            proofs: action.proofs,
            balance: action.proofs.reduce((sum, p) => sum + p.amount, 0),
          },
        },
      };
    }

    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [action.tx, ...state.transactions],
      };

    case 'ADD_MIGRATION':
      return {
        ...state,
        migrations: [action.event, ...state.migrations],
      };

    case 'UPDATE_MIGRATION': {
      return {
        ...state,
        migrations: state.migrations.map(m =>
          m.id === action.id ? { ...m, ...action.updates } : m
        ),
      };
    }

    case 'SET_MIGRATING':
      return { ...state, isMigrating: action.value };

    case 'SET_GRADUATION_SHOWN':
      return { ...state, graduationShown: action.value };

    case 'RECORD_TX_RESULT': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            txTotal: mint.txTotal + 1,
            txSuccess: mint.txSuccess + (action.success ? 1 : 0),
          },
        },
      };
    }

    case 'SET_CACHED_KEYSETS': {
      const mint = state.mints[action.mintUrl];
      if (!mint) return state;
      return {
        ...state,
        mints: {
          ...state.mints,
          [action.mintUrl]: {
            ...mint,
            cachedKeysets: action.keysets,
          },
        },
      };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────
const StateContext = createContext<AppState>(initialState);
const DispatchContext = createContext<Dispatch<Action>>(() => {});

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(StateContext);
}

export function useDispatch(): Dispatch<Action> {
  return useContext(DispatchContext);
}

// ─── Derived state helpers ───────────────────────────────────
export function getTotalBalance(state: AppState): number {
  return Object.values(state.mints).reduce((sum, m) => sum + m.balance, 0);
}

export function getMintList(state: AppState): MintState[] {
  return Object.values(state.mints);
}
