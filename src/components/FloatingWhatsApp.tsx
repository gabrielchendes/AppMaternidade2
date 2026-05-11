import React from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import WhatsAppIcon from './WhatsAppIcon';

interface FloatingWhatsAppProps {
  page: 'home' | 'community' | 'profile' | 'login' | 'course';
}

export default function FloatingWhatsApp({ page }: FloatingWhatsAppProps) {
  const { settings } = useSettings();

  const isEnabled = () => {
    switch (page) {
      case 'home': return settings.support_whatsapp_floating_enabled;
      case 'community': return settings.support_whatsapp_floating_community_enabled;
      case 'profile': return settings.support_whatsapp_floating_profile_enabled;
      case 'login': return true; // Always enabled on login if set up? Or maybe we need a setting.
      case 'course': return settings.support_whatsapp_floating_course_enabled; // Assuming this exists or will be added.
      default: return false;
    }
  };

  if (!isEnabled() || !settings.support_whatsapp) return null;

  const whatsappUrl = `https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-24 right-6 z-[100] w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all group"
    >
      <div className="absolute inset-0 bg-white/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
      <WhatsAppIcon className="w-8 h-8 fill-white drop-shadow-md" />
    </motion.a>
  );
}
