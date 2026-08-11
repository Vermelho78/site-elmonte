/**
 * VAAREC Client Authentication & Data Stream Loader
 */
(function() {
  const API_BASE = window.VAAREC_API_BASE || 'https://vaarec-worker.elmonte.workers.dev';

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

    async fetchMeta(slug) {
      const token = this.getSessionToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/viewer/${slug}/meta`, { headers });
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error(`Error fetching meta: ${res.statusText}`);
      }
      return await res.json();
    },

    async fetchTrackPoints(slug, trackId) {
      const token = this.getSessionToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/viewer/${slug}/track/${trackId}`, { headers });
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error(`Error fetching track points: ${res.statusText}`);
      }
      const data = await res.json();
      return data.points || [];
    },

    async redeemShareToken(email, turnstileToken) {
      const shareToken = this.getShareToken();
      const res = await fetch(`${API_BASE}/api/share/${shareToken || 'default'}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao solicitar acesso.');
      }
      return data;
    }
  };
})();
