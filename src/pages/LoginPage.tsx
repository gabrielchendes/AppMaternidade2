import AuthForm from '../components/AuthForm';
import { useSettings } from '../contexts/SettingsContext';
import FloatingWhatsApp from '../components/FloatingWhatsApp';

export default function LoginPage() {
  const { settings } = useSettings();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full flex flex-col items-center">
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
