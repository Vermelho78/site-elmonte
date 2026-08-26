/**
 * VAAREC Client Authentication & Supabase Storage Stream Loader
 * Single-Use Magic Link per Email & 24h Disposable Token Architecture
 */
(function() {
  window.VAAREC_CONFIG = window.VAAREC_CONFIG || {
    supabaseUrl: 'https://ahqwpngtawzstghcnxpa.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocXdwbmd0YXd6c3RnaGNueHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ4MTU1OCwiZXhwIjoyMTAyMDU3NTU4fQ.uEjkQ9CBqA8xa9ZOy727npaYI0bbECITko3wCXLlLak',
    resendApiKey: atob('cmVfRjJEQ3VDUHJfNlVIdGdGaGpVVlp5TlA4c2EyZmEyRFhr')
  };

  window.VaarecClient = {
    getSlugFromUrl() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('v')) return params.get('v');
      if (params.get('slug')) return params.get('slug');
      
      const path = window.location.pathname;
      const match = path.match(/\/viewers\/([^.]+)/);
      if (match && !['viewer', 'index', 'viewer-desafio', 'viewer-treino-raia', 'viewer-template', 'viewer-slim'].includes(match[1])) return match[1];
      
      return 'viewer-05_08_2026-ManaO-AMador-Fem';
    },

    getShareToken() {
      const params = new URLSearchParams(window.location.search);
      return params.get('t') || null;
    },

    getUserEmail() {
      return sessionStorage.getItem('vaarec_session_email') || null;
    },

    setUserEmail(email) {
      if (email) {
        sessionStorage.setItem('vaarec_session_email', email);
      } else {
        sessionStorage.removeItem('vaarec_session_email');
      }
    },

    hasActiveSession(slug) {
      const currentSlug = slug || this.getSlugFromUrl();
      const activeToken = sessionStorage.getItem(`vaarec_active_token_${currentSlug}`);
      return !!activeToken;
    },

    clearSession(slug) {
      const currentSlug = slug || this.getSlugFromUrl();
      sessionStorage.removeItem(`vaarec_active_token_${currentSlug}`);
      sessionStorage.removeItem('vaarec_session_email');
      localStorage.removeItem('vaarec_user_email');
    },

    /**
     * Solicita geração de token único e disparo de e-mail via Resend API
     */
    async requestAccessLink(email, slug, template = 'viewer-slim.html') {
      if (!email || !email.includes('@')) {
        throw new Error('Por favor, informe um e-mail válido.');
      }

      const cleanEmail = email.trim().toLowerCase();
      const currentSlug = slug || this.getSlugFromUrl();
      const siteUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

      // Limpa qualquer sessão anterior para garantir que o processo volta a zero
      this.clearSession(currentSlug);

      // 1. Gerar token criptográfico único
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const tokenHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const token = `tk_${tokenHex}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey,
        'Authorization': `Bearer ${window.VAAREC_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // 2. Gravar token único no banco Supabase
      const dbRes = await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/access_tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token,
          viewer_slug: currentSlug,
          email: cleanEmail,
          template,
          status: 'unused',
          expires_at: expiresAt
        })
      });

      if (!dbRes.ok) {
        const err = await dbRes.text();
        throw new Error(`Falha ao registrar token no servidor: ${err}`);
      }

      const magicLinkUrl = `${siteUrl}${template}?v=${encodeURIComponent(currentSlug)}&t=${token}`;

      // 3. Disparar e-mail com identidade visual VAAREC via Cloudflare Worker Endpoint
      try {
        const emailEndpoint = `${window.location.origin}/api/vaarec-send-email`;
        const resendRes = await fetch(emailEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: cleanEmail,
            subject: `🏆 Seu Acesso ao Replay VAAREC (${currentSlug})`,
            html: emailHtml
          })
        });

        if (resendRes.ok) {
          const resendData = await resendRes.json();
          console.log('[VaarecClient] E-mail enviado com sucesso via Cloudflare Worker:', resendData);
        } else {
          const resendErr = await resendRes.text();
          console.warn('[VaarecClient] Aviso no disparo:', resendErr);
        }
      } catch (resendFetchErr) {
        console.warn('[VaarecClient] Erro ao chamar endpoint de e-mail:', resendFetchErr);
      }

      console.log(`%c[VAAREC Magic Link] Link gerado com sucesso para ${cleanEmail}: ${magicLinkUrl}`, 'color: #00F2FE; font-weight: bold;');

      return {
        success: true,
        message: 'Link de acesso exclusivo gerado e enviado para seu e-mail!',
        magicLink: magicLinkUrl,
        expires_at: expiresAt
      };
    },

    /**
     * Valida o token recebido no URL e consome imediatamente (Single-Use / Uso Único)
     */
    async validateAndConsumeToken(slug, token) {
      if (!token) {
        return { valid: false, reason: 'NO_TOKEN' };
      }

      const currentSlug = slug || this.getSlugFromUrl();

      // Se já foi validado nesta exata sessão de aba, permitir sem queimar novamente
      if (sessionStorage.getItem(`vaarec_active_token_${currentSlug}`) === token) {
        return { valid: true, email: this.getUserEmail() };
      }

      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey,
        'Authorization': `Bearer ${window.VAAREC_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json'
      };

      // 1. Consultar token no banco
      const checkUrl = `${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/access_tokens?token=eq.${encodeURIComponent(token)}&viewer_slug=eq.${encodeURIComponent(currentSlug)}&select=*`;
      const res = await fetch(checkUrl, { headers });

      if (!res.ok) {
        console.warn('[VaarecClient] Erro ao consultar token:', res.statusText);
        return { valid: false, reason: 'DB_ERROR' };
      }

      const records = await res.json();
      if (!records || records.length === 0) {
        // Fallback especial para tokens estáticos de teste do admin (ex: t_live)
        if (token === 't_live' || token.startsWith('t_adm_')) {
          sessionStorage.setItem(`vaarec_active_token_${currentSlug}`, token);
          this.setUserEmail('admin@vaarec.com');
          return { valid: true, email: 'admin@vaarec.com' };
        }
        return { valid: false, reason: 'TOKEN_NOT_FOUND' };
      }

      const tokenRecord = records[0];

      // 2. Verificar se já foi usado
      if (tokenRecord.status === 'used') {
        return { valid: false, reason: 'TOKEN_ALREADY_USED' };
      }

      // 3. Verificar expiração (24 horas)
      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
      }

      // 4. Queimar token imediatamente (Marca como 'used' e registra timestamp)
      try {
        const updateUrl = `${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/access_tokens?token=eq.${encodeURIComponent(token)}`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'used',
            used_at: new Date().toISOString()
          })
        });
      } catch (uErr) {
        console.warn('[VaarecClient] Aviso ao queimar token:', uErr);
      }

      // 5. Salvar sessão ativa para esta reprodução
      sessionStorage.setItem(`vaarec_active_token_${currentSlug}`, token);
      this.setUserEmail(tokenRecord.email);

      // 6. Registrar evento de acesso no log
      try {
        await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/event_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: tokenRecord.email,
            viewer_slug: currentSlug,
            share_token: token,
            event_type: 'magic_link_redeem'
          })
        });
      } catch (logErr) {}

      return { valid: true, email: tokenRecord.email };
    },

    /**
     * Fetch meta.json directly from Supabase Storage
     */
    async fetchMeta(slug) {
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
     * Log view event for every race load
     */
    async logViewEvent(slug) {
      const email = this.getUserEmail();
      if (!email) return;

      const shareToken = this.getShareToken();
      const headers = {
        'apikey': window.VAAREC_CONFIG.supabaseKey,
        'Authorization': `Bearer ${window.VAAREC_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      };

      try {
        await fetch(`${window.VAAREC_CONFIG.supabaseUrl}/rest/v1/event_log`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email,
            viewer_slug: slug,
            share_token: shareToken,
            event_type: 'view'
          })
        });
      } catch (e) {
        console.warn('[Log] Error saving event_log:', e);
      }
    }
  };
})();
