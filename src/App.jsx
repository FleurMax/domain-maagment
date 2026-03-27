import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Trash2, 
  TrendingUp, 
  Search, 
  Loader2, 
  Database,
  Info,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// GoDaddy typically takes 25% for Buy It Now sales under $5,000
const GODADDY_FEE_PERCENT = 25;

const App = () => {
  const [data, setData] = useState(() => {
    // Initial load from localStorage for speed
    const local = localStorage.getItem('domain-data');
    return local ? JSON.parse(local) : [];
  });
  const [savedSelections, setSavedSelections] = useState(() => {
    // Initial load from localStorage for speed
    const local = localStorage.getItem('domain-selections');
    return local ? JSON.parse(local) : {};
  });
  
  // Only show loader if we have NO data at all
  const [loading, setLoading] = useState(data.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [warmed, setWarmed] = useState(false);

  // Load Data and Warm-up Backend
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch static domain list and cache it
      try {
        const domainsRes = await fetch('/domains.json');
        if (domainsRes.ok) {
          const domains = await domainsRes.json();
          setData(domains);
          localStorage.setItem('domain-data', JSON.stringify(domains));
          setLoading(false); 
        }
      } catch (err) {
        console.warn("Using offline domain data", err);
      }

      // 2. Background: Warm up Netlify function and Fetch DB Selections
      try {
        fetch('/api/domains?warm=true').then(() => setWarmed(true));

        const selectionsRes = await fetch('/api/domains');
        if (selectionsRes.ok) {
          const selections = await selectionsRes.json();
          setSavedSelections(selections);
          localStorage.setItem('domain-selections', JSON.stringify(selections));
        }
      } catch (err) {
        console.warn("Could not sync with cloud, using local selections", err);
      }
    };
    fetchData();
  }, []);

  // Sync selection to MongoDB and LocalStorage
  const handleToggle = async (domain, value) => {
    const current = savedSelections[domain] || { forSale: false };
    const updated = { ...current, forSale: value };
    
    // Optimistic local update
    const newPool = { ...savedSelections, [domain]: updated };
    setSavedSelections(newPool);
    localStorage.setItem('domain-selections', JSON.stringify(newPool));

    // Database Sync
    setSyncing(true);
    try {
      await fetch('/api/domains', {
        method: 'POST',
        body: JSON.stringify({
          domain,
          forSale: updated.forSale
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error("Database sync failed", err);
    } finally {
      setTimeout(() => setSyncing(false), 300);
    }
  };

  // Utility to format money nicely
  const formatEuro = (val) => {
    return new Intl.NumberFormat('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 
    }).format(val);
  };

  // Clean raw price strings from CSV/JSON (handles broken â‚¬ encodings)
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    // Remove everything except numbers, dots and commas
    const cleaned = priceStr.replace(/[^0-9,.]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Calculations
  const stats = useMemo(() => {
    let totalPayingPrice = 0;
    let totalSaleMarketVal = 0;

    data.forEach(item => {
      const domainName = item['Domain Name'];
      const selection = savedSelections[domainName] || { forSale: false };
      
      const price = parsePrice(item['Renewal Price']);
      const marketVal = parsePrice(item['Estimated Value']);

      totalPayingPrice += price;

      if (selection.forSale) {
        totalSaleMarketVal += marketVal * (1 - GODADDY_FEE_PERCENT/100);
      }
    });

    return { totalPayingPrice, totalSaleMarketVal };
  }, [data, savedSelections]);

  const filteredData = useMemo(() => {
    return data.filter(d => 
      d['Domain Name']?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-blue-500 h-10 w-10" />
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em]">Preparing Portfolio</span>
          <span className="text-[9px] text-slate-600 font-bold italic">Checking 160 inventory assets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-12 space-y-8 min-h-screen">
      
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <div className="z-10">
          <h1 className="text-3xl font-black text-white tracking-tight">Domain Liquidation</h1>
          <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-80">Portfolio Strategizer • 160 Assets</p>
        </div>
        <div className="flex flex-wrap gap-3 z-10">
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Zap className={`h-3 w-3 ${warmed ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
            <span className="text-[9px] uppercase font-black text-slate-400">Cloud: {warmed ? 'Ready' : 'Cold'}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <div className={`h-2 w-2 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`}></div>
            <span className="text-[9px] uppercase font-black text-slate-400">Database: {syncing ? 'Syncing' : 'Live'}</span>
          </div>
        </div>
      </header>

      {/* MAIN PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. TOTAL PAYING PRICE */}
        <div className="glass p-8 border-l-4 border-blue-500/50">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Portfolio Cost</p>
            <DollarSign className="text-blue-500/30" size={20} />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            {formatEuro(stats.totalPayingPrice)}
          </h2>
          <p className="text-[9px] text-slate-600 mt-2 font-bold italic uppercase tracking-wider">Annual Renewal Total</p>
        </div>

        {/* 2. MONEY EARNED ON SALE */}
        <div className="glass p-8 border-l-4 border-emerald-500/50 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Potential Recovery</p>
            <TrendingUp className="text-emerald-500/30" size={20} />
          </div>
          <h2 className="text-3xl font-bold text-emerald-400 tracking-tight">
            {formatEuro(stats.totalSaleMarketVal)}
          </h2>
          <div className="flex flex-col mt-2 gap-1">
            <p className="text-[9px] text-slate-500 font-bold tracking-tight uppercase">Net Estimate (After Fees)</p>
          </div>
        </div>
      </div>

      {/* GODADDY VALUATION EXPLANATION */}
      <div className="glass p-6 border border-blue-500/20 bg-blue-500/[0.02]">
        <div className="flex items-start gap-4">
          <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-wider text-[11px]">How GoDaddy calculates estimated selling price:</p>
            <p className="text-sm text-slate-400 leading-relaxed font-light">
              GoDaddy uses a machine learning algorithm that analyzes millions of historical domain sales to determine value. 
              The estimate considers keyword popularity, extensions, and comparable sales, though it remains a wild estimation and not an accurate guarantee.
            </p>
          </div>
        </div>
      </div>

      {/* Main Action Center */}
      <div className="glass overflow-hidden shadow-2xl border-white/5">
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
          <div className="flex flex-col md:flex-row items-center gap-6">
             <div className="flex flex-col gap-1 text-[11px] font-medium text-slate-400">
                <div className="flex items-center gap-2 uppercase font-black tracking-wide">
                  <ShieldCheck size={14} className="text-blue-500" />
                  Inventory Protection
                </div>
                <p className="leading-relaxed opacity-80">
                  Select assets to put for sale or cancel auto-renewal. Every choice is synced to the database.
                </p>
             </div>
             <div className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-wide whitespace-nowrap">
                <Info size={16} className="text-blue-500" />
                {GODADDY_FEE_PERCENT}% Fee
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#0d0e14] z-10">
              <tr>
                <th className="px-6 md:px-8 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Asset Details</th>
                <th className="px-4 md:px-6 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-right">Cost (Yearly)</th>
                <th className="px-3 md:px-6 py-5 text-[10px] text-blue-400 font-bold uppercase tracking-widest text-right">Est. Sale Price</th>
                <th className="px-4 md:px-6 py-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">List for Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <AnimatePresence>
                {filteredData.map((item) => {
                  const domain = item['Domain Name'];
                  const selection = savedSelections[domain] || { forSale: false, cancelAutoRenew: false };
                  
                  return (
                    <motion.tr 
                      layout
                      key={domain}
                      onClick={() => handleToggle(domain, !selection.forSale)}
                      className="hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors cursor-pointer group"
                    >
                      <td className="px-6 md:px-8 py-5 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors break-all whitespace-normal">{domain}</span>
                          <span className="text-[9px] text-slate-500 font-medium">Expires: {item['Expiration Date']}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-5 text-right font-bold text-white text-[11px] md:text-sm whitespace-nowrap">
                        {formatEuro(parsePrice(item['Renewal Price']))} <span className="text-[10px] text-slate-500 font-normal">/ yr</span>
                      </td>
                      <td className="px-3 md:px-6 py-5 text-right">
                         <div className="flex flex-col">
                            <span className="text-[11px] md:text-sm font-bold text-blue-400 italic">~{formatEuro(parsePrice(item['Estimated Value']))}</span>
                         </div>
                      </td>
                      <td className="px-4 md:px-6 py-5 text-center">
                        <input 
                          type="checkbox" 
                          checked={selection.forSale}
                          readOnly // Controlled by row click
                          className="w-5 h-5 rounded-md accent-blue-600 cursor-pointer transition-transform group-hover:scale-110"
                        />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      
      <footer className="py-12 flex flex-col items-center gap-4 opacity-30">
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Proprietary Data Systems &bull; 2026</p>
      </footer>

    </div>
  );
};

export default App;
