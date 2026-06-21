import React from 'react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import WhatsAppIcon from './WhatsAppIcon';

interface FloatingWhatsAppProps {
  page: 'home' | 'community' | 'profile' | 'login' | 'course' | 'lesson' | 'preview';
}

export default function FloatingWhatsApp({ page }: FloatingWhatsAppProps) {
  const { settings } = useSettings();

  const isEnabled = () => {
    if (page === 'login') return true;
    
    if (page === 'home') return settings.support_whatsapp_floating_enabled;
    if (page === 'community') return settings.support_whatsapp_floating_community_enabled;
    if (page === 'profile') return settings.support_whatsapp_floating_profile_enabled;
    if (page === 'course') return settings.support_whatsapp_floating_course_enabled;
    if (page === 'lesson') return settings.custom_texts?.['config.support_whatsapp_lesson_floating'] === 'true';
    if (page === 'preview') return settings.custom_texts?.['config.support_whatsapp_preview_floating'] !== 'false';
    
    return false;
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
