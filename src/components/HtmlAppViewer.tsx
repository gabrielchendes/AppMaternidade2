import React, { useState, useRef, useEffect, useId } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface HtmlAppViewerProps {
  htmlContent?: string | null;
  title?: string;
  className?: string;
  minHeight?: number | string;
  onComplete?: () => void;
}

export const SAMPLE_HTML_APP = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Calculadora Interativa</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background: #090d16;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: #131b2e;
      border: 1px solid #1e293b;
      border-radius: 28px;
      padding: 28px 24px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 16px;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    h2 {
      font-size: 22px;
      font-weight: 900;
      margin-bottom: 6px;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .display {
      background: #070a10;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 24px 16px;
      margin-bottom: 20px;
    }
    .count {
      font-size: 54px;
      font-weight: 900;
      color: #10b981;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      transition: transform 0.15s ease;
    }
    .buttons {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    button {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 16px 8px;
      font-size: 20px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.15s ease;
      touch-action: manipulation;
    }
    button:hover {
      background: #334155;
      transform: translateY(-2px);
    }
    button:active {
      transform: scale(0.96);
    }
    button.primary {
      background: #10b981;
      color: #022c22;
      font-weight: 900;
      border: none;
      box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4);
    }
    button.primary:hover {
      background: #34d399;
    }
    button.danger {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    button.danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }
    .footer {
      font-size: 11px;
      color: #64748b;
      margin-top: 14px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Ferramenta Interativa</span>
    <h2>Contador Interativo</h2>
    <p>Exemplo com controles internos integrados na aula.</p>
    <div class="display">
      <div id="counter" class="count">0</div>
    </div>
    <div class="buttons">
      <button onclick="update(-1)">-1</button>
      <button class="danger" onclick="reset()">Zerar</button>
      <button class="primary" onclick="update(1)">+1</button>
    </div>
    <div class="footer">Toque ou clique nos botões para interagir com o estado do script.</div>
  </div>
  <script>
    let val = 0;
    const el = document.getElementById('counter');
    function update(delta) {
      val += delta;
      el.innerText = val;
      el.style.transform = 'scale(1.1)';
      setTimeout(() => { el.style.transform = 'scale(1)'; }, 150);
    }
    function reset() {
      val = 0;
      el.innerText = 0;
    }
  </script>
</body>
</html>`;

/**
 * Injeta runtime de comunicação de altura segura e estilos de integração nativa
 * no HTML do Mini App antes de renderizar no srcDoc do iframe.
 */
function prepareNativeHtml(rawHtml: string, frameId: string): string {
  const injection = `
<style id="pwa-mini-app-runtime-style">
  /* Garante integração nativa e impede expansão descontrolada contra o viewport do iframe */
  html {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  *, *:before, *:after {
    box-sizing: border-box;
  }
  #pwa-mini-app-root {
    display: flow-root !important;
    width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  img, video, canvas {
    max-width: 100%;
  }
</style>
<script id="pwa-mini-app-height-bridge">
(function() {
  var FRAME_ID = "${frameId}";
  var lastSentHeight = 0;
  var lastWidth = window.innerWidth;
  var timer = null;

  function measureHeight() {
    var root = document.getElementById('pwa-mini-app-root') || document.body;
    if (!root) return 0;

    var rootRect = root.getBoundingClientRect();
    var offsetH = root.offsetHeight || 0;
    var rectH = rootRect.height || 0;

    var maxBottom = 0;
    var children = root.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.id === 'pwa-mini-app-runtime-style' || child.id === 'pwa-mini-app-height-bridge') continue;
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') continue;

      var style = window.getComputedStyle(child);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      var r = child.getBoundingClientRect();
      var mb = parseFloat(style.marginBottom) || 0;
      var bottom = (r.bottom - rootRect.top) + mb;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
    }

    // Calcula a altura real do conteúdo sem acréscimo artificial para prevenir loop infinito
    var calculated = Math.max(offsetH, rectH, maxBottom);
    return Math.ceil(calculated);
  }

  function notifyParent(force) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      var h = measureHeight();
      if (h > 0 && (force || Math.abs(h - lastSentHeight) >= 2)) {
        lastSentHeight = h;
        window.parent.postMessage({
          type: 'mini-app-height',
          frameId: FRAME_ID,
          height: h
        }, '*');
      }
    }, 25);
  }

  // Notificação inicial assim que o documento estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { notifyParent(true); });
  } else {
    notifyParent(true);
  }
  window.addEventListener('load', function() { notifyParent(true); });

  // Apenas monitora resize caso a LARGURA mude (ex: rotação de tela em celular ou redimensionamento de janela)
  // Nunca reage ao resize de altura do próprio iframe para evitar loop de feedback
  window.addEventListener('resize', function() {
    var currentWidth = window.innerWidth;
    if (Math.abs(currentWidth - lastWidth) > 4) {
      lastWidth = currentWidth;
      notifyParent(true);
    }
  });

  // ResizeObserver no root (apenas reage se o conteúdo interno mudar)
  if (window.ResizeObserver) {
    try {
      var rootEl = document.getElementById('pwa-mini-app-root') || document.body;
      if (rootEl) {
        var ro = new ResizeObserver(function() {
          notifyParent(false);
        });
        ro.observe(rootEl);
      }
    } catch (e) {}
  }

  // MutationObserver para nós dinâmicos
  if (window.MutationObserver) {
    try {
      var targetEl = document.getElementById('pwa-mini-app-root') || document.body;
      if (targetEl) {
        var mo = new MutationObserver(function() {
          notifyParent(false);
        });
        mo.observe(targetEl, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }
    } catch (e) {}
  }

  // Ações do usuário (toque, clique, digitação)
  var events = ['click', 'touchend', 'input', 'change'];
  for (var k = 0; k < events.length; k++) {
    document.addEventListener(events[k], function() {
      notifyParent(false);
      setTimeout(function() { notifyParent(false); }, 150);
    }, { passive: true });
  }
})();
</script>
`;

  let processed = rawHtml;

  // Garante meta viewport se for documento HTML mas não tiver viewport
  if (/<head>/i.test(processed) && !/viewport/i.test(processed)) {
    processed = processed.replace(
      /<head>/i,
      '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
    );
  }

  // Envolve o conteúdo do <body> em um wrapper BFC isolado para medição desacoplada da altura da janela
  if (/<body[^>]*>/i.test(processed) && /<\/body>/i.test(processed)) {
    processed = processed.replace(/<body([^>]*)>([\s\S]*?)<\/body>/i, (_match, bodyAttrs, bodyContent) => {
      return `<body${bodyAttrs}><div id="pwa-mini-app-root">${bodyContent}</div>${injection}</body>`;
    });
  } else if (/<\/html>/i.test(processed)) {
    processed = processed.replace(/([\s\S]*?)<\/html>/i, (_match, beforeHtml) => {
      return `<div id="pwa-mini-app-root">${beforeHtml}</div>${injection}</html>`;
    });
  } else {
    processed = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</head>
<body>
  <div id="pwa-mini-app-root">
    ${processed}
  </div>
  ${injection}
</body>
</html>`;
  }

  return processed;
}

export default function HtmlAppViewer({
  htmlContent,
  title,
  className = '',
  minHeight = 0
}: HtmlAppViewerProps) {
  const reactId = useId();
  const frameIdRef = useRef<string>(`mini-app-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`);
  const numericMinHeight = typeof minHeight === 'number' ? minHeight : parseInt(String(minHeight), 10) || 0;

  const [height, setHeight] = useState<number>(numericMinHeight > 0 ? numericMinHeight : 200);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Proteção rígida contra loops de expansão
  const loopGuardRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });

  const trimmedHtml = (htmlContent || '').trim();

  // Reset de estado quando o conteúdo HTML mudar
  useEffect(() => {
    setHasLoadError(false);
    setIsLoaded(false);
    loopGuardRef.current = { count: 0, lastTime: 0 };
  }, [trimmedHtml, reloadKey]);

  // Escuta postMessage exclusivamente para o ajuste dinâmico da altura
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validação do formato da mensagem e do frameId correspondente
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'mini-app-height' &&
        event.data.frameId === frameIdRef.current
      ) {
        const reportedHeight = typeof event.data.height === 'number'
          ? event.data.height
          : parseInt(event.data.height, 10);
        
        if (!isNaN(reportedHeight) && reportedHeight > 0) {
          const now = Date.now();
          if (now - loopGuardRef.current.lastTime < 1500) {
            loopGuardRef.current.count += 1;
            if (loopGuardRef.current.count > 10) {
              // Interrompe atualizações excessivas caso haja qualquer oscilação
              return;
            }
          } else {
            loopGuardRef.current.count = 1;
            loopGuardRef.current.lastTime = now;
          }

          // Limite de segurança saudável (entre 60px e 3200px) impedindo expansão descontrolada
          const safeHeight = Math.max(60, Math.min(reportedHeight, 3200));
          setHeight(prev => (Math.abs(prev - safeHeight) >= 2 ? safeHeight : prev));
          setIsLoaded(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Se não houver código HTML configurado, mensagem discreta integrada
  if (!trimmedHtml) {
    return (
      <div className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center ${className}`}>
        <p className="text-sm text-gray-500 font-medium">
          Esta experiência interativa ainda não possui conteúdo configurado.
        </p>
      </div>
    );
  }

  // Se houver erro de carregamento, estado discreto e amigável
  if (hasLoadError) {
    return (
      <div className={`w-full py-12 px-6 flex flex-col items-center justify-center text-center ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 mb-3">
          <AlertCircle size={22} className="text-amber-400/80" />
        </div>
        <p className="text-sm font-medium text-gray-300 mb-1">
          Não foi possível carregar esta experiência interativa.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Tente novamente para reiniciar o carregamento.
        </p>
        <button
          type="button"
          onClick={() => {
            setHasLoadError(false);
            setReloadKey(prev => prev + 1);
          }}
          className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <RotateCcw size={13} />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  const preparedHtml = prepareNativeHtml(trimmedHtml, frameIdRef.current);

  return (
    <div className={`w-full relative ${className}`}>
      {/* Indicador discreto sem forçar medidas verticais desnecessárias */}
      {!isLoaded && (
        <div className="w-full py-10 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-ping" />
        </div>
      )}

      {/* 
        Iframe nativo perfeitamente integrado:
        - Largura 100% fluida
        - Altura exata sincronizada com o conteúdo real
        - Sem scroll interno e sem loop de crescimento
      */}
      <iframe
        key={reloadKey}
        srcDoc={preparedHtml}
        title={title || "Experiência Interativa"}
        sandbox="allow-scripts allow-forms"
        scrolling="no"
        className={`w-full border-0 block bg-transparent transition-opacity duration-250 ${
          isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'
        }`}
        style={{
          height: isLoaded ? `${height}px` : '1px',
          width: '100%',
          overflow: 'hidden',
          display: 'block'
        }}
        onLoad={() => {
          setTimeout(() => setIsLoaded(true), 150);
        }}
        onError={() => setHasLoadError(true)}
      />
    </div>
  );
}

