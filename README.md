# Boletim de Resultados — Futebol

App em Next.js que busca dados **ao vivo** na football-data.org (resultados, tabela e próximas
partidas) e calcula estimativas próprias de vitória e gols esperados a partir do histórico da
temporada. Tem um botão que gera automaticamente o ranking dos jogos com maior vantagem estimada
para um dos times.

## Por que precisa rodar um servidor (e não só abrir um HTML)

A API da football-data.org bloqueia chamadas diretas do navegador (CORS) e exige uma chave
secreta. Por isso este projeto tem uma rota de servidor (`app/api/league/[code]/route.js`) que
guarda sua chave em uma variável de ambiente e repassa os dados pro front-end. A chave nunca fica
exposta no navegador.

## Como rodar localmente

1. Tenha o [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).
2. Crie uma conta gratuita em https://www.football-data.org/client/register e copie sua chave (token).
3. Nesta pasta, instale as dependências:
   ```
   npm install
   ```
4. Copie o arquivo de exemplo e cole sua chave:
   ```
   cp .env.local.example .env.local
   ```
   Abra `.env.local` e substitua `cole_sua_chave_aqui` pela sua chave real.
5. Rode o servidor de desenvolvimento:
   ```
   npm run dev
   ```
6. Abra http://localhost:3000 no navegador.

## Como publicar de graça (Vercel)

1. Crie uma conta em https://vercel.com (dá pra usar login do GitHub).
2. Suba esta pasta para um repositório no GitHub.
3. Na Vercel, clique em "Add New Project", selecione o repositório.
4. Em "Environment Variables", adicione `FOOTBALL_DATA_API_KEY` com sua chave.
5. Clique em "Deploy". Em ~1 minuto o app estará no ar com um link público.

## Limites a saber

- Plano gratuito da football-data.org: 10 requisições por minuto, 12 competições, placares com
  um pequeno atraso (não é "ao vivo, segundo a segundo").
- Escanteios, cartões e odds **não existem** no plano gratuito — por isso não aparecem no app.
  As "estimativas de vitória" e "gols esperados" são calculadas por nós a partir da tabela de
  classificação (pontos por jogo e saldo de gols), não são dados oficiais nem odds de mercado.
- As estimativas são só um indicador estatístico simples — não são garantia de resultado.

## Estrutura

```
app/
  page.js                     → tela principal (React, client-side)
  layout.js, globals.css      → layout e estilos
  api/league/[code]/route.js  → rota de servidor que chama a football-data.org
lib/
  model.js                    → cálculo de probabilidade e gols esperados
```
