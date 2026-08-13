# Summon X — Arena Rework

Esta versão substitui os antigos modos **Duelo 3v3** e **Modo YGO** por uma arena em tempo real inspirada na estrutura de jogos como Clash Royale, mas com identidade própria do Summon X.

## Arquivos

- `index.html` — estrutura da interface.
- `styles.css` — visual, responsividade e animações.
- `app.js` — rolagem, coleção, deck, loja e batalha.
- `README.md` — este guia.

## O que foi preservado

O sistema de rolar 5 personagens e salvar até 2 continua sendo a principal forma de obter cartas.

A versão também preserva as mesmas chaves do `localStorage` do site anterior:

- moedas: `dc`
- coleção: `dcoll`

Assim, ao substituir o site atual por esta versão no mesmo domínio, a coleção já salva no navegador continua disponível.

## Fontes de personagens

- AniList GraphQL: fonte principal.
- Jikan: fallback se a AniList não retornar personagens suficientes.

As APIs são usadas para **nome, imagem e universo**. Os atributos de combate são gerados de forma determinística no próprio Summon X para que o jogo não dependa da API durante a batalha.

## Novo combate

- Deck com 8 cartas.
- Mão com 4 cartas + próxima carta.
- Estamina de 0 a 10.
- Recarga automática e aceleração no último minuto.
- 2 torres laterais + 1 torre principal por lado.
- Duas rotas e pontes.
- Invocação por arrastar/soltar.
- Tropas andam, escolhem alvos e atacam automaticamente.
- Torres atacam inimigos no alcance.
- Bot joga cartas usando a mesma Estamina.
- Vitória por torre principal ou vantagem ao fim do tempo.
- Moedas por vitória.
- Layout pensado primeiro para celular.

## Como colocar no GitHub Pages

Substitua o `index.html` antigo e adicione `styles.css` e `app.js` na raiz do repositório.

Estrutura:

```text
SummonX/
├── index.html
├── styles.css
├── app.js
└── README.md
```

Depois de fazer commit/push na branch que o GitHub Pages usa, a atualização passa a ser servida no mesmo endereço.

## Próximas evoluções recomendadas

A arena desta versão é uma base funcional em JavaScript/DOM. Para evoluir para animações de sprites complexas, dezenas de unidades simultâneas, efeitos avançados e multiplayer competitivo, a próxima etapa ideal é mover somente o motor da arena para Phaser, mantendo o menu/coleção em HTML/CSS.

Para multiplayer real, será necessário um backend autoritativo (por exemplo Supabase Realtime + Edge Functions, Colyseus, Nakama ou servidor Node/WebSocket). Não é seguro fazer PvP competitivo confiando apenas no JavaScript do navegador.


## Correção da página branca (13/08/2026)

Foi detectado que o `styles.css` publicado no repositório estava vazio. Esta versão inclui novamente o CSS completo e adiciona cache-busting e leitura segura do localStorage.

Na raiz da branch `main`, mantenha `index.html`, `styles.css`, `app.js` e `README.md`. Em Settings > Pages, use `main` e `/(root)`.
