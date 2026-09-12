# 📱 HarTv Gestor - Aplicativo para Android

Um aplicativo moderno, veloz e seguro para gerenciamento de clientes, cobranças, vencimentos e servidores de IPTV diretamente no celular, **sem depender de nenhum banco de dados externo ou servidor pago**.

---

## ✨ Recursos Principais

- **📋 Cadastro Completo de Clientes**:
  - Nome de usuário / Cliente
  - Data de Vencimento com cálculo automático de dias restantes
  - URL / DNS do Servidor
  - Aplicativo (Smarters, XCIPTV, IBO Player, TiviMate, etc.)
  - Valor da Mensalidade (R$)
  - Usuário (Login)
  - Senha (com botão de ocultar/mostrar e gerador de senha aleatória)
  - Servidor / Painel
  - WhatsApp / Telefone com link direto
  - Observações extras
- **🔔 Notificações no Celular Android**:
  - Alertas automáticos no celular avisando clientes que **vencem hoje** ou **vencem nos próximos dias**.
  - Alerta ao cadastrar, alterar ou renovar assinaturas.
  - Funciona através do Service Worker e Notification API do Android.
- **💾 Exportar e Importar (100% Sem Banco de Dados)**:
  - **Exportar**: Baixe o arquivo `.json` ou compartilhe com 1 clique direto no WhatsApp / Drive / Telegram para o outro celular.
  - **Importar**: No novo celular, abra o app, clique no botão de backup, selecione o arquivo e restaure todos os seus clientes em segundos!
  - Escolha entre **Mesclar** (para juntar listas) ou **Substituir tudo**.
- **💬 Automação de WhatsApp com 1 Toque**:
  - Envio formatado de **Dados de Acesso** (App, URL, Usuário, Senha e Vencimento).
  - Envio de **Lembrete de Cobrança / Renovação com Chave Pix**.
- **⚡ Renovação Rápida (+30 Dias)**:
  - Botão de 1 toque no card do cliente para estender a validade automaticamente.
- **📊 Dashboard Financeiro**:
  - Contagem de Ativos, Vencendo Hoje, Vencendo em Breve e Vencidos.
  - Previsão de faturamento mensal total em R$.
- **📴 100% Offline**:
  - Funciona perfeitamente sem sinal de internet ou em modo avião.

---

## 📲 Como Instalar no Celular Android (Passo a Passo)

O aplicativo foi desenvolvido com tecnologia **PWA (Progressive Web App)**, o que significa que ele vira um app nativo no Android com ícone, tela cheia e notificações:

### Método 1: Pelo Google Chrome no Android
1. Hospede os arquivos em qualquer servidor gratuito (como GitHub Pages, Vercel ou Netlify) ou acesse o endereço IP local do seu computador na mesma rede Wi-Fi.
2. Abra o link no **Google Chrome** do seu celular.
3. Você verá uma barra superior: **"📱 Instale o app na sua tela inicial!"** -> Clique em **Instalar**.
4. Caso a barra não apareça, toque nos **3 pontinhos (⋮)** no canto superior direito do Chrome e selecione:
   👉 **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
5. Pronto! O ícone do **HarTv Gestor** será colocado na tela do seu celular e ele abrirá em tela cheia como qualquer app baixado da Play Store.

---

## 🔄 Como Passar os Dados de um Celular para Outro

1. **No Celular Antigo:**
   - Toque no ícone de disquete **💾 (Backup)** no topo.
   - Toque em **"Baixar Arquivo de Backup (.json)"** ou **"Compartilhar"**.
   - Envie o arquivo gerado (ex: `hartv_backup_2026-09-12.json`) para o seu WhatsApp ou Google Drive.
2. **No Novo Celular:**
   - Abra o **HarTv Gestor** no novo aparelho.
   - Toque no ícone **💾 (Backup)** e vá para a aba **"📥 Importar Dados"**.
   - Toque em **"Selecionar Arquivo"** e escolha o arquivo `.json` que você enviou.
   - Pronto! Todos os seus clientes, senhas, URLs e configurações estarão disponíveis no novo celular instantaneamente.

---

## 💻 Como Rodar no Computador / Testar Localmente

Basta abrir o arquivo `index.html` diretamente em qualquer navegador moderno (Chrome, Edge, Brave, Firefox) ou iniciar um servidor local com Node.js:

```bash
# Iniciar servidor local rápido:
npx serve .
# Ou com python:
python -m http.server 8080
```
Depois, acesse pelo navegador: `http://localhost:8080`
