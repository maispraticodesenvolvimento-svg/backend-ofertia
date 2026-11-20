# Ofertia Backend

Backend independente em Next.js com Firebase Authentication (validação de ID tokens) e Firebase Realtime Database.

## Preparação

1. Instale Node.js 20.9 ou superior e as dependências com `npm install`.
2. No Firebase Console, habilite Authentication e crie um Realtime Database.
3. Gere uma chave de conta de serviço em **Configurações do projeto → Contas de serviço**.
4. Copie as informações para `.env`. Preserve os `\n` da chave privada como estão no exemplo.
5. Inicie com `npm run dev`.

O `.env` é local e ignorado pelo Git. Use `.env.example` como referência; não compartilhe a chave privada.

## Rotas iniciais

- `GET /api/health` — verifica o servidor e a conexão com o Realtime Database.
- `GET /api/auth/me` — valida o ID token enviado em `Authorization: Bearer <token>` e retorna o UID/e-mail.
- `POST /api/auth/profile` — cria o perfil inicial de comprador ou atualiza dados da conta.
- `POST /api/media` — salva uma imagem Base64 em `media/banners` ou `media/products` no Realtime Database. Requer administrador.
- `GET/POST /api/products` e `GET/PUT/DELETE /api/products/:id` — catálogo público e gerenciamento administrativo.
- `GET/POST /api/orders` — pedidos do usuário autenticado; administradores consultam todos com `?all=true`.
- `GET/POST /api/negotiations` — ofertas e negociações autenticadas.
- `GET /api/notifications` e `PATCH/DELETE /api/notifications/:id` — notificações da conta autenticada.
- `GET /api/banners` — banners publicados na vitrine.
- `/api/admin/summary`, `/api/admin/settings` e `/api/users` — dados administrativos, protegidos por papel de administrador.

O middleware permite chamadas do Flutter Web em `localhost`/`127.0.0.1` e da origem fixa definida em `FRONTEND_ORIGIN`.

## Estrutura do Realtime Database

- `products/{id}`: nome, categoria, descrição, preço, preço anterior, estoque, status, destaque, ID da imagem e datas.
- `media/products/{id}` e `media/banners/{id}`: conteúdo Base64, tipo MIME, autor e data.
- `users/{uid}`: e-mail, papel (`buyer`, `vendor` ou `admin`), notificações e datas.
- `orders/{id}` e `negotiations/{id}`: registros associados ao UID autenticado.
- `settings`: configuração geral, pagamentos e notificações da plataforma.

O Flutter não acessa o banco diretamente; todas as leituras e gravações passam pela API. Aplique [database.rules.json](./database.rules.json) nas regras do Realtime Database para bloquear acesso direto dos clientes. O Admin SDK do servidor usa a conta de serviço e não é limitado pelas regras do cliente.

Para habilitar administração, crie uma conta pelo app e, no Realtime Database, defina `users/{uid}/role` como `admin`. Novas contas recebem automaticamente o papel `buyer`; o aplicativo nunca concede papel administrativo no cadastro.

Exemplo do corpo de `POST /api/media`:

```json
{
  "collection": "banners",
  "dataUrl": "data:image/png;base64,iVBORw0KGgo..."
}
```

O endpoint aceita JPEG, PNG, WebP e GIF, com limite padrão de 8 MB por imagem (ajustável em `MEDIA_MAX_SIZE_MB`). O cliente Flutter deve autenticar com Firebase Authentication e enviar o ID token obtido após o login como Bearer token.
"# backend-ofertia" 
"# backend-ofertia" 
"# backend-ofertia" 
