/**
 * VAAREC Client Authentication & Supabase Storage Stream Loader
 * Zero-Card Architecture (Supabase Auth + Supabase Storage + RLS)
 */
(function() {
  window.VAAREC_CONFIG = window.VAAREC_CONFIG || {
    supabaseUrl: 'https://ahqwpngtawzstghcnxpa.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocXdwbmd0YXd6c3RnaGNueHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ4MTU1OCwiZXhwIjoyMTAyMDU3NTU4fQ.uEjkQ9CBqA8xa9ZOy727npaYI0bbECITko3wCXLlLak'
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

    getUserEmail() {
      return localStorage.getItem('vaarec_user_email') || null;
    },

    setUserEmail(email) {
      localStorage.setItem('vaarec_user_email', email);
    },

    getSessionToken() {
      return localStorage.getItem('vaarec_session_token') || window.VAAREC_CONFIG.supabaseKey;
    },

    setSessionToken(token) {
      localStorage.setItem('vaarec_session_token', token);
    },

    /**
     * Fetch meta.json directly from Supabase Storage
     */
    async fetchMeta(slug) {
      const email = this.getUserEmail();
      if (!email) {
        throw new Error('UNAUTHORIZED');
      }

      const storageUrl = `${window.VAAREC_CONFIG.supabaseUrl}/storage/v1/object/public/vaarec-data/viewers/${slug}/meta.json`;
      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey
      };

      const res = await fetch(storageUrl, { headers });
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) {
          throw new Error(`Prova "${slug}" não encontrada no servidor. Verifique se foi publicada corretamente no Painel Admin.`);
        }
        throw new Error(`Erro ao carregar dados da prova (${res.status} ${res.statusText}).`);
      }
      return await res.json();
    },

    /**
     * Fetch track points on demand from Supabase Storage
     */
    async fetchTrackPoints(slug, trackId) {
      const cleanId = String(trackId).replace(/^track-/, '');
      const storageUrl = `${window.VAAREC_CONFIG.supabaseUrl}/storage/v1/object/public/vaarec-data/viewers/${slug}/track-${cleanId}.json`;
      const fallbackUrl = `${window.VAAREC_CONFIG.supabaseUrl}/storage/v1/object/public/vaarec-data/viewers/${slug}/track-${trackId}.json`;
      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey
      };

      let res = await fetch(storageUrl, { headers });
      if (!res.ok) {
        res = await fetch(fallbackUrl, { headers });
      }
      if (!res.ok) {
        throw new Error(`Track "${cleanId}" não encontrada. Tente republicar a prova no Painel Admin.`);
      }
      const data = await res.json();
      return data.points || [];
    },

    /**
     * Register email, record access in Supabase database, and grant instant session
     */
    async redeemShareToken(email) {
      if (!email || !email.includes('@')) {
        throw new Error('Por favor, informe um e-mail válido.');
      }

      const slug = this.getSlugFromUrl();
      const shareToken = this.getShareToken();

      // Save email locally
      this.setUserEmail(email);
      this.setSessionToken(window.VAAREC_CONFIG.supabaseKey);

      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey,
        'Authorization': `Bearer ${window.VAAREC_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      };

      // 1. Register user in Supabase Postgres database
      try {
        await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/users?on_conflict=email`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            auth_provider: 'email',
            status: 'active'
          })
        });
      } catch (err) {
        console.warn('Registro de usuario:', err);
      }

      // 2. Log access event in event_log table
      try {
        await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/event_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            viewer_slug: slug,
            share_token: shareToken,
            event_type: 'redeem'
          })
        });
      } catch (err) {
        console.warn('Registro em event_log:', err);
      }

      return {
        success: true,
        message: 'Acesso liberado com sucesso!'
      };
    }
  };
})();
