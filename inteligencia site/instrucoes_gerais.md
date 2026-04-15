🔒 Conformidade & Manutenção
Requisito
Ação
LGPD/GDPR
Se coletar dados pessoais ou usar cookies de terceiros, exibir banner de consentimento antes de carregar GA4/Clarity. Alternativa: migrar para Plausible/Umami (sem cookies, sem banner obrigatório)
Retenção GA4
Admin → Data Settings → Data Retention → 14 meses (padrão) ou 50 meses
Backup de Dados
Exportar mensalmente via Looker Studio ou conectar GA4 ao BigQuery (gratuito até 1M eventos/mês)
Validação
Usar GA4 DebugView, Cloudflare Real-time, e Network Tab → filter: collect/beacon
Segurança
Manter anonymize_ip: true, não logar PII, usar rel="noopener noreferrer" em links externos
✅ Checklist de Validação para Agente IA
Substituir todos os placeholders {{...}} por valores reais
Cloudflare Web Analytics ativo e exibindo tráfego em tempo real
GA4 DebugView mostrando page_view e click_cta
sendBeacon registrando eventos mesmo com fechamento rápido da aba
Links WhatsApp contendo UTMs automáticos após clique
Banner de consentimento implementado (se aplicável)
Dashboard Looker Studio conectado ao GA4 com métricas: Usuários, Fonte/Mídia, Dispositivo, Conversões CTA, País
Script posicionado antes de </body>, sem conflitos com outros JS
🤖 Instruções de Execução para o Agente IA
Parse de Placeholders: Identifique e substitua:
{{ZOHOMAIL_EMAIL}} → Email de contato Zoho
{{NUMERO_WHATSAPP}} → Número no formato 5548999799162
{{CF_ANALYTICS_TOKEN}} → Token do Cloudflare Web Analytics
{{GA4_MEASUREMENT_ID}} → G-XXXXXXXXXX
{{GA4_API_SECRET}} → Secret do Measurement Protocol
Injeção no Código:
Cole snippets 2 e 3 no HTML exatos na ordem indicada
Mantenha defer e async conforme especificado para não bloquear renderização
Deploy:
Commit no GitHub → Cloudflare Pages detecta e deploya automaticamente
Aguarde 2-5 min para propagação de DNS/CDN
Validação Automatizada:
Execute curl -I https://SEU_DOMINIO → Verifique CF-RAY e 200
Abra ?utm_source=test&utm_medium=test → Verifique GA4 DebugView
Clique nos botões → Confirme evento click_cta com parâmetros corretos
Fallback/Debug:
Se sendBeacon falhar, verifique CORS, tamanho do payload (<64KB), e se api_secret está válido
Se GA4 não registrar, valide gtag loading via window.gtag no console
Se Cloudflare não mostrar tráfego, verifique se Proxy status está Proxied (nuvem laranja)
📌 Nota Final para o Agente: Este documento é autocontido. Não requer backend, banco de dados ou CI/CD complexo. Basta injetar os snippets, substituir placeholders, deployar e validar. Para escalar, considere Cloudflare Workers para log de mailto: redirects ou formulário próprio com rate-limiting.