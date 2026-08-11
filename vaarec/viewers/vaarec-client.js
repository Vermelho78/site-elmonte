/**
 * VAAREC Client Authentication & Supabase Storage Stream Loader
 * Zero-Card Architecture (Supabase Auth + Supabase Storage + RLS)
 */
(function() {
  window.VAAREC_CONFIG = window.VAAREC_CONFIG || {
    supabaseUrl: 'https://sua-url-supabase.supabase.co',
    supabaseKey: 'sua-chave-anon-supabase'
  };

  window.VaarecClient = {
    getSlugFromUrl() {
      const path = window.location.pathname;
      const match = path.match(/\/viewers\/([^.]+)/);
      if (match) return match[1];
      const params = new URLSearchParams(window.location.search);
      return params.get('slug') || 'viewer-05_08_2026-ManaO-AMador-Fem';
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
      const res = await fetch(storageUrl, { headers });

      if (res.status === 401 || res.status === 403) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error(`Erro ao carregar meta.json: ${res.statusText}`);
      }
      return await res.json();
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

      if (res.status === 401 || res.status === 403) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error(`Erro ao carregar pontos da track: ${res.statusText}`);
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
