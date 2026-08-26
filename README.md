# Chat Inova — Interface

Interface web do Chat Inova, assistente treinado com informações da Universidade
Federal do Ceará para responder dúvidas sobre o Movimento Empresa Júnior.

React + TypeScript + Vite, CSS puro com tokens extraídos do Figma.

## Rodando localmente

```bash
npm install
cp .env.example .env   # e preencha VITE_API_URL
npm run dev            # http://localhost:5173/
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento, servido na raiz (`/`) |
| `npm run build` | Type-check (`tsc -b`) + build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` já no subdiretório `/MEJ-AI-INTERFACE/` |
| `npm run lint` | oxlint |

### Variáveis de ambiente

Só existe uma, `VITE_API_URL`:

- **Desenvolvimento:** `/api` — usa o proxy definido no `vite.config.ts`, que
  encaminha para o backend e evita CORS na máquina local.
- **Produção:** a URL absoluta, injetada pelo GitHub Actions no momento do build.

> ⚠️ Toda variável com prefixo `VITE_` é **embutida no bundle** e fica visível no
> DevTools de qualquer visitante. Nunca coloque chave, token ou credencial ali.
> Se o backend passar a exigir autenticação, ela precisa ser intermediada por um
> serviço server-side — o token não pode viver no front.

## Docker

```bash
docker build --build-arg VITE_API_URL=https://projetopdi.atlab.ufc.br/api -t mej-ia .
docker run -p 8080:80 mej-ia
# http://localhost:8080/  -> redireciona para /MEJ-AI-INTERFACE/
```

Ou, com o `docker-compose.yml` que já traz o argumento preenchido:

```bash
docker compose up --build
```

> ⚠️ **`VITE_API_URL` é build-time, não runtime.** O Vite substitui
> `import.meta.env.VITE_API_URL` pelo valor literal **dentro do bundle** durante
> o `npm run build`. Passar a variável no `docker run -e VITE_API_URL=...`
> **não tem efeito nenhum** — o valor já está compilado no JavaScript. Ela
> precisa entrar no `docker build --build-arg`, e trocá-la exige reconstruir a
> imagem. Este é o erro nº 1 de quem sobe Vite em Docker.
>
> O `Dockerfile` falha explicitamente se o argumento não for passado, em vez de
> gerar um bundle quebrado que só dá erro no navegador do usuário.

### Por que a aplicação roda em `/MEJ-AI-INTERFACE/` e não na raiz

O `base` do `vite.config.ts` é embutido no build: o `index.html` gerado aponta
para `/MEJ-AI-INTERFACE/assets/...` em caminho **absoluto**. Servir na raiz
devolveria 404 em todos os assets. Manter o mesmo subdiretório do GitHub Pages
tem um bônus: a imagem se comporta como a produção.

### Notas do `nginx.conf`

- **Sem fallback de SPA.** A aplicação não tem rotas internas, então
  `try_files` termina em `=404` e não em `/index.html`. Com o fallback, todo
  caminho inexistente devolveria o app e a página 404 jamais apareceria.
- **`add_header` não é herdado.** No nginx, um `location` que declara qualquer
  `add_header` próprio descarta os do `server`. Por isso os cabeçalhos de
  segurança vivem em `security-headers.conf` e são incluídos em cada bloco que
  tem header próprio — senão as respostas HTML sairiam sem eles.
- **CSP em `Report-Only`.** Conforme a §8.5 do PRD, ela não bloqueia nada ainda.
  Antes de promover para `Content-Security-Policy`, confirme que `connect-src`
  cobre o host de `VITE_API_URL`.

## Deploy

Automático via GitHub Actions (`.github/workflows/`) a cada push na `main`.
O site é servido em subdiretório, então `base` no `vite.config.ts` é
`/MEJ-AI-INTERFACE/` no build **e no preview**. Por isso os assets são sempre
referenciados por `import`, nunca por string de caminho absoluto montada em
runtime — só assim o Vite reescreve os caminhos para o subdiretório.

---

## Pendências de infraestrutura

As duas seções abaixo **não são corrigíveis no front-end**. Estão registradas
aqui para não se perderem.

### 1. CORS — bloqueio ativo em produção

Em produção o front roda em `https://lemossilveira.github.io` e a API em
`https://projetopdi.atlab.ufc.br`. As requisições falham com `Failed to fetch`
porque o backend não devolve o cabeçalho de origem permitida.

O front já está correto: usa a URL absoluta em produção e não depende do proxy
do Vite (que só existe em dev). O erro é tratado e mostrado ao usuário em
português, com botão de "Tentar novamente", sem vazar detalhe técnico na tela.

**O backend precisa devolver:**

```
Access-Control-Allow-Origin: https://lemossilveira.github.io
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Precisa responder também ao *preflight* `OPTIONS` de `/junior_stream`.

Não contornar com proxy público de terceiros nem com `mode: 'no-cors'` — o
segundo torna a resposta ilegível e quebraria o streaming.

### 2. Content-Security-Policy

O GitHub Pages **não permite cabeçalhos HTTP customizados**, então não há como
aplicar CSP hoje. Quando houver controle do servidor (ou um CDN à frente),
recomenda-se:

```
Content-Security-Policy:
  default-src 'self';
  connect-src 'self' https://projetopdi.atlab.ufc.br;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self'
```

Simular via `<meta http-equiv>` não foi feito de propósito: a versão em `<meta>`
ignora várias diretivas (`frame-ancestors` entre elas) e dá falsa sensação de
proteção.

## Segurança

A resposta da IA vem de um servidor remoto e é tratada como **dado não
confiável**. O que está implementado:

- Markdown renderizado por `react-markdown` **sem** `rehype-raw`; HTML embutido
  na resposta é escapado como texto. Nenhum uso de `dangerouslySetInnerHTML`.
- URLs de links e imagens passam por allowlist de protocolo (`http:`, `https:`,
  `mailto:`). `javascript:`, `data:`, `vbscript:`, `file:` e `blob:` são
  descartados e o link vira texto inerte.
- Todo link externo leva `rel="noopener noreferrer"`; os vindos da resposta da
  IA levam também `nofollow`.
- Mensagens de erro na UI são genéricas: URL da API, corpo bruto da resposta e
  stack traces nunca chegam à tela.
- Entrada limitada a 2000 caracteres, com contador; envios simultâneos na mesma
  conversa são bloqueados.

`src/services/api.ts` é a única porta de entrada para a API e não deve ser
alterado sem necessidade.
