// Textos de Hoenn e Sinnoh: amigos do Treino, líderes de ginásio, insígnias, falas da Liga e os textos de cada Liga.
// Mesclados nos namespaces "battle" (friends, leaders, badgeName, badgeFull) e "modes" (league.lines, league.hoenn,
// league.sinnoh) em pt/battle.ts e pt/modes.ts.

const n = (value: number) => value.toLocaleString('pt-BR');

type LeagueTexts = {
  title: string;
  subtitle: string;
  plateau: string;
  heroText: string;
  lockedTitle: string;
  lockedText: (badges: number) => string;
  prizeFirstTitle: string;
  firstTitle: string;
  championTitle: string;
};

const hoenn: LeagueTexts = {
  title: 'Liga de Hoenn',
  subtitle: 'A Elite dos Quatro de Hoenn e o Campeão Steven. Quatro duelos seguidos; a primeira derrota encerra a campanha.',
  plateau: 'Cidade Ever Grande · Hoenn',
  heroText: 'Sidney, Phoebe, Glacia e Drake guardam o caminho até Steven, o Campeão das pedras raras. Níveis até 120 e o triplo dos prêmios de Kanto. Só lendários e shinies chegam tão longe!',
  lockedTitle: 'A Liga de Hoenn ainda está fechada',
  lockedText: (badges: number) => `Conquiste as 8 insígnias de Hoenn para desafiar a Elite dos Quatro de Hoenn. Você tem ${n(badges)} de 8.`,
  prizeFirstTitle: 'Primeiro título: um inicial de Hoenn, shiny e do mesmo tipo do seu',
  firstTitle: 'Primeiro título em Hoenn! Um inicial shiny de Hoenn chegou para o seu time.',
  championTitle: 'Campeão da Liga de Hoenn!',
};

const master: LeagueTexts = {
  title: 'Liga Master',
  subtitle: 'Todos no Nv. 100, sem shiny, lendário ou mítico. Quatro duelos seguidos; a primeira derrota encerra a campanha.',
  plateau: 'Só para quem venceu as quatro Ligas',
  heroText: 'Blue, Lance, Steven e Cynthia, todos no Nv. 100. Shiny, lendário e mítico não entram no seu time: aqui vence quem monta a melhor equipe. Cada vitória paga em Master Balls, e o título vale um lendário ou mítico shiny.',
  lockedTitle: 'A Liga Master ainda está fechada',
  lockedText: (titles: number) => `Conquiste o título nas quatro Ligas para abrir a Liga Master. Você tem ${n(titles)} de 4.`,
  prizeFirstTitle: '',
  firstTitle: 'Primeiro título da Liga Master! Você é um verdadeiro Mestre Pokémon.',
  championTitle: 'Campeão da Liga Master!',
};

const masterRules = {
  tab: 'Master',
  formerChampion: 'Ex-Campeão',
  entries: 'Entradas hoje',
  enterTitle: 'Entrar na Liga Master?',
  enterText: (fee: number, left: number) => `A inscrição custa ₽ ${n(fee)} e conta como uma das 3 entradas do dia, mesmo se você perder: depois desta, restam ${n(left)} hoje. Quatro duelos seguidos, e a primeira derrota encerra a campanha. Seu time fica inscrito durante toda a campanha, e o HP não se recupera entre os duelos: antes de cada duelo você recebe 1 Reviver e 3 Poções.`,
  healTitle: (revives: number, potions: number) => `Entre os duelos: ${n(revives)} Reviver e ${n(potions)} Poções.`,
  healText: (revive: number) => `Uma Poção cura um Pokémon por completo, e um Reviver traz de volta um desmaiado com ${n(revive)}% de HP. O que sobrar não passa para o próximo duelo.`,
  noEntries: (total: number) => `Você já usou as ${n(total)} entradas de hoje. Volte amanhã!`,
  banned: (names: string) => `Shiny, lendário e mítico não entram na Liga Master. Tire do time: ${names}.`,
  shinyName: (name: string) => `${name} shiny`,
  win: (index: number) => `${n(index)}ª vitória`,
  winTitle: 'Prêmio da vitória',
  shinyPrize: 'E um lendário ou mítico shiny que você ainda não tem (1 por dia)',
  shinyPrizeTaken: 'O lendário ou mítico shiny de hoje já é seu. Volte amanhã!',
};

const sinnoh: LeagueTexts = {
  title: 'Liga de Sinnoh',
  subtitle: 'A Elite dos Quatro de Sinnoh e a Campeã Cynthia. Quatro duelos seguidos; a primeira derrota encerra a campanha.',
  plateau: 'Liga Pokémon de Sinnoh',
  heroText: 'Aaron, Bertha, Flint e Lucian guardam o caminho até Cynthia, a Campeã de Sinnoh. Níveis até 140 e o quádruplo dos prêmios de Kanto. Só míticos e shinies chegam tão longe!',
  lockedTitle: 'A Liga de Sinnoh ainda está fechada',
  lockedText: (badges: number) => `Conquiste as 8 insígnias de Sinnoh para desafiar a Elite dos Quatro de Sinnoh. Você tem ${n(badges)} de 8.`,
  prizeFirstTitle: 'Primeiro título: um inicial de Sinnoh, shiny e do mesmo tipo do seu',
  firstTitle: 'Primeiro título em Sinnoh! Um inicial shiny de Sinnoh chegou para o seu time.',
  championTitle: 'Campeão da Liga de Sinnoh!',
};

const regions = {
  friends: {
    // Hoenn
    ruinmaniac: {
      title: 'Maníaco por Ruínas',
      intro: 'Passei a semana cavando no deserto. Achei um Baltoy e meio quilo de areia nas botas. Bora batalhar?',
      win: 'Ha! Força de quem passa o dia inteiro carregando pedra!',
      lose: 'Tudo bem… Pelo menos voltei para casa com um fóssil novo.',
    },
    aromalady: {
      title: 'Dama dos Aromas',
      intro: 'Sente esse perfume? É a minha Roselia. Os aromas acalmam… até a hora do ataque.',
      win: 'Um perfume que fica no ar. Assim como a minha vitória.',
      lose: 'Que pena… Pelo menos o jardim continua cheiroso.',
    },
    ninjaboy: {
      title: 'Garoto Ninja',
      intro: 'Você nem me viu chegar! Meu Nincada treina para ser o mais rápido de Hoenn!',
      win: 'Rápido demais para você! Nem deu tempo de piscar.',
      lose: 'Ugh… Um ninja sabe a hora de sumir. Puf!',
    },
    tuber: {
      title: 'Garoto da Boia',
      intro: 'Eu e meu Wailmer passamos o dia na praia de Slateport. Agora é hora de batalhar!',
      win: 'Uhuul! Splash da vitória!',
      lose: 'Ah… Vou voltar para a boia e pensar na vida.',
    },
    shelly: {
      title: 'Administradora da Equipe Aqua',
      intro: 'O mar precisa de mais espaço, e você está no caminho! A Equipe Aqua não recua!',
      win: 'A maré sempre sobe para a Equipe Aqua!',
      lose: 'Argh! O chefe não pode saber disso. Todo mundo de volta para o submarino!',
    },
    wally: {
      title: 'Amigo',
      intro: 'Eu e o Ralts crescemos juntos. Não sou mais aquele menino frágil… Quero te mostrar isso!',
      win: 'Conseguimos! Você viu? Nós vencemos!',
      lose: 'Ainda não deu… Mas cada batalha me deixa mais forte. Obrigado!',
    },
    birch: {
      title: 'Professor Pokémon',
      intro: 'Pesquisa de campo é comigo! Passo mais tempo no mato do que no laboratório. Vamos batalhar!',
      win: 'Ótimo! Anotado: Pokémon criados na natureza são fortíssimos.',
      lose: 'Ha ha! Você me pegou. Vou ter que voltar para o mato e treinar mais.',
    },
    lisia: {
      title: 'Estrela dos Concursos',
      intro: 'Luzes, plateia e muito brilho! Eu e a Altaria vamos transformar esta batalha num espetáculo!',
      win: 'E a plateia vai à loucura! Obrigada, obrigada!',
      lose: 'Que performance a sua! Você roubou a cena hoje.',
    },
    wallace: {
      title: 'Mestre dos Concursos',
      intro: 'Uma batalha também é uma arte. Permita que eu e a minha Milotic mostremos a beleza da água.',
      win: 'Elegância e força na mesma onda. Foi um prazer.',
      lose: 'Magnífico! Seu time tem um brilho que nenhum concurso ensina.',
    },
    may: {
      title: 'Rival',
      intro: 'Ei! O papai me mandou registrar Pokémon pela região, mas batalhar com você é bem mais divertido!',
      win: 'Isso! Vou contar tudo para o papai lá no laboratório!',
      lose: 'Uau, você treinou mesmo! Na próxima eu venço, pode apostar.',
    },
    // Sinnoh
    youngster4: {
      title: 'Garoto',
      intro: 'Todo mundo ri do meu Bidoof, mas ele é o Pokémon mais esforçado de Sinnoh! Vem!',
      win: 'Viu só? Bidoof é puro esforço!',
      lose: 'Tudo bem, Bidoof… Amanhã a gente treina mais um pouco na Rota 201.',
    },
    skier: {
      title: 'Esquiadora',
      intro: 'Desci a montanha de Snowpoint só para isso! Meu Snover está doido para batalhar.',
      win: 'Deslizei direto para a vitória!',
      lose: 'Brrr… Acho que levei um tombo na neve.',
    },
    mars: {
      title: 'Comandante da Equipe Galáctica',
      intro: 'A Equipe Galáctica vai criar um mundo novo. Mas antes, deixa eu me divertir um pouco com você!',
      win: 'Hah! Fácil demais. O chefe vai adorar saber disso.',
      lose: 'Que irritante! Isso não muda nada nos planos da Equipe Galáctica.',
    },
    cheryl: {
      title: 'Treinadora Gentil',
      intro: 'Ah, olá… Meus Pokémon adoram conhecer gente nova. Vamos ter uma batalha tranquila?',
      win: 'Oh, ganhamos! Meus Pokémon estão tão felizes…',
      lose: 'Que batalha bonita. Dá para ver que seus Pokémon são muito bem cuidados.',
    },
    riley: {
      title: 'Mestre da Aura',
      intro: 'Meu parceiro sente a sua aura. Ela é forte… e inquieta. Vamos ver o que ela esconde.',
      win: 'A aura não mente. Hoje a nossa estava mais firme.',
      lose: 'Sua aura brilhou mais forte. Continue treinando assim.',
    },
    mira: {
      title: 'Garota Psíquica',
      intro: 'A Mira se perdeu de novo… mas achou você! Vamos batalhar, vamos?',
      win: 'Eba! A Mira ganhou!',
      lose: 'Ah… A Mira vai treinar mais. Depois a gente batalha de novo?',
    },
    buck: {
      title: 'Aventureiro',
      intro: 'Hehe! Vim treinar na Ilha Stark e achei você no caminho. Bora esquentar as coisas!',
      win: 'Heh! Quente demais para você, né?',
      lose: 'Uau! Vou contar para a minha avó que encontrei alguém forte de verdade.',
    },
    dawn: {
      title: 'Amiga',
      intro: 'Oi! Eu e o Piplup ensaiamos uns golpes novos. Topa testar com a gente?',
      win: 'Isso! O Piplup arrasou!',
      lose: 'Ah, poxa! Mas foi uma batalha linda, né?',
    },
    rowan: {
      title: 'Professor Pokémon',
      intro: 'Estudo a evolução há décadas. Estes pequenos vão mostrar o quanto se pode crescer. Prepare-se.',
      win: 'Hmph. Evoluir exige tempo e dedicação. Você ainda tem caminho pela frente.',
      lose: 'Hm. Seus Pokémon evoluíram de forma admirável. Continue assim.',
    },
    barry: {
      title: 'Rival',
      intro: 'Ei! Até que enfim! Eu já ia começar sem você. Batalha, agora, já!',
      win: 'Viu?! Rápido e forte! Eu disse que ia ganhar!',
      lose: 'Ahh! Não acredito! Revanche! Agora! …Tá, depois. Mas logo!',
    },
  } as Record<string, { title: string; intro: string; win: string; lose: string }>,

  leaders: {
    // Hoenn
    roxanne: {
      city: 'Rustboro',
      intro: 'Estudei tudo sobre batalhas na Escola de Treinadores. Agora vou colocar a teoria em prática!',
      win: 'Exatamente como nos livros. Revise a matéria e volte.',
      lose: 'Isso não estava em nenhum livro… A Insígnia da Pedra é sua!',
    },
    brawly: {
      city: 'Dewford',
      intro: 'E aí! Eu pego onda e bato forte. Vamos ver se você aguenta a arrebentação!',
      win: 'Caiu da prancha! Volte quando tiver mais equilíbrio.',
      lose: 'Que onda! Você mereceu a Insígnia do Punho, parceiro.',
    },
    wattson: {
      city: 'Mauville',
      intro: 'Wahahaha! Este velho adora uma faísca! Vamos ver se você tem energia de sobra!',
      win: 'Wahaha! Isso foi um choque de realidade!',
      lose: 'Wahahaha! Que carga! Leve a Insígnia do Dínamo!',
    },
    flannery: {
      city: 'Lavaridge',
      intro: 'Assumi o ginásio faz pouco tempo, mas o meu fogo já está no ponto! Prepare-se para o calor!',
      win: 'Viu? Posso ser nova aqui, mas quem se queimou foi você!',
      lose: 'Ai, ai… Você esfriou a minha chama. A Insígnia do Calor é sua!',
    },
    norman: {
      city: 'Petalburg',
      intro: 'Como líder e como pai, sei que a força de verdade vem do equilíbrio. Mostre o seu.',
      win: 'Falta equilíbrio no seu time. Treine e volte.',
      lose: 'Você me superou com justiça. Leve a Insígnia do Equilíbrio com orgulho.',
    },
    winona: {
      city: 'Fortree',
      intro: 'Eu e meus Pokémon voadores dançamos com o vento. Será que você acompanha o nosso voo?',
      win: 'O céu é imenso, e você ainda não abriu as asas.',
      lose: 'Que voo lindo o seu. A Insígnia da Pena é sua.',
    },
    'tate-liza': {
      city: 'Mossdeep',
      intro: '— Somos gêmeos! — E pensamos juntos! — Você consegue vencer duas mentes ao mesmo tempo?',
      win: '— Vencemos! — Como a gente previu! — Juntos somos imbatíveis!',
      lose: '— Perdemos… — Mas foi justo! — Fique com a Insígnia da Mente!',
    },
    juan: {
      city: 'Sootopolis',
      intro: 'Bem-vindo ao meu ginásio. Uma batalha deve ser elegante como a água. Mostre-me a sua arte.',
      win: 'Faltou graça aos seus movimentos. Volte quando a água fluir em você.',
      lose: 'Formidável! Sua batalha teve a beleza de uma chuva de verão. A Insígnia da Chuva é sua.',
    },
    // Sinnoh
    roark: {
      city: 'Oreburgh',
      intro: 'Acabei de sair da mina, ainda de capacete! Meus fósseis vão mostrar a força de milhões de anos.',
      win: 'Pedra dura não quebra fácil! Cave mais fundo e volte.',
      lose: 'Uau, você atravessou a rocha! A Insígnia do Carvão é sua.',
    },
    gardenia: {
      city: 'Eterna',
      intro: 'Adoro Pokémon de planta! E adoro ainda mais ganhar com eles. Vamos nessa!',
      win: 'Viu como a floresta é forte? Plante essa ideia na cabeça!',
      lose: 'Ahh, que pena! Mas você mereceu. Leve a Insígnia da Floresta!',
    },
    maylene: {
      city: 'Veilstone',
      intro: 'Treino descalça desde pequena. Não sou muito de falar… Meus golpes falam por mim.',
      win: 'Treine o corpo e a mente. Você está quase lá.',
      lose: 'Você foi mais forte. Por favor, aceite a Insígnia do Cascalho.',
    },
    wake: {
      city: 'Pastoria',
      intro: 'GRAAAH! Crasher Wake chegou para fazer a onda quebrar em cima de você!',
      win: 'GWAHAHA! A onda te engoliu inteiro!',
      lose: 'Que tsunami você trouxe! A Insígnia do Brejo é sua, campeão!',
    },
    fantina: {
      city: 'Hearthome',
      intro: 'Bonjour! Meus Pokémon fantasmas adoram dançar no escuro. Vamos dançar juntos, oui?',
      win: 'Ah, magnifique! A dança terminou do jeito que eu queria.',
      lose: 'Mon dieu, que talento! A Insígnia da Relíquia é sua.',
    },
    byron: {
      city: 'Canalave',
      intro: 'Ho! Escavei minas a vida inteira e o meu aço nunca enferrujou. Tente amassá-lo!',
      win: 'Ho ho! Aço de verdade não se dobra!',
      lose: 'Hmm! Você quebrou até o meu aço. Leve a Insígnia da Mina, você mereceu.',
    },
    candice: {
      city: 'Snowpoint',
      intro: 'Foco total! Aqui no frio o que importa é concentração, e hoje eu estou superfocada!',
      win: 'Foco, foco, foco! Viu como funciona?',
      lose: 'Uau, que foco o seu! Você mereceu a Insígnia do Pingente de Gelo.',
    },
    volkner: {
      city: 'Sunyshore',
      intro: 'Faz tempo que ninguém me dá uma batalha de verdade. Espero que você acenda alguma coisa aqui.',
      win: 'Hmph. Ainda não foi desta vez que alguém me animou.',
      lose: 'Isso! Era essa faísca que eu esperava. A Insígnia do Farol é sua.',
    },
  } as Record<string, { city: string; intro: string; win: string; lose: string }>,

  /** Nome da insígnia como completa o texto "Insígnia ___" (core.rewards.badge). */
  badgeName: {
    stone: 'da Pedra', knuckle: 'do Punho', dynamo: 'do Dínamo', heat: 'do Calor',
    balance: 'do Equilíbrio', feather: 'da Pena', mind: 'da Mente', rain: 'da Chuva',
    coal: 'do Carvão', forest: 'da Floresta', cobble: 'do Cascalho', fen: 'do Brejo',
    relic: 'da Relíquia', mine: 'da Mina', icicle: 'do Pingente de Gelo', beacon: 'do Farol',
  } as Record<string, string>,
  badgeFull: {
    stone: 'Insígnia da Pedra', knuckle: 'Insígnia do Punho', dynamo: 'Insígnia do Dínamo', heat: 'Insígnia do Calor',
    balance: 'Insígnia do Equilíbrio', feather: 'Insígnia da Pena', mind: 'Insígnia da Mente', rain: 'Insígnia da Chuva',
    coal: 'Insígnia do Carvão', forest: 'Insígnia da Floresta', cobble: 'Insígnia do Cascalho', fen: 'Insígnia do Brejo',
    relic: 'Insígnia da Relíquia', mine: 'Insígnia da Mina', icicle: 'Insígnia do Pingente de Gelo', beacon: 'Insígnia do Farol',
  } as Record<string, string>,

  lines: {
    // Hoenn
    sidney: {
      intro: 'Ei, gostei da sua cara. Vamos fazer uma batalha que valha a pena, sem enrolação!',
      win: 'Foi divertido, mas o lado sombrio levou essa.',
      lose: 'Hah! Perdi, e foi uma baita batalha. Vá em frente, o próximo te espera.',
    },
    phoebe: {
      intro: 'Treinei no Monte Pyre conversando com os espíritos. Eles me contaram que você é forte.',
      win: 'Os espíritos tinham razão… mas hoje eu fui mais forte.',
      lose: 'Uau! Os espíritos vão falar de você por muito tempo.',
    },
    glacia: {
      intro: 'Vim de muito longe procurar um treinador capaz de derreter o meu gelo. Será você?',
      win: 'Frio demais. Sua chama ainda é fraca.',
      lose: 'Enfim, um calor de verdade. Pode passar.',
    },
    drake: {
      intro: 'Sou o último da Elite dos Quatro. Já cruzei mares em tempestade com meus dragões. Você tem o que é preciso?',
      win: 'Ainda falta o que um dragão exige de um treinador.',
      lose: 'Magnífico! Você tem o coração de um mestre dos dragões. O Campeão aguarda.',
    },
    steven: {
      intro: 'Coleciono pedras raras pelo mundo, e você é uma descoberta e tanto. Como Campeão de Hoenn, aceito o seu desafio!',
      win: 'Toda pedra precisa ser lapidada. Volte quando estiver brilhando.',
      lose: 'Você brilhou mais que qualquer pedra da minha coleção. Parabéns, novo Campeão de Hoenn!',
    },
    // Sinnoh
    aaron: {
      intro: 'Insetos são belos e fortes! Eu e meus Pokémon vamos provar isso para você!',
      win: 'Viu? Ninguém subestima os insetos!',
      lose: 'Você venceu… Meus insetos e eu vamos ficar ainda mais fortes.',
    },
    bertha: {
      intro: 'Ora, ora, que visita mais jovem! Esta vovó aqui ainda move montanhas. Vamos?',
      win: 'Hohoho! A experiência ainda conta muito, querido.',
      lose: 'Que força a sua! Vá em frente, e cuide bem desses Pokémon.',
    },
    flint: {
      intro: 'Meu fogo está aceso! Mostre que a sua paixão queima tanto quanto a minha!',
      win: 'Sua chama se apagou cedo demais!',
      lose: 'Que chama! Você incendiou esta batalha. Pode passar!',
    },
    lucian: {
      intro: 'Estava terminando um livro. Espero que a nossa batalha seja tão interessante quanto ele.',
      win: 'Um final previsível. Estude mais os seus Pokémon.',
      lose: 'Um desfecho que eu não esperava. A Campeã espera por você.',
    },
    // Liga Master
    'blue-master': {
      intro: 'Então você venceu as quatro Ligas. Agora sem lendários e sem shinies: só você, seu time e a sua estratégia.',
      win: 'Muito poder nas outras Ligas, pouca estratégia aqui. Volte com um time de verdade.',
      lose: 'Hmpf. Esse time foi bem pensado. Lance não vai ser tão fácil.',
    },
    'lance-master': {
      intro: 'Aqui ninguém esconde a fraqueza atrás de um lendário. Meus dragões querem ver como o seu time responde.',
      win: 'Um time precisa cobrir as próprias fraquezas. O seu não cobriu.',
      lose: 'Você enfrentou meus dragões de igual para igual. Steven espera por você.',
    },
    'steven-master': {
      intro: 'Sem lendários, cada pedra do time precisa estar bem lapidada. Vamos ver as suas.',
      win: 'Boas pedras, mas mal encaixadas. Tente outra combinação.',
      lose: 'Que time bem lapidado! Só resta Cynthia entre você e o título.',
    },
    'cynthia-master': {
      intro: 'Chegar até aqui já diz muito sobre você. Agora, a última batalha, no mesmo nível, com tudo o que temos.',
      win: 'Foi lindo, mas ainda não foi o bastante. A Liga Master abre de novo amanhã.',
      lose: 'Nenhum lendário, nenhum shiny, e mesmo assim você venceu. Você é um verdadeiro Mestre Pokémon.',
    },
    cynthia: {
      intro: 'Que bom que você chegou até aqui. Como Campeã de Sinnoh, vou batalhar com tudo o que tenho.',
      win: 'Foi uma batalha linda. Volte sempre que quiser me desafiar.',
      lose: 'Que força incrível… Hoje Sinnoh ganha um novo Campeão. Parabéns, de coração.',
    },
  } as Record<string, { intro: string; win: string; lose: string }>,

  leagues: { hoenn, sinnoh, master },
};

export { masterRules };
export default regions;
