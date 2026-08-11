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
        meta.sportPackage.tracks = meta.sportPackage.tracks.map((track) => {
          const { points, ...trackMeta } = track;
          tracks.push({
            trackId: track.id,
            name: track.name,
            points: points || []
          });
          return trackMeta;
        });
      }

      const slug = meta.slug || file.name.replace('.json', '');

      statusEl.textContent = `Enviando fragmentos para o Supabase Storage (${tracks.length + 1} arquivos)...`;

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

      statusEl.style.color = '#22c55e';
      statusEl.textContent = `✅ Sucesso! Viewer "${slug}" publicado no Supabase Storage (${uploadedTracks} tracks enviadas). Rota: /vaarec/viewers/${slug}.html`;
    } catch (err) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = `❌ Erro: ${err.message}`;
    }
  };

  reader.readAsText(file);
});

document.getElementById('btn-create-link').addEventListener('click', () => {
  const slug = document.getElementById('viewer-slug').value.trim();
  const maxUses = document.getElementById('max-uses').value.trim();

  if (!slug) {
    alert('Informe o slug do viewer.');
    return;
  }

  const token = 't_' + Math.random().toString(36).substring(2, 10);
  const shareUrl = `https://elmonte.dev.br/vaarec/viewers/${slug}.html?t=${token}`;

  const linkEl = document.getElementById('generated-link');
  linkEl.innerHTML = `Link Gerado: <a href="${shareUrl}" target="_blank" style="color: #60a5fa;">${shareUrl}</a> (Limite: ${maxUses || 'Ilimitado'})`;
});
