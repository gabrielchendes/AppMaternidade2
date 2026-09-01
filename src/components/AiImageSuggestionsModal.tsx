import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ImageIcon,
  Palette,
  Camera,
  RefreshCw,
  Search,
  Wand2,
  Layers,
  Flame,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface ColorItem {
  name: string;
  hex: string;
}

interface ImageSuggestionData {
  conceptTitle: string;
  artDirectionSummary: string;
  recommendedColorPalette: ColorItem[];
  prompts: {
    midjourney: string;
    dalle3: string;
    flux: string;
  };
  stockSearchKeywords: string[];
  stockLinks: {
    unsplash: string;
    pexels: string;
  };
  suggestedPlaceholderUrls?: string[];
}

interface AiImageSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  contextType?: 'course_cover' | 'lesson_illustration' | 'sales_hero';
  onSelectImageUrl?: (url: string) => void;
}

export const AiImageSuggestionsModal: React.FC<AiImageSuggestionsModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
  contextType = 'course_cover',
  onSelectImageUrl
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [stylePreference, setStylePreference] = useState<'editorial_minimalist' | 'warm_cinematic' | 'hyper_realistic'>('editorial_minimalist');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ImageSuggestionData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTopic) {
      setTopic(initialTopic);
      if (!data) {
        handleGenerateSuggestions(initialTopic);
      }
    }
  }, [isOpen, initialTopic]);

  if (!isOpen) return null;

  const handleGenerateSuggestions = async (searchTopic?: string) => {
    const query = searchTopic || topic;
    if (!query.trim()) {
      toast.error('Informe o tema ou título para buscar sugestões visuais.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/suggest-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: query,
          contextType,
          stylePreference
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao gerar sugestões visuais');
      }

      setData(json.data);
      toast.success('Sugestões visuais geradas com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na IA: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#10121a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-cyan-950/60 via-zinc-900 to-zinc-900 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
              <Camera size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                Sugestão Visual & Prompts de IA <Sparkles size={16} className="text-amber-400" />
              </h2>
              <p className="text-xs text-gray-400">
                Direção de arte editorial, prompts fotorealistas (Midjourney/Flux/DALL-E) e buscas royalty-free.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Controls Bar */}
          <div className="p-4 bg-zinc-900/70 border border-white/10 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                  Tema ou Conceito Visual
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Ex: Maternidade gentil, rotina de sono do bebê, empoderamento familiar..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:border-cyan-400 outline-none transition-all"
                    onKeyDown={e => e.key === 'Enter' && handleGenerateSuggestions()}
                  />
                  <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                  Estilo Visual
                </label>
                <select
                  value={stylePreference}
                  onChange={e => setStylePreference(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 outline-none"
                >
                  <option value="editorial_minimalist">Editorial Minimalista (Clean)</option>
                  <option value="warm_cinematic">Cinematográfico Quente</option>
                  <option value="hyper_realistic">Fotorealismo 35mm Natural</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => handleGenerateSuggestions()}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {data ? 'Regenerar Sugestões com IA' : 'Gerar Sugestões Visuais com IA'}
              </button>
            </div>
          </div>

          {/* Results Display */}
          {loading && !data && (
            <div className="py-16 text-center space-y-3">
              <Loader2 size={36} className="animate-spin text-cyan-400 mx-auto" />
              <p className="text-sm font-black text-white uppercase tracking-wider">Criando Direção de Arte com IA...</p>
              <p className="text-xs text-gray-500">Desenvolvendo prompts para Midjourney, Flux e curando referências visuais.</p>
            </div>
          )}

          {data && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Concept Banner */}
              <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                    Conceito Artístico
                  </span>
                  <span className="text-[11px] text-gray-400 italic">Pronto para uso profissional</span>
                </div>
                <h3 className="text-base font-black text-white">{data.conceptTitle}</h3>
                <p className="text-xs text-gray-300 leading-relaxed">{data.artDirectionSummary}</p>
              </div>

              {/* Color Palette */}
              {data.recommendedColorPalette?.length > 0 && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette size={16} className="text-amber-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Paleta de Cores Harmônica</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {data.recommendedColorPalette.map((col, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopy(col.hex, `color_${idx}`)}
                        className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center gap-3 cursor-pointer hover:border-white/20 transition-all group"
                      >
                        <div
                          className="w-7 h-7 rounded-lg border border-white/20 shrink-0 shadow-inner"
                          style={{ backgroundColor: col.hex }}
                        />
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold text-white truncate">{col.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1 group-hover:text-amber-300">
                            {col.hex} {copiedKey === `color_${idx}` ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Prompts Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-400" /> Prompts Otimizados para Geradores de Imagem
                </h4>

                {/* Midjourney v6 */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                      Midjourney v6.0
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.prompts.midjourney, 'mj')}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedKey === 'mj' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedKey === 'mj' ? 'Copiado!' : 'Copiar Prompt'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 font-mono bg-black/60 p-3 rounded-xl border border-white/5 leading-relaxed selection:bg-indigo-500/40">
                    {data.prompts.midjourney}
                  </p>
                </div>

                {/* DALL-E 3 */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                      DALL-E 3
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.prompts.dalle3, 'dalle')}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedKey === 'dalle' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedKey === 'dalle' ? 'Copiado!' : 'Copiar Prompt'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 font-mono bg-black/60 p-3 rounded-xl border border-white/5 leading-relaxed selection:bg-emerald-500/40">
                    {data.prompts.dalle3}
                  </p>
                </div>

                {/* Flux 1.1 Pro */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                      Flux 1.1 Pro
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.prompts.flux, 'flux')}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedKey === 'flux' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedKey === 'flux' ? 'Copiado!' : 'Copiar Prompt'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 font-mono bg-black/60 p-3 rounded-xl border border-white/5 leading-relaxed selection:bg-purple-500/40">
                    {data.prompts.flux}
                  </p>
                </div>
              </div>

              {/* Free Stock Searches */}
              <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <ImageIcon size={14} className="text-cyan-400" /> Bancos de Imagens Gratuitos de Alta Resolução
                  </h4>
                  <span className="text-[10px] text-gray-400">100% Royalty Free</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {data.stockSearchKeywords?.map((kw, i) => (
                    <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 font-medium">
                      #{kw}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <a
                    href={data.stockLinks.unsplash}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-cyan-500/50 rounded-xl flex items-center justify-between text-xs text-white font-bold transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" /> Buscar no Unsplash
                    </span>
                    <ExternalLink size={14} className="text-gray-500 group-hover:text-cyan-300 transition-colors" />
                  </a>

                  <a
                    href={data.stockLinks.pexels}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-white font-bold transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Buscar no Pexels
                    </span>
                    <ExternalLink size={14} className="text-gray-500 group-hover:text-emerald-300 transition-colors" />
                  </a>
                </div>
              </div>

              {/* Sample high quality placeholders */}
              {data.suggestedPlaceholderUrls && data.suggestedPlaceholderUrls.length > 0 && onSelectImageUrl && (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">
                    Aplicar Exemplo Direto como Capa
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.suggestedPlaceholderUrls.map((url, uIdx) => (
                      <div key={uIdx} className="group relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                        <img src={url} alt="Reference sample" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectImageUrl(url);
                              toast.success('Imagem aplicada com sucesso!');
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check size={14} /> Usar esta Imagem
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/70 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-gray-500">
            Dica: Cole o prompt copiado no Midjourney (/imagine) ou no DALL-E para obter artes com acabamento premium.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
