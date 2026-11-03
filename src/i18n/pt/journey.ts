// Region Journey: game choice, the chapter map, what each chapter locks and the moments between chapters.

const journey = {
  name: 'Jornada por Regiões',
  world: 'Mundo',

  track: {
    label: 'Modo de jogo',
    journey: { name: 'Jornada por Regiões', desc: 'Região por região, como no anime: novo inicial, novo time e só Pokémon daquela geração.' },
    classic: { name: 'Clássico', desc: 'Todos os Pokémon liberados desde o começo. O jogo de sempre, com o seu progresso de sempre.' },
    separate: 'Cada modo tem o seu próprio progresso: trocar de modo não apaga nada.',
    switchTo: (name: string) => `Jogar ${name}`,
    switchTitle: (name: string) => `Trocar para ${name}?`,
    switchText: 'Seu progresso neste modo fica salvo e continua de onde parou quando você voltar.',
    switchConfirm: 'Trocar de modo',
  },

  map: {
    nav: 'Jornada',
    title: 'Sua jornada',
    sub: 'Vença a Liga de uma região para abrir a próxima. Você pode voltar às regiões anteriores quando quiser para treinar e ganhar dinheiro.',
    label: 'Capítulos da jornada',
    here: 'Você está aqui',
    cleared: 'Campeão',
    inProgress: 'Em andamento',
    notStarted: 'Pronta para começar',
    lockedBy: (previous: string) => `Vença a Liga de ${previous} para abrir`,
    start: (name: string) => `Começar ${name}`,
    travel: (name: string) => `Viajar para ${name}`,
    badges: (count: number, total: number) => `${count}/${total} insígnias`,
    dex: (caught: number, total: number) => `Pokédex ${caught}/${total}`,
    titles: (count: number) => (count === 1 ? '1 título' : `${count} títulos`),
    starter: 'Inicial',
    worldDesc: 'Todas as Pokédex juntas, com tudo o que só existe aqui:',
    worldUnlocks: ['Liga Mestra', 'Torre Infinita', 'Ranqueada com o Ash', 'Todos os Pokémon no mesmo time'],
    shared: 'Viaja com você: dinheiro, itens e cartas. Fica em cada região: o time, os times salvos e o inicial.',
    traveling: (name: string) => `Viajando para ${name}…`,
    runBlocked: 'Você está no meio de uma Liga: termine ou desista dela para viajar.',
    failed: 'Não foi possível viajar agora. Tente de novo.',
  },

  // Chapter chip in the header.
  chip: (name: string) => `Região atual: ${name}. Abrir a jornada`,

  complete: {
    title: (name: string) => `Campeão de ${name}!`,
    next: (name: string) => `${name} está aberta. Lá você começa de novo: novo inicial, novo time e só Pokémon de ${name}. Seu dinheiro e seus itens vão com você.`,
    world: 'O Mundo está aberto: todas as Pokédex juntas, a Liga Mestra, a Torre Infinita e a Ranqueada com o Ash.',
    go: (name: string) => `Ir para ${name}`,
    stay: 'Ficar aqui por enquanto',
  },

  onboarding: {
    // The first chapter uses the usual welcome; these replace its lines where the Journey differs.
    intro: (name: string, total: number) => [
      `Ah, um rosto novo no laboratório! Toda grande jornada começa com um parceiro, e a sua começa em ${name}.`,
      `Por aqui, cada Poké Ball pode trazer qualquer um dos ${total} Pokémon de ${name}. Vença a Liga e o resto do mundo se abre.`,
    ],
    introNext: (name: string, total: number) => [
      `Bem-vindo a ${name}! Seus Pokémon ficam em boas mãos enquanto você recomeça aqui.`,
      `Nesta região você só encontra e usa os ${total} Pokémon de ${name}. Escolha um parceiro e parta para a primeira insígnia.`,
    ],
    chooseSub: (name: string) => `Três parceiros de ${name}. Ele começa no nível 5 e é o primeiro membro do seu novo time.`,
    // Later chapters skip the tips: the player already knows the game.
    capturesTip: (price: string) => ({
      title: 'Cada captura conta',
      text: `Uma Poké Ball custa ${price}, e a região se abre aos poucos: cada insígnia traz novos Pokémon. Treine, vença ginásios e volte para capturar.`,
    }),
    pickedSubNext: 'Nova região, nova dupla. Vamos capturar o resto da equipe?',
  },

  // Why a Battle mode isn't available in this chapter.
  locked: {
    world: 'Abre no Mundo',
    worldToast: 'Isto só existe no Mundo: vença a Liga de todas as regiões para chegar lá.',
    gymsInRegions: 'Os ginásios ficam nas regiões',
    gymsToast: 'O Mundo não tem ginásios: viaje para uma região para desafiar os líderes dela.',
  },

  // Where Classic's texts talk about every region, or about levels and prizes that work differently here.
  hub: {
    gyms: 'Enfrente os Líderes de Ginásio da região, em ordem.',
    gymsSub: 'Os Líderes de Ginásio da região, em ordem. Cada insígnia libera o próximo desafio.',
    league: 'Quatro duelos eliminatórios pelo título de Campeão da região.',
    leagueWorld: 'A Liga Mestra: só cartas normais no Nv. 100, para quem já venceu todas as Ligas.',
  },

  league: {
    hero: 'Um treinador de elite, dois membros da Elite dos Quatro e o Campeão. O título abre o próximo capítulo da sua jornada.',
    prizeFirstTitle: 'Primeiro título: o seu inicial shiny, sem limite de nível',
    firstTitle: 'Primeiro título! Seu inicial shiny chegou, sem limite de nível.',
  },

  capture: {
    regionFixed: (name: string, open: number, total: number) => (open < total
      ? `Em ${name}, as capturas trazem ${open} dos ${total} Pokémon da região. Cada insígnia abre mais.`
      : `Em ${name}, as capturas trazem todos os ${total} Pokémon da região.`),
  },

  collection: {
    regionDex: (name: string) => `Pokédex de ${name}`,
    laterChapter: 'Esta evolução é de outra região: ela aparece no Mundo.',
  },

  hunt: {
    otherRegion: 'Esta espécie é de outra região: viaje até lá para caçá-la.',
    targetAway: (name: string) => `Sua caçada a ${name} continua na região dele.`,
  },
};

export default journey;
