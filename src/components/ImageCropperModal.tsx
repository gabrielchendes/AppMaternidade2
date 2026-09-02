import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  Maximize2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const getCorsSafeUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) return url;
  // If the image is a remote URL, route it through images.weserv.nl proxy to bypass CORS!
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('images.weserv.nl')) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
  aspectRatio?: number; // width / height
  title?: string;
  initialImageSrc?: string;
  allowUpload?: boolean;
}

export default function ImageCropperModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  aspectRatio = 3/4,
  title = "Ajustar Capa do Curso",
  initialImageSrc = "",
  allowUpload = true
}: ImageCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setImageSrc(getCorsSafeUrl(initialImageSrc) || null);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialImageSrc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!imageSrc) return;
    setIsDragging(true);
    dragStart.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging || !imageSrc) return;
    setPosition({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    const zoomStep = 0.05;
    const newZoom = e.deltaY < 0 ? Math.min(zoom + zoomStep, 3) : Math.max(zoom - zoomStep, 1);
    setZoom(newZoom);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPosition({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!imageSrc || !imageRef.current) return;
    setLoading(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getCorsSafeUrl(imageSrc) || imageSrc;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => {
          console.error("Erro ao carregar a imagem na renderização do canvas:", e);
          reject(new Error("Não foi possível processar a imagem externa. Certifique-se de que a URL é uma imagem pública válida."));
        };
      });

      // Target canvas dimensions
      const targetWidth = 600;
      const targetHeight = Math.round(targetWidth / aspectRatio);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Não foi possível inicializar o canvas 2D');
      }

      // Draw background (black)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Viewport dimensions in cropper UI
      const viewWidth = containerRef.current?.clientWidth || 300;
      const viewHeight = containerRef.current?.clientHeight || 400;

      // Base scaling inside cropper viewport (object-fit: cover equivalent)
      const hRatio = viewWidth / img.naturalWidth;
      const vRatio = viewHeight / img.naturalHeight;
      const baseScale = Math.max(hRatio, vRatio);

      // Scale multiplier from viewport to high-res canvas
      const scaleMultiplier = targetWidth / viewWidth;

      // Translate context to center of canvas for rotation support
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Render the image with offset, zoom and scale
      const drawWidth = img.naturalWidth * baseScale * zoom * scaleMultiplier;
      const drawHeight = img.naturalHeight * baseScale * zoom * scaleMultiplier;
      
      // Calculate draw coordinates with respect to the centered context
      // Note: position is added as relative offset
      const drawX = (position.x * scaleMultiplier) - (drawWidth / 2);
      const drawY = (position.y * scaleMultiplier) - (drawHeight / 2);

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

      // Convert canvas to Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      });

      if (!blob) {
        throw new Error('Falha ao gerar o arquivo final da imagem');
      }

      // Upload to Supabase Storage or fallback to base64 Data URL
      let finalUrl = '';
      const fileName = `course-covers/cover-${Date.now()}.jpg`;

      try {
        // Try community_images bucket first, then try avatars, or fallback
        const buckets = ['community_images', 'avatars'];
        let uploadSuccess = false;

        for (const bucket of buckets) {
          try {
            const { data, error } = await supabase.storage
              .from(bucket)
              .upload(fileName, blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true
              });

            if (!error && data) {
              const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);
              
              finalUrl = publicUrl;
              uploadSuccess = true;
              break;
            }
          } catch (e) {
            console.warn(`Tentativa de upload no bucket "${bucket}" falhou:`, e);
          }
        }

        if (!uploadSuccess) {
          // If storage fails, convert to base64 Data URL directly!
          // This is incredibly robust as it saves to the DB text column without needing Storage permissions!
          finalUrl = canvas.toDataURL('image/jpeg', 0.85);
          console.log("Upload de armazenamento falhou ou não permitido. Usando Base64 como fallback.");
        }
      } catch (uploadErr) {
        console.error("Erro completo no upload, usando Base64:", uploadErr);
        finalUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      onConfirm(finalUrl);
      toast.success('Imagem ajustada e aplicada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao processar imagem: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-[#0e0e12] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
                  <p className="text-[10px] text-gray-500 font-medium">Arraste para mover e use a barra para dar zoom</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-8 flex flex-col items-center gap-6">
              {!imageSrc ? (
                // Upload Placeholder or paste notice
                !allowUpload ? (
                  <div className="w-full aspect-[3/4] max-h-[360px] max-w-[270px] rounded-3xl border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 shadow-inner">
                      <ImageIcon size={28} />
                    </div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Nenhuma imagem carregada</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Por favor, insira ou cole a URL da imagem no formulário do curso antes de abrir esta janela para recortar/ajustar.
                    </p>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[3/4] max-h-[360px] max-w-[270px] rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center cursor-pointer group text-center p-6"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white/5 group-hover:bg-blue-500/10 group-hover:text-blue-500 flex items-center justify-center text-gray-400 transition-colors mb-4 shadow-inner">
                      <Upload size={28} />
                    </div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Selecionar Imagem</h4>
                    <p className="text-[10px] text-gray-500">PNG, JPG ou JPEG até 10MB</p>
                  </div>
                )
              ) : (
                // Cropper Interface
                <div className="w-full flex flex-col items-center gap-6">
                  {/* Viewport Container */}
                  <div 
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                    onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    style={{ 
                      aspectRatio: aspectRatio, 
                      width: aspectRatio > 1 ? '360px' : '270px',
                      maxWidth: '100%'
                    }}
                    className="rounded-3xl border border-white/10 overflow-hidden relative bg-black cursor-move select-none shadow-2xl group"
                  >
                    {imageSrc && imageSrc.trim() ? (
                      <img
                        ref={imageRef}
                        src={imageSrc.trim()}
                        alt="Preview"
                        draggable="false"
                        style={{
                          position: 'absolute',
                          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                          transformOrigin: 'center center',
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          maxWidth: 'none',
                          // Calculate base sizing equivalent to cover
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
                        <Upload size={32} className="opacity-30 mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Nenhuma imagem carregada</span>
                      </div>
                    )}

                    {/* Viewport Overlay bounds guide */}
                    <div className="absolute inset-0 border-[3px] border-blue-500/30 rounded-3xl pointer-events-none group-hover:border-blue-500/60 transition-colors" />
                    
                    {/* Corner accents */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white pointer-events-none" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white pointer-events-none" />
                  </div>

                  {/* Controls Row */}
                  <div className="w-full space-y-4 px-4">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setZoom(Math.max(zoom - 0.1, 1))}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                        title="Diminuir Zoom"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <input 
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                      />
                      <button 
                        onClick={() => setZoom(Math.min(zoom + 0.1, 3))}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                        title="Aumentar Zoom"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>

                    {/* Action buttons under slider */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      {allowUpload ? (
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                          <RefreshCw size={12} /> Trocar Imagem
                        </button>
                      ) : (
                        <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-2.5 rounded-xl border border-white/10 select-none">
                          Ajuste da Imagem da URL
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleRotate}
                          className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                          title="Girar 90°"
                        >
                          <RotateCw size={14} />
                        </button>
                        <button 
                          onClick={handleReset}
                          className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                          title="Redefinir Ajustes"
                        >
                          Resetar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/5 bg-[#0b0b0e] flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={!imageSrc || loading}
                className={`px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg ${
                  imageSrc && !loading 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Processando...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Salvar Capa
                  </>
                )}
              </button>
            </div>
          </motion.div>
          {allowUpload && (
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
