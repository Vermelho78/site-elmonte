/**
 * VAAREC Admin Panel Logic (Supabase Storage Edition - Zero Card Multi-Template)
 */
const DEFAULT_SUPABASE_URL = 'https://ahqwpngtawzstghcnxpa.supabase.co';
const DEFAULT_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocXdwbmd0YXd6c3RnaGNueHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ4MTU1OCwiZXhwIjoyMTAyMDU3NTU4fQ.uEjkQ9CBqA8xa9ZOy727npaYI0bbECITko3wCXLlLak';

function sanitizeSlug(raw) {
  if (!raw) return 'viewer-' + Date.now();
  return raw
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/\-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('supabase-url');
  const keyInput = document.getElementById('supabase-key');
  const fileInput = document.getElementById('json-file');

  if (urlInput && keyInput) {
    urlInput.value = localStorage.getItem('vaarec_supabase_url') || DEFAULT_SUPABASE_URL;
    keyInput.value = localStorage.getItem('vaarec_supabase_key') || DEFAULT_SUPABASE_SERVICE_KEY;

    urlInput.addEventListener('change', () => {
      localStorage.setItem('vaarec_supabase_url', urlInput.value.trim());
    });
    keyInput.addEventListener('change', () => {
      localStorage.setItem('vaarec_supabase_key', keyInput.value.trim());
    });
  }

  // Auto-detect template from selected JSON file
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      const file = fileInput.files[0];
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const templateSelect = document.getElementById('template-select');
        const shareTemplateSelect = document.getElementById('share-template-select');
        const slugInput = document.getElementById('custom-slug');

        if (slugInput && !slugInput.value) {
          slugInput.value = sanitizeSlug(json.slug || file.name.replace(/\.json$/i, ''));
        }

        let detectedTemplate = 'viewer-slim.html';
        if (json.context === 'slim' || json.template === 'viewer-slim.html') {
          detectedTemplate = 'viewer-slim.html';
        } else if (json.context === 'desafio' || json.template === 'viewer-desafio.html') {
          detectedTemplate = 'viewer-desafio.html';
        } else if (json.context === 'treino-raia' || json.template === 'viewer-treino-raia.html') {
          detectedTemplate = 'viewer-treino-raia.html';
        } else if (json.context === 'padrao' || json.template === 'viewer.html') {
          detectedTemplate = 'viewer.html';
        }

        if (templateSelect) templateSelect.value = detectedTemplate;
        if (shareTemplateSelect) shareTemplateSelect.value = detectedTemplate;
      } catch (e) {
        console.warn('Auto-detect template warning:', e);
      }
    });
  }
});

document.getElementById('btn-publish').addEventListener('click', async () => {
  let supabaseUrl = document.getElementById('supabase-url').value.trim() || DEFAULT_SUPABASE_URL;
  let supabaseKey = document.getElementById('supabase-key').value.trim() || DEFAULT_SUPABASE_SERVICE_KEY;
  const customSlugInput = document.getElementById('custom-slug');
  const fileInput = document.getElementById('json-file');
  const templateSelect = document.getElementById('template-select');
  const statusEl = document.getElementById('publish-status');

  const selectedTemplate = templateSelect ? templateSelect.value : 'viewer-desafio.html';

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    alert('Por favor, insira uma URL válida do projeto Supabase (ex: https://seu-projeto.supabase.co).');
    return;
  }
  if (!supabaseKey) {
    alert('Por favor, informe sua Supabase Service Role Key.');
    return;
  }
  if (!fileInput.files.length) {
    alert('Por favor, selecione um arquivo .json de prova.');
    return;
  }

  // Remove trailing slash from URL
  supabaseUrl = supabaseUrl.replace(/\/+$/, '');

  // Save to localStorage
  localStorage.setItem('vaarec_supabase_url', supabaseUrl);
  localStorage.setItem('vaarec_supabase_key', supabaseKey);

  statusEl.style.color = '#60a5fa';
  statusEl.textContent = 'Processando e fatiando arquivo JSON...';

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const fullJson = JSON.parse(e.target.result);

      // Slice JSON in browser
      const meta = JSON.parse(JSON.stringify(fullJson));
      meta.template = selectedTemplate;
      meta.context = selectedTemplate.includes('slim') ? 'slim' : (selectedTemplate.includes('desafio') ? 'desafio' : (selectedTemplate.includes('raia') ? 'treino-raia' : 'padrao'));

      const tracks = [];
      const sourceTracks = meta.sportPackage?.tracks || meta.tracks || [];

      if (sourceTracks && Array.isArray(sourceTracks)) {
        const processedTracks = sourceTracks.map((track, idx) => {
          const { points, rawPoints, data, gpsData, ...trackMeta } = track;
          const rawId = track.id || track.trackId || (idx + 1);
          const cleanTrackId = String(rawId).replace(/^track-/, '');
          const trackPoints = (points && points.length) ? points : (rawPoints || data || gpsData || []);

          let computedDistM = 0;
          if (trackPoints && trackPoints.length > 1) {
            for (let p = 0; p < trackPoints.length - 1; p++) {
              const p1 = trackPoints[p];
              const p2 = trackPoints[p + 1];
              const lat1 = p1.lat ?? p1[0];
              const lon1 = p1.lng ?? p1.lon ?? p1[1];
              const lat2 = p2.lat ?? p2[0];
              const lon2 = p2.lng ?? p2.lon ?? p2[1];
              if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                computedDistM += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              }
            }
          }
          const finalStats = { ...(trackMeta.stats || {}) };
          if (computedDistM > 100) {
            finalStats.totalDistanceMeters = Math.round(computedDistM);
          }

          tracks.push({
            trackId: cleanTrackId,
            name: track.name || `Canoa ${idx + 1}`,
            points: trackPoints
          });
          return { ...trackMeta, stats: finalStats, id: cleanTrackId, name: track.name || `Canoa ${idx + 1}` };
        });

        if (meta.sportPackage) {
          meta.sportPackage.tracks = processedTracks;
        } else {
          meta.tracks = processedTracks;
        }
      }

      // Allow user custom slug or fallback to filename
      const userCustomSlug = customSlugInput ? customSlugInput.value.trim() : '';
      const rawSlug = userCustomSlug || meta.slug || file.name.replace(/\.json$/i, '');
      const slug = sanitizeSlug(rawSlug);

      statusEl.textContent = `Enviando fragmentos para o Supabase Storage (${tracks.length + 1} arquivos para "${slug}")...`;

      const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      };

      // 1. Upload meta.json to Supabase Storage
      const metaStorageUrl = `${supabaseUrl}/storage/v1/object/vaarec-data/viewers/${slug}/meta.json`;
      const metaRes = await fetch(metaStorageUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(meta)
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Falha ao subir meta.json para o Supabase Storage (${metaRes.status}): ${errText}`);
      }

      // 2. Upload track files to Supabase Storage
      let uploadedTracks = 0;
      for (const tr of tracks) {
        const trackStorageUrl = `${supabaseUrl}/storage/v1/object/vaarec-data/viewers/${slug}/track-${tr.trackId}.json`;
        const trackRes = await fetch(trackStorageUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(tr)
        });
        if (trackRes.ok) {
          uploadedTracks++;
        } else {
          console.warn(`Aviso ao subir track-${tr.trackId}.json: ${trackRes.statusText}`);
        }
      }

      // 3. Register viewer in database
      try {
        await fetch(`${supabaseUrl}/rest/v1/viewers`, {
          method: 'POST',
          headers: {
            ...headers,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            slug,
            title: meta.name || slug,
            data_path: `viewers/${slug}/`
          })
        });
      } catch (dbErr) {
        console.warn('Registro na tabela viewers em aviso:', dbErr);
      }

      // Auto fill viewer slug in link generator field
      const slugInput = document.getElementById('viewer-slug');
      if (slugInput) slugInput.value = slug;

      const shareTemplateSelect = document.getElementById('share-template-select');
      if (shareTemplateSelect) shareTemplateSelect.value = selectedTemplate;

      const publicUrl = `https://elmonte.dev.br/vaarec/viewers/${selectedTemplate}?v=${encodeURIComponent(slug)}`;
      const adminBypassUrl = `https://elmonte.dev.br/vaarec/viewers/${selectedTemplate}?v=${encodeURIComponent(slug)}&t=t_adm_master`;

      statusEl.style.color = '#22c55e';
      statusEl.innerHTML = `
        <div style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 10px; padding: 16px; margin-top: 10px;">
          <div style="font-size: 14px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">
            ✅ Sucesso! Viewer "${slug}" publicado no Supabase Storage (${uploadedTracks} tracks enviadas).
          </div>
          <div style="font-size: 13px; color: #eaf2ff; margin-bottom: 12px;">
            Template Principal: <b style="color: var(--accent);">${selectedTemplate}</b>
          </div>
          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-bottom: 14px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">🔗 LINK OFICIAL PARA O PÚBLICO (Exige e-mail e gera link único de 24h):</div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <a href="${publicUrl}" target="_blank" style="color: #00F2FE; font-size: 13px; word-break: break-all;">${publicUrl}</a>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="${publicUrl}" target="_blank" class="btn btn-cyan" style="text-decoration:none; padding:8px 14px; font-size:12px;">✉️ Testar Fluxo de E-mail (Público)</a>
            <a href="${adminBypassUrl}" target="_blank" class="btn" style="text-decoration:none; padding:8px 14px; font-size:12px; background:#0e7490;">🔑 Abrir Direto (Admin Bypass)</a>
          </div>
        </div>
      `;
    } catch (err) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = `❌ Erro: ${err.message}`;
    }
  };

  reader.readAsText(file);
});

document.getElementById('btn-create-link').addEventListener('click', () => {
  const slug = document.getElementById('viewer-slug').value.trim();
  const shareTemplateSelect = document.getElementById('share-template-select');
  const selectedTemplate = shareTemplateSelect ? shareTemplateSelect.value : 'viewer-slim.html';

  if (!slug) {
    alert('Informe o slug do viewer.');
    return;
  }

  const publicUrl = `https://elmonte.dev.br/vaarec/viewers/${selectedTemplate}?v=${encodeURIComponent(slug)}`;
  const adminBypassUrl = `https://elmonte.dev.br/vaarec/viewers/${selectedTemplate}?v=${encodeURIComponent(slug)}&t=t_adm_master`;

  const linkEl = document.getElementById('generated-link');
  linkEl.innerHTML = `
    <div style="background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.3); border-radius: 10px; padding: 14px; margin-top: 10px;">
      <div style="font-size: 12px; font-weight: 700; color: #00F2FE; margin-bottom: 6px;">🔗 Link Oficial para Espectadores (Magic Link / Uso Único por E-mail):</div>
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
        <a href="${publicUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 13px; word-break: break-all;">${publicUrl}</a>
        <button class="btn btn-green" id="btn-copy-public" style="padding: 6px 12px; font-size: 12px;">📋 Copiar Link do Público</button>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; font-size: 11px; color: #94a3b8;">
        🔑 Acesso Direto Admin (Sem E-mail): <a href="${adminBypassUrl}" target="_blank" style="color: #cbd5e1; text-decoration: underline;">${adminBypassUrl}</a>
      </div>
    </div>
  `;

  document.getElementById('btn-copy-public').addEventListener('click', () => {
    navigator.clipboard.writeText(publicUrl);
    const copyBtn = document.getElementById('btn-copy-public');
    copyBtn.textContent = '✅ Link Copiado!';
    setTimeout(() => { copyBtn.textContent = '📋 Copiar Link do Público'; }, 3000);
  });
});
