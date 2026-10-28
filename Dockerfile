# PRD v3 §6.1 — multi-stage: o Node só existe para construir. A imagem final
# carrega apenas o dist/ servido pelo nginx, sem node_modules, sem código-fonte
# e sem histórico do Git (§8.5, T30).

# ---------- build ----------
FROM node:20-alpine AS build

WORKDIR /app

# package*.json antes do resto: enquanto as dependências não mudarem, o Docker
# reaproveita a camada do npm ci, que é a etapa cara.
COPY package*.json ./
RUN npm ci

COPY . .

# ATENÇÃO — a pegadinha nº 1 de Vite em Docker (§6.2):
# VITE_API_URL é BUILD-TIME, não runtime. O Vite substitui
# import.meta.env.VITE_API_URL pelo valor literal dentro do bundle durante o
# build. Passar a variável no `docker run -e` NÃO tem efeito algum: o valor já
# está compilado no JavaScript. Por isso ela entra como ARG e precisa ser
# fornecida no `docker build --build-arg`.
#
# Não há segredo aqui: toda variável VITE_* vira texto público no bundle (§7.3
# do v2). Só coloque nela o que pode ser lido por qualquer visitante.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_BASE_PATH=/chat/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

# Falhar cedo e com mensagem clara. Sem isto, o build "passa" e o erro só
# aparece no navegador do usuário, como uma tela branca.
RUN test -n "$VITE_API_URL" || (echo "ERRO: faltou --build-arg VITE_API_URL=<url>. Veja o README." && exit 1)

RUN npm run build

# ---------- runtime ----------
FROM nginx:alpine AS runtime

# O bundle referencia os assets no subdiretório público /chat/
COPY --from=build /app/dist /usr/share/nginx/html/chat
RUN ln -s /usr/share/nginx/html/chat /usr/share/nginx/html/chat-dev && \
    ln -s /usr/share/nginx/html/chat /usr/share/nginx/html/MEJ-AI-INTERFACE

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

# A imagem base do nginx traz uma página de exemplo na raiz; ela não faz parte
# do projeto e só serviria para confundir quem inspecionar o contêiner.
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
