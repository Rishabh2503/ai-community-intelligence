'use client';

import { useEffect, useState } from 'react';
import { api, tokenStore } from './api';

const LOCATION_KEY = 'community-space-location';

export function usePreferredLocation() {
  const [location, setLocationState] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(LOCATION_KEY) ?? '';
    setLocationState(stored);

    if (tokenStore.get()) {
      void api.auth.me().then(({ profile }) => {
        if (profile?.location && !stored) {
          localStorage.setItem(LOCATION_KEY, profile.location);
          setLocationState(profile.location);
        }
      }).catch(() => undefined);
    }
  }, []);

  const setLocation = (value: string) => {
    const next = value.trim();
    setLocationState(next);
    if (next) localStorage.setItem(LOCATION_KEY, next);
    else localStorage.removeItem(LOCATION_KEY);
  };

  return { location, setLocation };
}