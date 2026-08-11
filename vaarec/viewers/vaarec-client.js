/**
 * VAAREC Client Authentication & Supabase Storage Stream Loader
 * Zero-Card Architecture (Supabase Auth + Supabase Storage + RLS)
 */
(function() {
  window.VAAREC_CONFIG = window.VAAREC_CONFIG || {
    supabaseUrl: 'https://ahqwpngtawzstghcnxpa.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocXdwbmd0YXd6c3RnaGNueHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODE1NTgsImV4cCI6MjE0MjA1NzU1OH0.m5OsIMT1tJDVQA0eqi8acHCSe7_AQxY-tRQHFfPodn4'
  };

  window.VaarecClient = {
    getSlugFromUrl() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('v')) return params.get('v');
      if (params.get('slug')) return params.get('slug');
      
      const path = window.location.pathname;
      const match = path.match(/\/viewers\/([^.]+)/);
      if (match && match[1] !== 'viewer' && match[1] !== 'index') return match[1];
      
      return 'viewer-05_08_2026-ManaO-AMador-Fem';
    },

    getShareToken() {
      const params = new URLSearchParams(window.location.search);
      return params.get('t') || null;
    },

    getSessionToken() {
      return localStorage.getItem('vaarec_session_token') || null;
    },

    setSessionToken(token) {
      localStorage.setItem('vaarec_session_token', token);
    },

    /**
     * Fetch meta.json directly from Supabase Storage with user JWT token
     */
    async fetchMeta(slug) {
      const token = this.getSessionToken();
      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const storageUrl = `${window.VAAREC_CONFIG.supabaseUrl}/storage/v1/object/authenticated/vaarec-data/viewers/${slug}/meta.json`;
      
      try {
        const res = await fetch(storageUrl, { headers });
        if (!res.ok) {
          throw new Error('UNAUTHORIZED');
        }
        return await res.json();
      } catch (err) {
        throw new Error('UNAUTHORIZED');
      }
    },

    /**
     * Fetch track points on demand from Supabase Storage with user JWT token
     */
    async fetchTrackPoints(slug, trackId) {
      const token = this.getSessionToken();
      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const storageUrl = `${window.VAAREC_CONFIG.supabaseUrl}/storage/v1/object/authenticated/vaarec-data/viewers/${slug}/track-${trackId}.json`;
      const res = await fetch(storageUrl, { headers });

      if (!res.ok) {
        throw new Error('UNAUTHORIZED');
      }
      const data = await res.json();
      return data.points || [];
    },

    /**
     * Request Magic Link for unauthenticated user
     */
    async redeemShareToken(email) {
      const shareToken = this.getShareToken();
      const currentUrl = window.location.href;

      const res = await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/auth/v1/magiclink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.VAAREC_CONFIG.supabaseKey
        },
        body: JSON.stringify({
          email,
          options: {
            redirectTo: currentUrl
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || data.error_description || 'Falha ao solicitar Magic Link de acesso.');
      }

      return {
        success: true,
        message: 'Magic Link enviado! Verifique sua caixa de entrada para acessar o viewer.'
      };
    }
  };
})();
