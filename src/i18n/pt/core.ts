// Textos compartilhados (cabeçalho, login, tipos, atributos, raridades, ações comuns).
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

const core = {
  appName: 'Poké Gacha',
  tagline: 'Capture, evolua e batalhe com os 251 Pokémon de Kanto e Johto.',
  loading: 'Carregando…',
  loadError: 'Não foi possível carregar o jogo. Verifique sua conexão e recarregue a página.',

  nav: {
    collection: 'Coleção',
    capture: 'Capturar',
    battle: 'Batalhar',
    main: 'Navegação principal',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    home: 'Início',
  },

  login: {
    signIn: 'Entrar com Google',
    guest: 'Jogar como convidado',
    guestNote: 'Como convidado, o progresso fica salvo só neste navegador.',
    notConfigured: 'Login com Google não configurado neste site.',
    failed: 'Não foi possível entrar. Tente de novo.',
    cloudLoad: 'Não conseguimos carregar seu save da nuvem. Verifique a conexão e tente de novo.',
    cloudDenied: 'O Firestore recusou o acesso ao save (permission-denied). Confira se a regra de pokegacha_saves foi publicada no projeto certo.',
    cloudUnreachable: 'O Firestore não respondeu. Pode ser a conexão, um bloqueador de anúncios ou escudo de privacidade: libere este site e tente de novo.',
    cloudCode: (code: string) => `Código do erro: ${code}`,
    connecting: 'Conectando à sua conta Google…',
    signedIn: (name: string) => `Conectado com Google como ${name}.`,
  },

  account: {
    menu: 'Menu',
    signedInAs: (name: string) => `Conectado como ${name}`,
    guest: 'Convidado',
    signIn: 'Entrar com Google para salvar na nuvem',
    signOut: 'Sair',
    sync: { local: 'Salvo neste navegador', saving: 'Salvando…', saved: 'Salvo na nuvem', error: 'Falha ao salvar na nuvem' },
    language: 'Idioma',
    settings: 'Configurações',
    reset: 'Recomeçar jogo',
    resetTitle: 'Recomeçar do zero?',
    resetText: 'Sua coleção, itens, insígnias e todo o progresso serão apagados. Isso não pode ser desfeito.',
    resetConfirm: 'Apagar tudo',
    github: 'Bruno Peres no GitHub',
    mute: 'Silenciar',
    unmute: 'Ativar som',
  },

  currency: 'Pokédollars',
  coins: (n: number) => `₽ ${n.toLocaleString('pt-BR')}`,
  notEnoughCoins: (n: number) => `Pokédollars insuficientes! Você precisa de ₽ ${n.toLocaleString('pt-BR')}.`,

  actions: {
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    close: 'Fechar',
    continue: 'Continuar',
    back: 'Voltar',
    skip: 'Toque para pular',
    retry: 'Tentar de novo',
    yes: 'Sim',
    no: 'Não',
  },

  card: {
    level: 'Nv.',
    levelFull: (n: number) => `Nível ${n}`,
    power: 'PC',
    powerFull: 'Poder de Combate',
    shiny: 'Shiny',
    uncapped: 'Sem limite de nível',
    maxLevel: 'Nível máximo',
    notCaught: 'Não capturado',
    copies: (n: number) => plural(n, 'cópia', 'cópias'),
    dex: (id: number) => `Nº ${String(id).padStart(3, '0')}`,
  },

  stats: { hp: 'PS', atk: 'Ataque', def: 'Defesa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidade' },
  statsShort: { hp: 'PS', atk: 'ATQ', def: 'DEF', spa: 'A.ESP', spd: 'D.ESP', spe: 'VEL' },

  types: {
    normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico', grass: 'Planta', ice: 'Gelo',
    fighting: 'Lutador', poison: 'Venenoso', ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
    rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
  },

  rarity: { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário', mythical: 'Mítico' },

  rewards: {
    title: 'Recompensas',
    coins: (n: number) => `₽ ${n.toLocaleString('pt-BR')}`,
    item: (name: string, n: number) => `${name} ×${n}`,
    badge: (name: string) => `Insígnia ${name}`,
    newCard: 'Novo!',
    levelUp: (from: number, to: number) => `Nv. ${from} → ${to}`,
    maxed: 'Nível máximo: virou Doce Raro',
  },

  plural,
};

export default core;
