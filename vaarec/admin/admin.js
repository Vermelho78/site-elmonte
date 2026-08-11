/**
 * VAAREC Admin Panel Logic (Supabase Storage Edition - Zero Card)
 */
const DEFAULT_SUPABASE_URL = 'https://ahqwpngtawzstghcnxpa.supabase.co';
const DEFAULT_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocXdwbmd0YXd6c3RnaGNueHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ4MTU1OCwiZXhwIjoyMTAyMDU3NTU4fQ.uEjkQ9CBqA8xa9ZOy727npaYI0bbECITko3wCXLlLak';

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('supabase-url');
  const keyInput = document.getElementById('supabase-key');

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
});

document.getElementById('btn-publish').addEventListener('click', async () => {
  let supabaseUrl = document.getElementById('supabase-url').value.trim() || DEFAULT_SUPABASE_URL;
  let supabaseKey = document.getElementById('supabase-key').value.trim() || DEFAULT_SUPABASE_SERVICE_KEY;
  const customSlugInput = document.getElementById('custom-slug');
  const fileInput = document.getElementById('json-file');
  const statusEl = document.getElementById('publish-status');

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
      const tracks = [];

      if (meta.sportPackage && Array.isArray(meta.sportPackage.tracks)) {
        meta.sportPackage.tracks = meta.sportPackage.tracks.map((track, idx) => {
          const { points, ...trackMeta } = track;
          const rawId = track.id || track.trackId || (idx + 1);
          const cleanTrackId = String(rawId).replace(/^track-/, '');

          tracks.push({
            trackId: cleanTrackId,
            name: track.name,
            points: points || []
          });
          return { ...trackMeta, id: cleanTrackId };
        });
      }

      // Allow user custom slug or fallback to filename
      const userCustomSlug = customSlugInput ? customSlugInput.value.trim() : '';
      const slug = userCustomSlug || meta.slug || file.name.replace('.json', '');

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

      statusEl.style.color = '#22c55e';
      statusEl.textContent = `✅ Sucesso! Viewer "${slug}" publicado no Supabase Storage (${uploadedTracks} tracks enviadas). Rota: /vaarec/viewers/viewer.html?v=${slug}`;
    } catch (err) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = `❌ Erro: ${err.message}`;
    }
  };

  reader.readAsText(file);
});

document.getElementById('btn-create-link').addEventListener('click', () => {
  const slug = document.getElementById('viewer-slug').value.trim();

  if (!slug) {
    alert('Informe o slug do viewer.');
    return;
  }

  const token = 't_' + Math.random().toString(36).substring(2, 10);
  const shareUrl = `https://elmonte.dev.br/vaarec/viewers/viewer.html?v=${encodeURIComponent(slug)}&t=${token}`;

  const linkEl = document.getElementById('generated-link');
  linkEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
      <a href="${shareUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 14px;">${shareUrl}</a>
      <button class="btn" id="btn-copy-link" style="padding: 8px 14px; font-size: 13px; background: #22c55e;">📋 Copiar Link</button>
    </div>
  `;

  document.getElementById('btn-copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(shareUrl);
    const copyBtn = document.getElementById('btn-copy-link');
    copyBtn.textContent = '✅ Link Copiado!';
    setTimeout(() => { copyBtn.textContent = '📋 Copiar Link'; }, 3000);
  });
});
