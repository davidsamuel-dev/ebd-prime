# Site web — ebd.adparaiso.com.br (espelho do app)

Objetivo: ao abrir **https://ebd.adparaiso.com.br** no browser, mostrar a mesma aplicação Expo (login, turmas, cadastros, etc.), usando a **mesma API PHP** já publicada em `/api/`.

Requisito de produto: **RF14** (ver `documentacao_ebd_prime.md`).

---

## Arquitetura no domínio

```
ebd.adparaiso.com.br/
├── index.html, login.html, …     ← app web (export Expo)
├── _expo/                          ← JS/CSS do build
├── api/                            ← API PHP (já no ar)
├── lib/, vendor/, .env             ← backend (manter)
```

O telemóvel (APK) e o site partilham `EXPO_PUBLIC_API_URL=https://ebd.adparaiso.com.br`.

---

## 1. Gerar o site no PC

```powershell
cd "c:\EBD Prime\mobile"
```

Confirmar em `mobile/.env`:

```env
EXPO_PUBLIC_DATA_BACKEND=rest
EXPO_PUBLIC_API_URL=https://ebd.adparaiso.com.br
```

Export estático:

```powershell
npx expo export --platform web
```

Saída: pasta **`mobile/dist/`** (HTML por rota + bundles em `_expo/`).

Teste local antes de publicar:

```powershell
npx expo start --web
```

---

## 2. Publicar na Hostinger

1. hPanel → ficheiros → **`public_html`** de `ebd.adparaiso.com.br`.
2. **Não apagar** `api/`, `lib/`, `vendor/`, `.env`.
3. Enviar **todo o conteúdo** de `mobile/dist/` para a **raiz** de `public_html` (ficheiros ao lado de `api/`, não dentro de uma subpasta `dist`).
4. **Remover ou substituir** `backend/index.php` na raiz se ainda existir — hoje redireciona para `/api/health.php` e impede o site de abrir. Opções:
   - Apagar `index.php` (o servidor serve `index.html` primeiro, conforme configuração Apache), ou
   - Trocar por redirecionamento para `/login` (só se necessário).
5. Apagar `default.php` da Hostinger se voltar a aparecer.

---

## 3. Validar

| URL | Esperado |
|-----|----------|
| https://ebd.adparaiso.com.br/login | Ecrã de login do EBD Prime |
| https://ebd.adparaiso.com.br/api/health.php | JSON `"ok": true` |
| Login no browser | Mesmo utilizador MySQL que no app |

---

## 4. Atualizar o site (deploy seguinte)

Sempre que mudar o app:

```powershell
cd mobile
npx expo export --platform web
```

Reenviar apenas o que mudou em `dist/` (ou a pasta inteira), **sem** sobrescrever `.env` do servidor.

Opcional futuro: script `npm run web:export` e pacote `deploy/web-hostinger/`.

---

## 5. Limitações conhecidas (primeira versão web)

- Visual muito próximo do telemóvel; desktop pode precisar de ajustes de largura.
- `expo-secure-store` no browser usa armazenamento web (sessão equivalente).
- Funcionalidades que no app ainda exigem **Firebase** continuam bloqueadas na web — ver `AUDITORIA-FIREBASE.md`.
- Painel **Geral** pode mostrar dados de exemplo até existir endpoint PHP agregado.

---

## 6. Segurança

- Não publicar `mobile/.env` no FTP.
- Variáveis `EXPO_PUBLIC_*` ficam **dentro do JS** gerado no build — só URLs públicas, nunca senhas MySQL.
- Manter HTTPS ativo no subdomínio.

---

## Relacionado

- API: `DEPLOY-HOSTINGER-AGORA.md`
- Estado do projeto: `ESTADO_DO_PROJETO.md`
- Firebase vs MySQL: `AUDITORIA-FIREBASE.md`
