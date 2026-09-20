# 🤖 4utoWolves

## Página Ouro

A página Ouro controla a roleta gratuita e exibe giros confirmados, ouro ganho e saldo total. **Iniciar Farm** verifica a disponibilidade, gira quando liberado e aguarda o horário informado pelo jogo. Depois de cada prêmio, espera pelo menos cinco segundos antes de consultar novamente. **Parar Farm** cancela os próximos giros; uma solicitação já enviada pode terminar e será contabilizada. **Girar uma vez** consulta a disponibilidade e solicita apenas um giro, sem ligar o farm.

A execução fica na aba do jogo, continua com o popup fechado e começa desligada após abrir ou recarregar o jogo. Os contadores são da sessão dessa aba. Erros de rede, autenticação, limite, resposta desconhecida ou timeout interrompem o farm sem repetição automática. Após um resultado incerto, confira o jogo antes de tentar novamente.

`lib/gold-farm.js` contém o controlador. `lib/bot-logic.js` integra as chamadas e publica o estado; `popup/gold.js` envia comandos para a mesma aba da qual recebe o estado. A roleta gratuita usa `wheelRewardWithSecret`; a chamada paga `goldenWheelSpin` fica restrita ao botão de rosas. A associação anteriormente invertida foi corrigida. O controlador exige uma resposta de disponibilidade reconhecida (`nextRewardAvailableTime` ou lista `items`), sem considerar respostas desconhecidas como autorização para girar.

Os testes usam respostas simuladas: `node --test tests/gold-farm.test.cjs`. A integração com a API real do jogo ainda precisa ser validada em uso. Textos, estados e números acompanham os quatro idiomas.

## 🚀 Quick Installation

1. Open your browser (Chrome, Brave, Edge, etc.) and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right corner).
3. Click on **Load unpacked**.
4. Select the `4utoWolves` folder.

## 📝 Technical Notes

- **Discord**: [Discord](https://discord.gg/3shH83G64y)

## Interface 4utoWolves / Home

O popup segue o [frame Home do Figma](https://www.figma.com/design/Xi1i4UssoGRGEZfwowyvLr/4utoWolves---Home-UI?node-id=1-2), com tamanho de 400 × 596 px, fundo com o lobo, cartões de resumo e navegação inferior para XP, Ouro, Tools e Settings. Suporte e Informações ficam disponíveis em Settings. A página Informações exibe o nome e lê a versão diretamente do manifesto da extensão.

- `popup/home.css` adapta os estilos existentes à referência.
- `popup/home.js` conecta o resumo e as ações rápidas às mensagens já recebidas do jogo.
- `popup/assets/` contém as imagens, ícones e fontes locais, sem depender das URLs temporárias do Figma.

Nome, XP, Coins e Roses vêm de `UPDATE_UI`. Sem dados recebidos, o resumo mostra `—`. Roses representa o saldo total informado pelo jogo; o protocolo atual não informa quantas rosas foram coletadas na sessão.

Auto Play e Auto Replay alteram as configurações existentes com `SETTING_CHANGE`. A Home aguarda `SETTINGS_UPDATED`/`SETTINGS_LOADED` para confirmar a mudança. O indicador representa a configuração confirmada, não uma verificação de partida em execução. Esta mudança de interface não altera a lógica do jogo.

Auto Play e Auto Replay começam desligados sempre que a página do jogo é aberta ou recarregada, mesmo que as preferências antigas estejam ativadas. É necessário ligá-los manualmente em cada sessão. Fechar e reabrir apenas o popup mantém o estado da sessão atual.

Para ver a nova interface, recarregue a extensão em `chrome://extensions` e reabra o popup. Caso o jogo não responda, recarregue também a aba do Wolvesville.

A aba Tools contém apenas as roletas Gold Wheel e Rose Wheel. A abertura de caixas, Player Aura e Player Notes foram removidos do painel e do motor da extensão. Ao carregar, as configurações antigas são filtradas para manter somente as opções atuais.

## Idiomas do painel

Em Settings / Configurações, o seletor **Idioma da extensão** oferece Português, English, Español e Français. A troca é imediata, começa em português e fica salva localmente no navegador para as próximas aberturas do popup. A tradução abrange navegação, configurações, status, avisos e formatação numérica. Nomes de jogadores, mensagens externas e os nomes Auto Play / Auto Replay são preservados. O idioma do jogo e as regras de licença não são alterados.

As traduções ficam em `popup/i18n.js`, carregado antes dos scripts do painel. A camada acompanha atualizações de texto do popup e reaplica o idioma escolhido, sem enviar comandos ao jogo.


## 1.5.8
- Removed blind top-right ad-control probing that could click the Wolvesville Help (?) button.
- Gold Farm now clicks only ad controls that are actually detected in the DOM.
- Protected cross-origin ad frames are observed instead of receiving guessed coordinate clicks.
