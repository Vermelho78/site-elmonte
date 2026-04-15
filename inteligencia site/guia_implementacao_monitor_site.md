# 📊 Guia de Implementação: Monitoramento Avançado de Tráfego (Site Estático)

## 🎯 Contexto do Projeto
- **Tipo:** Single Page Application / HTML estático
- **Conteúdo:** GitHub Repository
- **Deploy/Proxy:** Cloudflare Pages / Cloudflare DNS
- **CTAs:** `mailto:` (Zoho Mail) e `https://wa.me/` (WhatsApp)
- **Objetivo:** Coletar máximo de dados de tráfego, comportamento e conversões sem backend próprio
- **Restrições Conhecidas:** GitHub Pages não fornece logs de acesso; `mailto:` não suporta UTM nativamente; saídas de página podem abortar tracking JS

---

## 🧩 Arquitetura de Coleta
| Camada | Ferramenta | O que Captura | Custo | Prioridade |
|--------|------------|---------------|-------|------------|
| Rede & Infraestrutura | Cloudflare Web Analytics | Requisições, países, ASN, bots, cache hit, TLS, latency | Gratuito | 🔴 Alta |
| Comportamento | Google Analytics 4 (GA4) | Sessões, fontes, dispositivos, idioma, scroll, demografia estimada | Gratuito | 🔴 Alta |
| Conversão | Eventos Personalizados (GA4 + `sendBeacon`) | Cliques em Email/WhatsApp, tempo até clique, UTMs | Gratuito | 🔴 Alta |
| UX Avançado (Opcional) | Microsoft Clarity | Heatmaps, gravações de sessão, dead clicks, scroll depth | Gratuito | 🟡 Média |

---

## 📋 Plano de Execução (Fases 1 a 5)

### 🔹 Fase 1: Cloudflare Web Analytics (Infraestrutura)
1. Acessar `dash.cloudflare.com` → Selecionar domínio → **Analytics & Logs → Web Analytics**
2. Clicar em **Add Site** → Selecionar domínio
3. Escolher modo:
   - `JS Mode` (recomendado): Copiar snippet e colar no `<head>`
   - `DNS/Proxy Mode`: Sem JS, captura apenas tráfego que passa pela CDN
4. Verificar métricas em `Real-time` e `Traffic`

### 🔹 Fase 2: Google Analytics 4 (Comportamento)
1. Criar conta em [analytics.google.com](https://analytics.google.com)
2. Criar `Property` → `Data Stream` → `Web`
3. Copiar `Measurement ID` (formato: `G-XXXXXXXXXX`)
4. Inserir snippet no `<head>` do HTML (ver seção 💻 Código)
5. Ativar `DebugView`: `Admin → Data Settings → DebugView → Enable`

### 🔹 Fase 3: Rastreamento de Conversão (CTAs)
1. Modificar links dos botões para incluir `data-cta` e `id`
2. Adicionar script de captura de cliques com `gtag()` + `navigator.sendBeacon`
3. Gerar `API Secret` no GA4: `Admin → Data Streams → Measurement Protocol API secrets → Create`
4. Testar clique → Verificar evento `click_cta` no DebugView

### 🔹 Fase 4: Conformidade & Otimização
1. Adicionar banner de consentimento se necessário (LGPD/GDPR)
2. Configurar retenção de dados no GA4: `Admin → Data Settings → Data Retention → 14 ou 50 meses`
3. Conectar GA4 ao Looker Studio para dashboard automatizado
4. (Opcional) Ativar Microsoft Clarity para heatmaps

### 🔹 Fase 5: Validação & Manutenção
1. Validar por 48h com `DebugView` e Cloudflare Real-time
2. Verificar fallback de `sendBeacon` em rede 3G/slow
3. Exportar baseline CSV semanal
4. Ajustar UTM/campanhas conforme tráfego orgânico/pago

---

## 💻 Código de Implementação

### 1. HTML Estrutural (CTAs)
```html
<!-- Botão Email -->
<a id="cta-email" href="mailto:{{ZOHOMAIL_EMAIL}}" data-cta="email">
  <button type="button">Enviar Email</button>
</a>

<!-- Botão WhatsApp -->
<a id="cta-whatsapp" href="https://wa.me/{{NUMERO_WHATSAPP}}" target="_blank" rel="noopener noreferrer" data-cta="whatsapp">
  <button type="button">Chamar no WhatsApp</button>
</a>