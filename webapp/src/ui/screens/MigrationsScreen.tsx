import { useState } from 'react';
import MigrationLog from '../components/MigrationLog';
import FedimintArchitecture from '../components/FedimintArchitecture';
import TrustSpectrum from '../components/TrustSpectrum';
import MathTheory from '../components/MathTheory';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function MigrationsScreen() {
  const [showMath, setShowMath] = useState(false);

  return (
    <div className="space-y-5">
      {/* Trust spectrum — portfolio-level context */}
      <TrustSpectrum />

      {/* Two-column: log + fedimint */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MigrationLog />
        <FedimintArchitecture />
      </div>

      {/* Collapsible math theory */}
      <div>
        <button
          onClick={() => setShowMath((v) => !v)}
          className="flex items-center gap-2 text-xs font-mono text-[#8b949e] hover:text-[#c9d1d9] transition-colors mb-3"
        >
          {showMath ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Mathematical Framework
        </button>
        {showMath && <MathTheory />}
      </div>
    </div>
  );
}
