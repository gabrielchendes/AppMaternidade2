import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Product } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import Profile from '../components/Profile';
import Community from '../components/Community';
import AdminPanel from '../components/AdminPanel';
import { toast } from 'sonner';
import { X, ShoppingBag, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const { settings } = useSettings();
  console.log('Supabase client initialized:', !!supabase);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]); // Array of product IDs
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buying, setBuying] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>('home');

  useEffect(() => {
    console.log('Dashboard mounted for user:', user.id);
    
    fetchData();
    
    // Setup push notifications
    const setupPush = async () => {
      const granted = await requestNotificationPermission(user.id);
      if (granted) {
        onForegroundMessage();
      }
    };
    setupPush();
    
    // Check for success or canceled parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      toast.success('Compra realizada com sucesso! O acesso está sendo liberado...');
      
      // Create internal notification
      createNotification(user.id, 'Compra Aprovada! 🚀', 'O seu acesso ao curso foi liberado com sucesso. Aproveite o conteúdo!');
      
      // Retry fetching data after a short delay to allow webhook to process
      const timer = setTimeout(() => {
        fetchData();
        toast.success('Acesso liberado! Aproveite o conteúdo.');
      }, 3000);

      // Remove params from URL without refreshing
      window.history.replaceState({}, '', window.location.pathname);
      return () => clearTimeout(timer);
    } else if (params.get('canceled')) {
      toast.error('A compra foi cancelada.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user.id]);

  const fetchData = async () => {
    try {
      const [productsRes, purchasesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('purchases').select('product_id').eq('user_id', user.id)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (purchasesRes.error) throw purchasesRes.error;

      console.log('Fetched products:', productsRes.data?.length);
      console.log('Fetched purchases for user:', user.id, purchasesRes.data);

      setProducts(productsRes.data || []);
      setPurchases(purchasesRes.data?.map(p => p.product_id) || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar conteúdos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleSimulatePurchase = async () => {
    if (!selectedProduct) return;
    setBuying(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Não foi possível gerar o link de pagamento. Verifique se as chaves da Stripe estão configuradas corretamente no menu Secrets.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar compra');
    } finally {
      setBuying(false);
    }
  };

  const handleViewPdf = () => {
    if (!selectedProduct?.pdf_url) {
      toast.error('PDF não disponível');
      return;
    }
    // Abrir na mesma aba é o que o usuário solicitou
    window.location.href = selectedProduct.pdf_url;
  };

  const isUnlocked = (product: Product) => {
    return product.is_free || product.is_bonus || purchases.includes(product.id);
  };

  if (loading) {
    return (
      <div className="pt-32 px-12 space-y-12">
        {[1, 2].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="w-64 aspect-[16/9] bg-white/5 rounded-md animate-pulse shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Navbar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'home' ? (
        <>
          {/* Hero Section */}
          <div className="relative h-[70vh] w-full overflow-hidden mb-[-100px]">
            <img
              src="https://picsum.photos/seed/maternity-hero/1920/1080"
              className="w-full h-full object-cover opacity-60"
              alt="Hero"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-transparent" />
            
            <div className="absolute bottom-40 left-0 right-0 md:left-12 md:right-auto px-6 md:px-0 flex flex-col items-center md:items-start text-center md:text-left space-y-6">
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight leading-none">
                JORNADA DA <br /> <span className="text-primary">MATERNIDADE</span>
              </h1>
              <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-md md:max-w-2xl">
                O guia definitivo para mães de primeira viagem. Aprenda tudo sobre os primeiros meses, 
                cuidados essenciais e bem-estar emocional.
              </p>
              <div className="flex items-center gap-4 pt-4">
              </div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="relative z-10 space-y-4">
            <Carousel title="Meus Cursos 📚">
              {products.filter(p => isUnlocked(p) && !p.is_bonus).length > 0 ? (
                products.filter(p => isUnlocked(p) && !p.is_bonus).map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isUnlocked={true}
                    onOpen={handleOpenProduct}
                  />
                ))
              ) : (
                <div className="w-full py-12 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl mx-12">
                  <p>Você ainda não possui cursos liberados.</p>
                </div>
              )}
            </Carousel>

            <Carousel title="Meus bônus 🎁">
              {products.filter(p => p.is_bonus).length > 0 ? (
                products.filter(p => p.is_bonus).map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isUnlocked={isUnlocked(product)}
                    onOpen={handleOpenProduct}
                  />
                ))
              ) : (
                <div className="w-full py-12 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl mx-12">
                  <p>Nenhum bônus disponível no momento.</p>
                </div>
              )}
            </Carousel>

            <Carousel title="Avance na sua jornada 🚀">
              {products.filter(p => !isUnlocked(p) && !p.is_bonus).length > 0 ? (
                products.filter(p => !isUnlocked(p) && !p.is_bonus).map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isUnlocked={false}
                    onOpen={handleOpenProduct}
                  />
                ))
              ) : (
                <div className="w-full py-12 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl mx-12">
                  <p>Você já possui todos os cursos disponíveis!</p>
                </div>
              )}
            </Carousel>
          </div>

          {/* Support Section - Only on Home */}
          <div className="mt-20 mb-32 px-12 flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 max-w-sm w-full">
              <h3 className="font-bold text-lg mb-2">Precisa de ajuda?</h3>
              <p className="text-sm text-gray-400 mb-4">Fale com nosso suporte exclusivo para alunas.</p>
              
              <div className="space-y-3">
                <a 
                  href={`https://wa.me/${settings.support_whatsapp}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                  SUPORTE PRIORITÁRIO
                </a>
                
                <a 
                  href={`mailto:${settings.support_email}`} 
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-6 rounded-xl transition-all text-xs"
                >
                  Suporte via E-mail
                </a>
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'community' ? (
        <div className="pt-24">
          <Community user={user} />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="pt-24">
          <AdminPanel user={user} />
        </div>
      ) : (
        <div className="pt-24">
          <Profile user={user} />
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              >
                <X size={24} />
              </button>

              <div className="grid md:grid-cols-2">
                <div className="aspect-video md:aspect-auto relative">
                  <img
                    src={selectedProduct.cover_url || `https://picsum.photos/seed/${selectedProduct.id}/800/600`}
                    className="w-full h-full object-cover"
                    alt={selectedProduct.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:hidden" />
                </div>

                <div className="p-8 flex flex-col gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase mb-2">
                      {isUnlocked(selectedProduct) ? 'CONTEÚDO LIBERADO' : 'CONTEÚDO PREMIUM'}
                    </div>
                    <h2 className="text-3xl font-bold leading-tight">{selectedProduct.title}</h2>
                    {!isUnlocked(selectedProduct) && !selectedProduct.is_bonus && (
                      <div className="mt-2 text-2xl font-bold text-white">
                        R$ {(selectedProduct.price / 100).toFixed(2).replace('.', ',')}
                      </div>
                    )}
                  </div>

                  <p className="text-gray-400 leading-relaxed">
                    {selectedProduct.description || 'Este conteúdo exclusivo oferece insights valiosos e ferramentas práticas para sua jornada na maternidade. Desenvolvido por especialistas para garantir o melhor para você e seu bebê.'}
                  </p>

                  <div className="mt-auto pt-6 border-t border-white/10">
                    {isUnlocked(selectedProduct) ? (
                      <button
                        onClick={handleViewPdf}
                        className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-[0.98]"
                      >
                        <FileText size={24} />
                        Visualizar o curso
                      </button>
                    ) : (
                      <button
                        onClick={handleSimulatePurchase}
                        disabled={buying}
                        className="w-full bg-primary-hover text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-primary-hover transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {buying ? (
                          <Loader2 className="animate-spin" size={24} />
                        ) : (
                          <>
                            <ShoppingBag size={24} />
                            Liberar Acesso
                          </>
                        )}
                      </button>
                    )}
                    {!isUnlocked(selectedProduct) && !selectedProduct.is_bonus && (
                      <p className="text-center text-[10px] text-gray-500 mt-4">
                        Pagamento único. Acesso vitalício aos conteúdos e atualizações.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userEmail={user.email} />
    </div>
  );
}
