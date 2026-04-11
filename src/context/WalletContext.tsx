import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Wallet } from '@cashu/cashu-ts';
import type { MintQuoteBolt11Response } from '@cashu/cashu-ts';
import type { MintState, MintConfig, Transaction, Screen } from '../types';
import {
  createWallet,
  getMintInfo,
  getKeysetIds,
  requestMintQuote,
  checkMintQuote,
  mintProofs,
  requestMeltQuote,
  meltProofs,
  getProofsBalance,
} from '../lib/cashu';
import { calculateTrustScore } from '../lib/trustScore';

const MINT_CONFIGS: MintConfig[] = [
  { url: 'https://testnut.cashu.space', alias: 'Mint A' },
  { url: 'https://mint.minibits.cash/Bitcoin', alias: 'Mint B' },
];

const GRADUATION_THRESHOLD = 50000;

interface WalletContextType {
  mints: MintState[];
  transactions: Transaction[];
  totalBalance: number;
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  showGraduation: boolean;
  setShowGraduation: (show: boolean) => void;
  graduationDismissed: boolean;
  setGraduationDismissed: (dismissed: boolean) => void;
  initializeMints: () => Promise<void>;
  receiveToMint: (mintIndex: number, amount: number) => Promise<{
    quote: MintQuoteBolt11Response;
    invoice: string;
  }>;
  pollForPayment: (
    mintIndex: number,
    quote: MintQuoteBolt11Response,
    amount: number
  ) => Promise<boolean>;
  sendFromMint: (mintIndex: number, invoice: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mints, setMints] = useState<MintState[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGraduation, setShowGraduation] = useState(false);
  const [graduationDismissed, setGraduationDismissed] = useState(false);
  const walletsRef = useRef<Map<string, Wallet>>(new Map());
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const totalBalance = mints.reduce((sum, m) => sum + m.balance, 0);

  const clearError = useCallback(() => setError(null), []);

  const updateMintTrustScores = useCallback((currentMints: MintState[]): MintState[] => {
    return currentMints.map((m) => ({
      ...m,
      trustScore: calculateTrustScore(m),
    }));
  }, []);

  const checkGraduation = useCallback(
    (balance: number) => {
      if (balance >= GRADUATION_THRESHOLD && !graduationDismissed) {
        setShowGraduation(true);
      }
    },
    [graduationDismissed]
  );

  const initializeMints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mintStates: MintState[] = [];
      for (const config of MINT_CONFIGS) {
        try {
          const wallet = await createWallet(config.url);
          walletsRef.current.set(config.url, wallet);
          const [info, keysetIds] = await Promise.all([
            getMintInfo(config.url),
            getKeysetIds(config.url),
          ]);
          mintStates.push({
            url: config.url,
            alias: config.alias,
            proofs: [],
            balance: 0,
            trustScore: {
              infoResponsive: false,
              hasOperatorInfo: false,
              currentVersion: false,
              keysetStable: false,
              txSuccessRate: 0,
              uptimeClean: false,
              totalScore: 0,
            },
            initialKeysetIds: keysetIds,
            txSuccess: 0,
            txTotal: 0,
            healthChecksFailed: 0,
            info,
          });
        } catch (err) {
          console.error(`Failed to init ${config.alias}:`, err);
          mintStates.push({
            url: config.url,
            alias: config.alias,
            proofs: [],
            balance: 0,
            trustScore: {
              infoResponsive: false,
              hasOperatorInfo: false,
              currentVersion: false,
              keysetStable: false,
              txSuccessRate: 0,
              uptimeClean: false,
              totalScore: 0,
            },
            initialKeysetIds: [],
            txSuccess: 0,
            txTotal: 0,
            healthChecksFailed: 1,
            info: null,
          });
        }
      }
      setMints(updateMintTrustScores(mintStates));
    } catch (err) {
      setError('Failed to initialize mints');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [updateMintTrustScores]);

  // Health check every 30 seconds
  useEffect(() => {
    if (mints.length === 0) return;
    healthIntervalRef.current = setInterval(async () => {
      setMints((prev) => {
        const updated = prev.map((m) => ({ ...m }));
        Promise.all(
          updated.map(async (mint) => {
            try {
              await fetch(`${mint.url}/v1/info`);
            } catch {
              mint.healthChecksFailed += 1;
            }
          })
        ).then(() => {
          setMints((current) => updateMintTrustScores(current));
        });
        return prev;
      });
    }, 30000);
    return () => clearInterval(healthIntervalRef.current);
  }, [mints.length, updateMintTrustScores]);

  const receiveToMint = useCallback(
    async (mintIndex: number, amount: number) => {
      const mint = mints[mintIndex];
      if (!mint) throw new Error('Invalid mint');
      const wallet = walletsRef.current.get(mint.url);
      if (!wallet) throw new Error('Wallet not initialized');

      const quote = await requestMintQuote(wallet, amount);
      return { quote, invoice: quote.request };
    },
    [mints]
  );

  const pollForPayment = useCallback(
    async (mintIndex: number, quote: MintQuoteBolt11Response, amount: number): Promise<boolean> => {
      const mint = mints[mintIndex];
      if (!mint) return false;
      const wallet = walletsRef.current.get(mint.url);
      if (!wallet) return false;

      const checked = await checkMintQuote(wallet, quote);
      if (checked.state === 'PAID') {
        try {
          const proofs = await mintProofs(wallet, amount, checked);
          setMints((prev) => {
            const updated = [...prev];
            const m = { ...updated[mintIndex] };
            m.proofs = [...m.proofs, ...proofs];
            m.balance = getProofsBalance(m.proofs);
            m.txSuccess += 1;
            m.txTotal += 1;
            updated[mintIndex] = m;
            const result = updateMintTrustScores(updated);
            const newTotal = result.reduce((s, x) => s + x.balance, 0);
            checkGraduation(newTotal);
            return result;
          });
          setTransactions((prev) => [
            {
              id: crypto.randomUUID(),
              type: 'receive',
              amount,
              mintUrl: mint.url,
              mintAlias: mint.alias,
              timestamp: Date.now(),
              status: 'complete',
            },
            ...prev,
          ]);
          return true;
        } catch (err) {
          console.error('Mint proofs failed:', err);
          setMints((prev) => {
            const updated = [...prev];
            const m = { ...updated[mintIndex] };
            m.txTotal += 1;
            updated[mintIndex] = m;
            return updateMintTrustScores(updated);
          });
          throw err;
        }
      }
      return false;
    },
    [mints, updateMintTrustScores, checkGraduation]
  );

  const sendFromMint = useCallback(
    async (mintIndex: number, invoice: string) => {
      const mint = mints[mintIndex];
      if (!mint) throw new Error('Invalid mint');
      const wallet = walletsRef.current.get(mint.url);
      if (!wallet) throw new Error('Wallet not initialized');

      if (mint.balance === 0) throw new Error('No balance on this mint');

      const meltQuote = await requestMeltQuote(wallet, invoice);
      const needed = meltQuote.amount + meltQuote.fee_reserve;

      if (mint.balance < needed) {
        throw new Error(
          `Insufficient balance. Need ${needed} sats (${meltQuote.amount} + ${meltQuote.fee_reserve} fee), have ${mint.balance}`
        );
      }

      // Select proofs to cover amount + fees
      const { send: proofsToSend, keep } = wallet.selectProofsToSend(
        mint.proofs,
        needed,
        true
      );

      const result = await meltProofs(wallet, meltQuote, proofsToSend);

      setMints((prev) => {
        const updated = [...prev];
        const m = { ...updated[mintIndex] };
        m.proofs = [...keep, ...result.change];
        m.balance = getProofsBalance(m.proofs);
        m.txSuccess += 1;
        m.txTotal += 1;
        updated[mintIndex] = m;
        return updateMintTrustScores(updated);
      });

      setTransactions((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'send',
          amount: meltQuote.amount,
          mintUrl: mint.url,
          mintAlias: mint.alias,
          timestamp: Date.now(),
          status: 'complete',
        },
        ...prev,
      ]);
    },
    [mints, updateMintTrustScores]
  );

  return (
    <WalletContext.Provider
      value={{
        mints,
        transactions,
        totalBalance,
        currentScreen,
        setCurrentScreen,
        loading,
        error,
        clearError,
        showGraduation,
        setShowGraduation,
        graduationDismissed,
        setGraduationDismissed,
        initializeMints,
        receiveToMint,
        pollForPayment,
        sendFromMint,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
