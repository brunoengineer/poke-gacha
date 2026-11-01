// Textos em português do namespace "capture" (tela de Captura, Poké Mart, presente diário e boas-vindas).
// Funções recebem parâmetros (contagens, nomes).
const n = (value: number) => value.toLocaleString('pt-BR');
const plural = (value: number, one: string, many: string) => `${n(value)} ${value === 1 ? one : many}`;

const capture = {
  title: 'Capturar',
  subtitle: 'Arremesse Poké Balls e descubra quem aparece. Cada repetido sobe um nível da carta.',

  tabs: {
    label: 'Seções da captura',
    capture: 'Capturas',
    mart: 'Poké Mart',
  },

  banners: {
    poke: {
      name: 'Poké Ball',
      kicker: 'A clássica',
      text: 'Barata e rápida: perfeita para encher a Pokédex e subir o nível dos repetidos.',
    },
    safari: {
      name: 'Zona Safari',
      kicker: 'Destaques do dia',
      text: '40% das capturas vêm das três famílias em destaque hoje. Ideal para focar numa linha evolutiva.',
    },
    great: {
      name: 'Great Ball',
      kicker: 'Raro garantido',
      text: 'Chances mais equilibradas e um Pokémon Raro ou melhor a cada 10 capturas.',
    },
    ultra: {
      name: 'Ultra Ball',
      kicker: 'Épico garantido',
      text: 'Formas evoluídas e lendários aparecem de verdade. Um Épico ou melhor a cada 10 capturas.',
    },
    master: {
      name: 'Master Ball',
      kicker: 'Lendário garantido',
      text: 'Nunca falha: toda captura traz um Pokémon Lendário ou Mítico.',
    },
  },

  featuredToday: 'Em destaque hoje',
  showcase: 'Pode aparecer',
  shinyRate: (odds: number) => `Shiny 1/${n(odds)}`,
  pity: (left: number, rarity: string) => (left <= 1 ? `Próxima captura: ${rarity} garantido` : `${rarity} garantido em ${plural(left, 'captura', 'capturas')}`),
  owned: (count: number) => `Você tem ${n(count)}`,
  payCoins: 'Com Pokédollars',
  payBalls: (name: string, count: number) => `Com ${name} (você tem ${n(count)})`,
  pullLabel: (count: number, banner: string, cost: string) => `Capturar ${n(count)} na ${banner} por ${cost}`,
  ballCost: (count: number, name: string) => `${n(count)} ${name}`,
  locked: (badges: number) => `Vença ${plural(badges, 'líder de ginásio', 'líderes de ginásio')} para liberar`,
  lockedProgress: (have: number, need: number) => `${n(have)}/${n(need)} insígnias`,
  goGyms: 'Ir aos ginásios',
  masterHint: 'Master Balls são prêmios da Competição e da Liga Pokémon.',
  notEnoughBalls: (name: string) => `Você não tem ${name} suficientes.`,
  bannerLocked: 'Esta captura ainda está bloqueada.',

  odds: {
    title: 'Probabilidades',
    pick: 'Escolha a captura',
    byRarity: 'Por raridade',
    shiny: 'Chance de shiny',
    species: (count: number) => `Ver todos os ${n(count)} Pokémon possíveis`,
    pityNote: (every: number, rarity: string) => `Depois de ${n(every - 1)} capturas seguidas sem um ${rarity} ou melhor, a próxima é garantida.`,
    safariNote: '40% das capturas vêm das famílias em destaque do dia; a tabela abaixo não inclui esse bônus.',
    masterNote: 'Só Pokémon Lendários e Míticos.',
  },

  history: {
    title: 'Capturas recentes',
    empty: 'Suas últimas capturas aparecem aqui.',
  },

  pull: {
    label: 'Resultado da captura',
    revealAll: 'Revelar tudo',
    again: (count: number) => `Capturar ×${n(count)} de novo`,
    revealCard: (index: number) => `Revelar carta ${n(index)}`,
    tagNew: 'NOVO!',
    tagLevel: (from: number, to: number) => `Nv. ${n(from)} → ${n(to)}`,
    tagRoute: (name: string) => `→ ${name}`,
    tagCandy: '+1 Doce Raro',
    newSpecies: 'Nova espécie na Pokédex!',
    shiny: 'Shiny!',
    legendary: 'Lendário!',
    mythical: 'Mítico!',
    canEvolve: (name: string) => `${name} já pode evoluir!`,
    canEvolveMany: (count: number) => `${n(count)} cartas já podem evoluir!`,
    seeCollection: 'Ver na Coleção',
  },

  summary: {
    title: (count: number) => `${n(count)} capturas!`,
    subtitle: (banner: string) => `Resumo da ${banner}`,
    newSpecies: 'Novas espécies',
    levels: 'Níveis ganhos',
    candies: 'Doces Raros',
    shinies: 'Shinies',
    highlights: 'Destaques',
    levelUps: 'Subiram de nível',
    newCard: 'Nova',
    copies: (count: number) => `×${n(count)}`,
    candyNote: (count: number) => `${plural(count, 'cópia de carta no nível máximo virou', 'cópias de cartas no nível máximo viraram')} Doce Raro.`,
    nothingNew: 'Nenhum destaque desta vez, mas todo nível conta!',
  },

  mart: {
    title: 'Poké Mart',
    subtitle: 'Doces Raros sobem o nível de qualquer carta; pedras e o Cabo de Troca fazem Pokémon evoluir.',
    buy: 'Comprar',
    buyTotal: (cost: string) => `Comprar · ${cost}`,
    inBag: (count: number) => `Na mochila: ${n(count)}`,
    quantity: 'Quantidade',
    less: 'Menos',
    more: 'Mais',
    bought: (name: string, count: number) => `Você comprou ${name} ×${n(count)}!`,
  },

  bag: {
    title: 'Mochila',
    empty: 'Sua mochila está vazia. Itens de batalhas, presentes e do Mart aparecem aqui.',
    categories: { ball: 'Poké Balls', candy: 'Doces', evolution: 'Itens de evolução' },
    use: 'Usar',
    useInCollection: 'Usar na Coleção',
  },

  daily: {
    title: 'Presente diário',
    ready: 'Seu presente de hoje está esperando!',
    claim: 'Abrir presente',
    day: (day: number) => `Dia ${n(day)}`,
    streak: (days: number) => `Sequência de ${plural(days, 'dia', 'dias')}`,
    ballEvery: 'Volte todo dia: a cada 7 dias seguidos vem uma Great Ball.',
    claimedTitle: 'Presente recebido',
    tomorrow: (coins: string) => `Amanhã: ${coins}`,
    gotTitle: (day: number) => (day > 1 ? `${n(day)} dias seguidos!` : 'Presente do dia!'),
    gotText: 'Volte amanhã para manter a sequência.',
    trackLabel: (day: number) => `Progresso da semana: dia ${n(day)} de 7`,
  },

  onboarding: {
    label: 'Boas-vindas',
    professor: 'Professor Carvalho',
    intro: [
      'Ah, um rosto novo no laboratório! Eu estava torcendo para alguém aparecer hoje. Estudo cartas Pokémon, e uma ajudinha cairia muito bem.',
      'Por aqui, cada Poké Ball arremessada pode trazer qualquer um dos 151 Pokémon de Kanto. Mas toda grande jornada começa com um parceiro.',
    ],
    next: 'Continuar',
    back: 'Voltar',
    chooseTitle: 'Escolha seu primeiro Pokémon',
    chooseSub: 'Ele começa no nível 5 e será o primeiro da sua equipe.',
    starters: {
      1: 'Tranquilo e resistente. A semente nas costas cresce junto com a amizade de vocês.',
      4: 'Corajoso e cheio de energia. A chama da cauda mostra tudo o que ele sente.',
      7: 'Esperto e brincalhão. Se esconde no casco e responde com jatos de água.',
    } as Record<number, string>,
    choose: (name: string) => `Escolher ${name}`,
    picked: (name: string) => `${name} entrou para a sua equipe!`,
    pickedSub: 'Uma dupla e tanto. Agora, umas dicas rápidas antes de começar.',
    slides: [
      {
        title: 'Capturas são baratas',
        text: 'Uma Poké Ball custa só ₽5. Arremesse dezenas, centenas: é assim que uma coleção nasce.',
      },
      {
        title: 'Repetido = +1 nível',
        text: 'Capturou um Pokémon que já tem? A carta sobe um nível. Se ele já evoluiu, o nível vai para a forma evoluída.',
      },
      {
        title: 'Evoluir é opcional',
        text: 'Evoluções são mais fortes, mas guardam o nível máximo 100. Dizem que formas básicas que nunca evoluíram, e os raríssimos shinies, não têm limite nenhum…',
        secret: 'Mas isso fica só entre nós.',
      },
      {
        title: 'Hora de batalhar',
        text: 'Monte uma equipe de 6 cartas e escolha o desafio:',
      },
    ],
    modes: { training: 'Treino com amigos', competition: 'Competição', gyms: '8 Ginásios', league: 'Liga Pokémon' },
    slideOf: (index: number, total: number) => `Dica ${n(index)} de ${n(total)}`,
    finish: 'Ir capturar!',
    finishNote: (coins: string, balls: number) => `Você começa com ${coins}: dá para ${balls} Poké Balls.`,
  },
};

export default capture;
