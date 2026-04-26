export type DeviceType = 'ios' | 'android' | 'desktop';

export const getDeviceType = (): DeviceType => {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  return 'desktop';
};

export const isPWAInstalled = (): boolean => {
  // @ts-ignore - navigator.standalone is iOS-specific
  const isStandalone = window.navigator.standalone === true;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isStandalone || isDisplayStandalone;
};

export const getPWADismissed = (): boolean => {
  return localStorage.getItem('pwa_install_dismissed') === 'true';
};

export const setPWADismissed = (value: boolean) => {
  localStorage.setItem('pwa_install_dismissed', value.toString());
};
