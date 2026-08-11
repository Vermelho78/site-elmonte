/**
 * VAAREC Admin Panel Logic
 */
const API_BASE = window.VAAREC_API_BASE || 'https://vaarec-worker.elmonte.workers.dev';

document.getElementById('btn-publish').addEventListener('click', async () => {
  const adminSecret = document.getElementById('admin-secret').value.trim();
  const fileInput = document.getElementById('json-file');
  const statusEl = document.getElementById('publish-status');

  if (!adminSecret) {
    alert('Por favor, informe a chave secreta admin.');
    return;
  }
  if (!fileInput.files.length) {
    alert('Por favor, selecione um arquivo .json de prova.');
    return;
  }

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

      statusEl.textContent = `Enviando fragmentos para a nuvem (${tracks.length} tracks)...`;

      const res = await fetch(`${API_BASE}/api/admin/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify({
          slug,
          title: meta.name || slug,
          meta,
          tracks
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao publicar no servidor.');
      }

      statusEl.style.color = '#22c55e';
      statusEl.textContent = `✅ Sucesso! Viewer publicado. Rota: /vaarec/viewers/${slug}.html`;
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
