import AuthForm from '../components/AuthForm';
import { useSettings } from '../contexts/SettingsContext';
import FloatingWhatsApp from '../components/FloatingWhatsApp';

export default function LoginPage() {
  const { settings } = useSettings();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#090a0f]">
      {/* Refined Background Atmospheric Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Soft radial grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03]" />
        
        {/* Luminous aura spots */}
        <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-primary/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[20%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-950/20 rounded-full blur-[160px]" />
      </div>

      <div className="z-10 w-full flex flex-col items-center max-w-lg">
        <AuthForm />
        
        <div className="mt-8 flex flex-col items-center gap-6">
          <p className="text-gray-500 text-xs max-w-sm text-center leading-relaxed">
            {settings.custom_texts?.['auth.disclaimer'] || `Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade. ${settings.app_name} © ${new Date().getFullYear()}`}
          </p>
        </div>
      </div>

      <FloatingWhatsApp page="login" />
    </div>
  );
}
