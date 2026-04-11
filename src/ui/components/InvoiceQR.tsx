import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface Props {
  invoice: string;
  status: 'waiting' | 'paid' | 'timeout';
}

export function InvoiceQR({ invoice, status }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(invoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 animate-fade-up">
      {/* QR Container with glow */}
      <div className="relative">
        <div className="absolute inset-0 bg-white/10 rounded-3xl blur-xl" />
        <div className="relative bg-white p-5 rounded-2xl shadow-2xl">
          <QRCodeSVG value={invoice} size={200} />
        </div>
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="glass glass-hover rounded-xl px-4 py-2.5 max-w-[300px] flex items-center gap-2 transition-all duration-200"
      >
        {copied ? (
          <span className="text-emerald-400 text-xs font-medium">Copied!</span>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/30 shrink-0">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-[11px] text-white/40 font-mono truncate">
              {invoice.slice(0, 36)}...
            </span>
          </>
        )}
      </button>

      {/* Status */}
      {status === 'waiting' && (
        <div className="flex items-center gap-2.5 text-yellow-400">
          <div className="w-2 h-2 rounded-full bg-yellow-400 status-dot status-dot-yellow" />
          <span className="text-[13px] font-medium">Waiting for payment...</span>
        </div>
      )}
      {status === 'paid' && (
        <div className="flex items-center gap-2.5 text-emerald-400 animate-fade-up">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[13px] font-semibold">Payment received!</span>
        </div>
      )}
      {status === 'timeout' && (
        <div className="text-red-400 text-[13px] font-medium">
          Payment timed out
        </div>
      )}
    </div>
  );
}
