import React, { useState } from 'react';
import { 
  Puzzle, 
  Eye, 
  EyeOff, 
  FileCode, 
  Sparkles, 
  Copy, 
  Check, 
  ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';
import HtmlAppViewer, { SAMPLE_HTML_APP } from './HtmlAppViewer';

interface AdminHtmlAppEditorProps {
  htmlContent: string;
  onChange: (value: string) => void;
  chapterTitle?: string;
  themeColor?: 'emerald' | 'blue';
}

export const AdminHtmlAppEditor: React.FC<AdminHtmlAppEditorProps> = ({
  htmlContent,
  onChange,
  chapterTitle = '',
  themeColor = 'emerald'
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleLoadSample = () => {
    onChange(SAMPLE_HTML_APP);
    setIsPreviewOpen(true);
    toast.success('Exemplo funcional de Mini App carregado!');
  };

  const handleCopyCode = () => {
    if (!htmlContent) return;
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    toast.success('Código copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  const isEmerald = themeColor === 'emerald';
  const focusBorderClass = isEmerald ? 'focus:border-emerald-500' : 'focus:border-blue-500';
  const activeBtnClass = isEmerald 
    ? 'bg-emerald-600 text-white shadow-emerald-900/40 hover:bg-emerald-500' 
    : 'bg-blue-600 text-white shadow-blue-900/40 hover:bg-blue-500';

  return (
    <div className="space-y-4 col-span-2 pt-2">
      {/* Informative Header Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-zinc-900 to-indigo-950/40 border border-purple-500/25 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 mt-0.5 sm:mt-0">
            <Puzzle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                🧩 Mini App HTML
              </h5>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <ShieldCheck size={10} />
                Sandbox Isolado
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed max-w-xl">
              Cole aqui o código HTML completo de uma mini aplicação criada externamente. Ela pode ser um jogo, quiz, calculadora, simulador, ferramenta interativa ou qualquer outra experiência web compatível com HTML, CSS e JavaScript.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            title="Carregar exemplo funcional de Mini App para testes"
          >
            <Sparkles size={13} className="text-amber-300" />
            <span>📋 Exemplo de HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreviewOpen(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg whitespace-nowrap active:scale-95 ${
              isPreviewOpen 
                ? activeBtnClass 
                : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Alternar pré-visualização da Mini App"
          >
            {isPreviewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isPreviewOpen ? 'Ocultar Prévia' : '👁️ Pré-visualizar'}</span>
          </button>
        </div>
      </div>

      {/* HTML Code Editor Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <FileCode size={12} className="text-purple-400" />
            Código HTML da Mini App
          </label>
          <div className="flex items-center gap-3">
            {htmlContent ? (
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
              </button>
            ) : null}
            <span className="text-[10px] text-gray-500 font-mono">
              {htmlContent?.length || 0} caracteres
            </span>
          </div>
        </div>

        <textarea
          value={htmlContent || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          placeholder={`<!DOCTYPE html>
<html>
<head>
  <style>
    /* seu CSS aqui */
  </style>
</head>
<body>
  <!-- seu HTML e scripts aqui -->
  <script>
    // sua lógica JavaScript aqui
  </script>
</body>
</html>`}
          className={`w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-gray-200 font-mono ${focusBorderClass} outline-none transition-all placeholder:text-gray-700 resize-y leading-relaxed`}
          spellCheck={false}
        />
      </div>

      {/* Pré-visualização da Mini App */}
      {isPreviewOpen && (
        <div className="space-y-3 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <h6 className="text-[11px] font-black text-purple-400 uppercase tracking-widest">
                PRÉ-VISUALIZAÇÃO DA MINI APP
              </h6>
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
              Execução isolada em sandbox (sem acesso ao DOM principal)
            </span>
          </div>

          <HtmlAppViewer
            htmlContent={htmlContent}
            title={chapterTitle || 'Pré-visualização da Mini App'}
          />
        </div>
      )}
    </div>
  );
};
