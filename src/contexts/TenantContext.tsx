import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo_url?: string;
  primary_color?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        // In a real SaaS, we'd identify the tenant by subdomain:
        // const hostname = window.location.hostname;
        // const subdomain = hostname.split('.')[0];
        
        // For this demo, we'll use a default tenant or fetch the first one
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .limit(1)
          .single();

        if (error) {
          // Fallback for demo if table doesn't exist
          setTenant({
            id: 'default-tenant',
            name: 'Maternidade Premium',
            subdomain: 'app',
            primary_color: '#ef4444'
          });
        } else {
          setTenant(data);
        }
      } catch (err) {
        console.error('Error fetching tenant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
