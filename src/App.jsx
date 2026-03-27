import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Trash2, 
  TrendingUp, 
  Search, 
  Loader2, 
  Info,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// GoDaddy typically takes 25% for Buy It Now sales under $5,000
const GODADDY_FEE_PERCENT = 25;

const App = () => {
  const [data, setData] = useState([]);
  const [savedSelections, setSavedSelections] = useState(() => {
    const local = localStorage.getItem('domain-selections');
    return local ? JSON.parse(local) : {};
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [warmed, setWarmed] = useState(false);

  useEffect(() => {
    const warmupAndFetch = async () => {
      try {
        fetch('/api/domains?warm=true').then(() => setWarmed(true));
        const [domainsRes, selectionsRes] = await Promise.all([
          fetch('/domains.json'),
          fetch('/api/domains') 
        ]);
        const domains = await domainsRes.json();
        const selections = selectionsRes.ok ? await selectionsRes.json() : {};
        setData(domains);
        setSavedSelections(selections);
        localStorage.setItem('domain-selections', JSON.stringify(selections));
      } catch (err) {
        console.error("Connectivity issue", err);
      } finally {
        setLoading(false);
      }
    };
    warmupAndFetch();
  }, []);

  const handleToggle = async (domain, type, value) => {
    const current = savedSelections[domain] || { forSale: false, cancelAutoRenew: false };
    const updated = { ...current, [type]: value };
    const newPool = { ...savedSelections, [domain]: updated };
    setSavedSelections(newPool);
    localStorage.setItem('domain-selections', JSON.stringify(newPool));
    setSyncing(true);
    try {
      await fetch('/api/domains', {
        method: 'POST',
        body: JSON.stringify({ domain, forSale: updated.forSale, cancelAutoRenew: updated.cancelAutoRenew }),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error("Database sync failed", err);
    } finally {
      setTimeout(() => setSyncing(false), 300);
    }
  };

  const stats = useMemo(() => {
    let totalPayingPrice = 0;
    let totalSaleMarketVal = 0;
    let savedByCanceling = 0;
    data.forEach(item => {
      const domainName = item['Domain Name'];
      const selection = savedSelections[domainName] || { forSale: false, cancelAutoRenew: false };
      const price = parseFloat(item['Renewal Price']?.replace(/[^0-9.-]+/g, "")) || 0;
      const marketVal = parseFloat(item['Estimated Value']?.replace(/[^0-9.-]+/g, "")) || 0;
      totalPayingPrice += price;
      if (selection.forSale) totalSaleMarketVal += marketVal * (1 - GODADDY_FEE_PERCENT/100);
      if (selection.cancelAutoRenew) savedByCanceling += price;
    });
    return { totalPayingPrice, totalSaleMarketVal, savedByCanceling };
  }, [data, savedSelections]);

  const filteredData = useMemo(() => {
    return data.filter(d => d['Domain Name']?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4 border-none">
        <Loader2 className="animate-spin text-blue-500 h-10 w-10" />
        <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Initializing Control Node</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-12 space-y-8 min-h-screen">
      
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Venture Logic Hub</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium italic">Portfolio Audit & Liquidation Engine</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 group overflow-hidden">
            <Zap className={`h-4 w-4 ${warmed ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
            <span className="text-[9px] uppercase font-black text-slate-400">Node: {warmed ? 'Hot' : 'Cold Start'}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 overflow-hidden">
            <div className={`h-2 w-2 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[9px] uppercase font-black text-slate-400">Sync: {syncing ? 'Pending' : 'Stable'}</span>
          </div>
        </div>
      </header>

      {/* THREE MAIN PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-8 border-l-4 border-blue-500/50">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Paying (Annual)</p>
          <h2 className="text-4xl font-bold text-white tracking-tight">€{stats.totalPayingPrice.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-600 mt-2 font-bold uppercase tracking-tighter">Gross Operating Expense</p>
        </div>
        <div className="glass p-8 border-l-4 border-emerald-500/50 relative overflow-hidden group">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Money Earned (Est. Sale)</p>
          <h2 className="text-4xl font-bold text-emerald-400 tracking-tight">€{stats.totalSaleMarketVal.toLocaleString()}</h2>
          <div className="flex flex-col mt-2 gap-1 relative z-10">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter underline decoration-emerald-500/30">Wild Estimation (ML-Based)</p>
            <p className="text-[8px] text-slate-600 italic">Net of GoDaddy's {GODADDY_FEE_PERCENT}% Commission.</p>
          </div>
        </div>
        <div className="glass p-8 border-l-4 border-rose-500/50 bg-rose-500/[0.02]">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Guaranteed Savings (Canceled)</p>
          <h2 className="text-4xl font-bold text-rose-400 tracking-tight">€{stats.savedByCanceling.toLocaleString()}</h2>
          <p className="text-[9px] text-slate-600 mt-2 font-black italic uppercase tracking-tighter">Direct Bottom-Line Recovery</p>
        </div>
      </div>

      {/* GoDaddy Estimation Context */}
      <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl backdrop-blur-sm">
        <div className="flex gap-4">
          <div className="h-10 w-10 shrink-0 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400"><Info size={20} /></div>
          <div>
            <h4 className="text-sm font-bold text-blue-300 mb-1 leading-none uppercase tracking-widest text-[11px]">How valuation is calculated</h4>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              GoDaddy uses proprietary machine learning models to compare millions of historical domain sales across their network and the broader market. 
              The algorithm prioritizes keywords, domain length, TLD extension, and search volume to provide a representative market value, though it cannot account for specific branding intent.
            </p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass overflow-hidden shadow-2xl border-white/5 bg-[#0d0e14]">
        <div className="p-6 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/5">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/30 transition-all font-light"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">Domain Asset</th>
                <th className="px-6 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right whitespace-nowrap">Price (Pay) / yr</th>
                <th className="px-6 py-5 text-[10px] text-blue-500 font-bold uppercase tracking-widest text-right whitespace-nowrap">Est. Sale Value</th>
                <th className="px-6 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center whitespace-nowrap px-2">Sell</th>
                <th className="px-6 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center whitespace-nowrap px-2">Cancel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredData.map((item) => {
                const domain = item['Domain Name'];
                const selection = savedSelections[domain] || { forSale: false, cancelAutoRenew: false };
                return (
                  <tr key={domain} className="hover:bg-blue-600/[0.02] transition-colors border-none">
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-slate-200 block whitespace-normal break-words min-w-[200px]">{domain}</span>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white leading-none whitespace-nowrap">{item['Renewal Price']}</span>
                        <span className="text-[8px] text-slate-600 font-black tracking-widest mt-1">PER YEAR</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-blue-400 italic leading-none">{item['Estimated Value']}</span>
                          <span className="text-[8px] text-slate-600 font-black mt-1">WILD GUESS</span>
                       </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <input 
                        type="checkbox" 
                        checked={selection.forSale}
                        onChange={(e) => handleToggle(domain, 'forSale', e.target.checked)}
                        className="w-5 h-5 accent-blue-600 cursor-pointer shadow-xl"
                      />
                    </td>
                    <td className="px-6 py-6 text-center">
                      <input 
                        type="checkbox" 
                        checked={selection.cancelAutoRenew}
                        onChange={(e) => handleToggle(domain, 'cancelAutoRenew', e.target.checked)}
                        className="w-5 h-5 accent-rose-600 cursor-pointer shadow-xl"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="py-24 text-center text-slate-600 italic font-light">No records found.</div>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default App;
