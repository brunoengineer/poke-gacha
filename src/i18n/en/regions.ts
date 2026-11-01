// English texts for Hoenn and Sinnoh. Must have exactly the same keys as ../pt/regions.ts.
import type pt from '../pt/regions';

const n = (value: number) => value.toLocaleString('en-US');

type LeagueTexts = (typeof pt)['leagues']['hoenn'];

const hoenn: LeagueTexts = {
  title: 'Hoenn League',
  subtitle: "Hoenn's Elite Four and Champion Steven. Four duels in a row; the first loss ends your run.",
  plateau: 'Ever Grande City · Hoenn',
  heroText: 'Sidney, Phoebe, Glacia and Drake guard the way to Steven, the rare-stone Champion. Levels up to 120 and triple the Kanto prizes. Only legendaries and shinies grow that far!',
  lockedTitle: 'The Hoenn League is still closed',
  lockedText: (badges: number) => `Earn all 8 Hoenn badges to challenge Hoenn's Elite Four. You have ${n(badges)} of 8.`,
  prizeFirstTitle: "First title: a shiny Hoenn starter, matching your starter's type",
  firstTitle: 'First Hoenn title! A shiny Hoenn starter has joined your collection.',
  championTitle: 'Hoenn League Champion!',
};

const sinnoh: LeagueTexts = {
  title: 'Sinnoh League',
  subtitle: "Sinnoh's Elite Four and Champion Cynthia. Four duels in a row; the first loss ends your run.",
  plateau: 'Sinnoh Pokémon League',
  heroText: 'Aaron, Bertha, Flint and Lucian guard the way to Cynthia, the Champion of Sinnoh. Levels up to 140 and four times the Kanto prizes. Only mythicals and shinies grow that far!',
  lockedTitle: 'The Sinnoh League is still closed',
  lockedText: (badges: number) => `Earn all 8 Sinnoh badges to challenge Sinnoh's Elite Four. You have ${n(badges)} of 8.`,
  prizeFirstTitle: "First title: a shiny Sinnoh starter, matching your starter's type",
  firstTitle: 'First Sinnoh title! A shiny Sinnoh starter has joined your collection.',
  championTitle: 'Sinnoh League Champion!',
};

const regions: typeof pt = {
  friends: {
    // Hoenn
    ruinmaniac: {
      title: 'Ruin Maniac',
      intro: 'I spent all week digging in the desert. Found a Baltoy and half a pound of sand in my boots. Battle?',
      win: 'Ha! That is the strength of hauling rocks all day long!',
      lose: 'Oh well… At least I went home with a new fossil.',
    },
    aromalady: {
      title: 'Aroma Lady',
      intro: 'Smell that? It is my Roselia. Scents are soothing… right up until the attack.',
      win: 'A fragrance that lingers. Just like my victory.',
      lose: 'What a pity… At least the garden still smells lovely.',
    },
    ninjaboy: {
      title: 'Ninja Boy',
      intro: "You didn't even see me coming! My Nincada trains to be the fastest in Hoenn!",
      win: "Too fast for you! You didn't even have time to blink.",
      lose: 'Ugh… A ninja knows when to vanish. Poof!',
    },
    tuber: {
      title: 'Tuber',
      intro: 'My Wailmer and I spent all day at the Slateport beach. Now it is battle time!',
      win: 'Woohoo! Victory splash!',
      lose: 'Aw… I am going back to my float to think about life.',
    },
    shelly: {
      title: 'Team Aqua Admin',
      intro: 'The sea needs more room, and you are in the way! Team Aqua never backs down!',
      win: 'The tide always rises for Team Aqua!',
      lose: "Argh! The boss can't hear about this. Everyone back to the submarine!",
    },
    wally: {
      title: 'Friend',
      intro: "Ralts and I grew up together. I'm not that frail kid anymore… I want to show you!",
      win: 'We did it! Did you see? We won!',
      lose: 'Not yet… But every battle makes me stronger. Thank you!',
    },
    birch: {
      title: 'Pokémon Professor',
      intro: 'Fieldwork is my thing! I spend more time in the tall grass than in the lab. Let us battle!',
      win: 'Excellent! Noted: Pokémon raised in the wild are tremendously strong.',
      lose: 'Ha ha! You got me. Back to the tall grass to train some more.',
    },
    lisia: {
      title: 'Contest Star',
      intro: 'Lights, audience and lots of sparkle! Altaria and I will turn this battle into a show!',
      win: 'And the crowd goes wild! Thank you, thank you!',
      lose: 'What a performance! You stole the show today.',
    },
    wallace: {
      title: 'Contest Master',
      intro: 'A battle is also an art. Allow my Milotic and me to show you the beauty of water.',
      win: 'Elegance and power riding the same wave. It was a pleasure.',
      lose: 'Magnificent! Your team has a shine no contest can teach.',
    },
    may: {
      title: 'Rival',
      intro: 'Hey! Dad sent me to record Pokémon around the region, but battling you is way more fun!',
      win: 'Yes! I am telling Dad all about it back at the lab!',
      lose: 'Wow, you really trained! Next time I win, count on it.',
    },
    // Sinnoh
    youngster4: {
      title: 'Youngster',
      intro: 'Everyone laughs at my Bidoof, but he is the hardest-working Pokémon in Sinnoh! Come on!',
      win: 'See? Bidoof is pure effort!',
      lose: "It's okay, Bidoof… Tomorrow we'll train a little more on Route 201.",
    },
    skier: {
      title: 'Skier',
      intro: 'I skied all the way down from Snowpoint for this! My Snover is itching to battle.',
      win: 'I slid straight into victory!',
      lose: 'Brrr… I think I just wiped out in the snow.',
    },
    mars: {
      title: 'Team Galactic Commander',
      intro: 'Team Galactic will create a brand-new world. But first, let me have a little fun with you!',
      win: 'Hah! Way too easy. The boss will love to hear about this.',
      lose: "How annoying! This changes nothing about Team Galactic's plans.",
    },
    cheryl: {
      title: 'Gentle Trainer',
      intro: 'Oh, hello… My Pokémon love meeting new people. Shall we have a calm little battle?',
      win: 'Oh, we won! My Pokémon are so happy…',
      lose: 'What a lovely battle. You can tell your Pokémon are very well cared for.',
    },
    riley: {
      title: 'Aura Master',
      intro: 'My partner senses your aura. It is strong… and restless. Let us see what it hides.',
      win: 'Aura does not lie. Ours was steadier today.',
      lose: 'Your aura shone brighter. Keep training like this.',
    },
    mira: {
      title: 'Psychic Girl',
      intro: 'Mira got lost again… but Mira found you! Let us battle, okay?',
      win: 'Yay! Mira won!',
      lose: 'Aww… Mira will train more. Can we battle again later?',
    },
    buck: {
      title: 'Adventurer',
      intro: 'Heh! I came to train on Stark Mountain and found you on the way. Let me heat things up!',
      win: 'Heh! Too hot for you, huh?',
      lose: 'Whoa! I am telling my grandma I met someone really strong.',
    },
    dawn: {
      title: 'Friend',
      intro: 'Hi! Piplup and I rehearsed some new moves. Want to try them out with us?',
      win: 'Yes! Piplup was amazing!',
      lose: 'Aw, shucks! But it was a beautiful battle, right?',
    },
    rowan: {
      title: 'Pokémon Professor',
      intro: 'I have studied evolution for decades. These little ones will show how far one can grow. Be ready.',
      win: 'Hmph. Evolving takes time and dedication. You still have a road ahead.',
      lose: 'Hm. Your Pokémon have evolved admirably. Keep it up.',
    },
    barry: {
      title: 'Rival',
      intro: 'Hey! Finally! I was about to start without you. Battle, now, right now!',
      win: 'See?! Fast and strong! I said I would win!',
      lose: "Ahh! I can't believe it! Rematch! Now! …Okay, later. But soon!",
    },
  },

  leaders: {
    // Hoenn
    roxanne: {
      city: 'Rustboro',
      intro: "I studied everything about battling at the Trainers' School. Now I'll put theory into practice!",
      win: 'Exactly as the textbooks say. Review your lessons and come back.',
      lose: 'That was in no textbook… The Stone Badge is yours!',
    },
    brawly: {
      city: 'Dewford',
      intro: "Hey! I ride the waves and I hit hard. Let's see if you can handle the surf!",
      win: 'Wiped out! Come back when your balance is better.',
      lose: 'What a wave! You earned the Knuckle Badge, buddy.',
    },
    wattson: {
      city: 'Mauville',
      intro: "Wahahaha! This old man loves a good spark! Let's see if you've got energy to spare!",
      win: 'Wahaha! That was a real shock to the system!',
      lose: 'Wahahaha! What a charge! Take the Dynamo Badge!',
    },
    flannery: {
      city: 'Lavaridge',
      intro: "I took over this gym not long ago, but my fire is already burning hot! Get ready for the heat!",
      win: 'See? I may be new here, but you were the one who got burned!',
      lose: 'Oh, dear… You cooled my flame. The Heat Badge is yours!',
    },
    norman: {
      city: 'Petalburg',
      intro: 'As a leader and as a father, I know true strength comes from balance. Show me yours.',
      win: 'Your team lacks balance. Train and come back.',
      lose: 'You beat me fair and square. Wear the Balance Badge with pride.',
    },
    winona: {
      city: 'Fortree',
      intro: 'My flying Pokémon and I dance with the wind. Can you keep up with our flight?',
      win: 'The sky is vast, and you have yet to spread your wings.',
      lose: 'What a beautiful flight. The Feather Badge is yours.',
    },
    'tate-liza': {
      city: 'Mossdeep',
      intro: '“We are twins!” “And we think together!” “Can you beat two minds at once?”',
      win: '“We won!” “Just like we predicted!” “Together we are unbeatable!”',
      lose: '“We lost…” “But it was fair!” “Keep the Mind Badge!”',
    },
    juan: {
      city: 'Sootopolis',
      intro: 'Welcome to my gym. A battle should be as elegant as water. Show me your art.',
      win: 'Your moves lacked grace. Return when water flows through you.',
      lose: 'Splendid! Your battle had the beauty of a summer rain. The Rain Badge is yours.',
    },
    // Sinnoh
    roark: {
      city: 'Oreburgh',
      intro: 'Just got out of the mine, helmet still on! My fossils will show you millions of years of power.',
      win: "Hard rock doesn't break easily! Dig deeper and come back.",
      lose: 'Wow, you broke right through the rock! The Coal Badge is yours.',
    },
    gardenia: {
      city: 'Eterna',
      intro: "I love grass Pokémon! And I love winning with them even more. Let's go!",
      win: 'See how strong the forest is? Plant that idea in your head!',
      lose: 'Aww, too bad! But you earned it. Take the Forest Badge!',
    },
    maylene: {
      city: 'Veilstone',
      intro: "I've trained barefoot since I was little. I'm not much of a talker… My strikes speak for me.",
      win: "Train your body and mind. You're almost there.",
      lose: 'You were stronger. Please, accept the Cobble Badge.',
    },
    wake: {
      city: 'Pastoria',
      intro: 'GRAAAH! Crasher Wake is here to bring the wave crashing down on you!',
      win: 'GWAHAHA! The wave swallowed you whole!',
      lose: 'What a tsunami you brought! The Fen Badge is yours, champ!',
    },
    fantina: {
      city: 'Hearthome',
      intro: 'Bonjour! My ghost Pokémon love to dance in the dark. Shall we dance together, oui?',
      win: 'Ah, magnifique! The dance ended just the way I wanted.',
      lose: 'Mon dieu, what talent! The Relic Badge is yours.',
    },
    byron: {
      city: 'Canalave',
      intro: 'Ho! I have dug mines my whole life and my steel has never rusted. Try to dent it!',
      win: 'Ho ho! Real steel does not bend!',
      lose: 'Hmm! You cracked even my steel. Take the Mine Badge, you earned it.',
    },
    candice: {
      city: 'Snowpoint',
      intro: "Total focus! Out here in the cold, concentration is everything, and today I'm super focused!",
      win: 'Focus, focus, focus! See how it works?',
      lose: 'Wow, what focus! You earned the Icicle Badge.',
    },
    volkner: {
      city: 'Sunyshore',
      intro: "It's been a long time since anyone gave me a real battle. I hope you can light something up here.",
      win: 'Hmph. Still no one who can get me fired up.',
      lose: 'Yes! That was the spark I was waiting for. The Beacon Badge is yours.',
    },
  },

  badgeName: {
    stone: 'Stone', knuckle: 'Knuckle', dynamo: 'Dynamo', heat: 'Heat',
    balance: 'Balance', feather: 'Feather', mind: 'Mind', rain: 'Rain',
    coal: 'Coal', forest: 'Forest', cobble: 'Cobble', fen: 'Fen',
    relic: 'Relic', mine: 'Mine', icicle: 'Icicle', beacon: 'Beacon',
  },
  badgeFull: {
    stone: 'Stone Badge', knuckle: 'Knuckle Badge', dynamo: 'Dynamo Badge', heat: 'Heat Badge',
    balance: 'Balance Badge', feather: 'Feather Badge', mind: 'Mind Badge', rain: 'Rain Badge',
    coal: 'Coal Badge', forest: 'Forest Badge', cobble: 'Cobble Badge', fen: 'Fen Badge',
    relic: 'Relic Badge', mine: 'Mine Badge', icicle: 'Icicle Badge', beacon: 'Beacon Badge',
  },

  lines: {
    // Hoenn
    sidney: {
      intro: "Hey, I like the look of you. Let's have a battle worth remembering, no holding back!",
      win: 'That was fun, but the dark side took this one.',
      lose: 'Hah! I lost, and what a battle it was. Go on, the next one is waiting.',
    },
    phoebe: {
      intro: 'I trained on Mt. Pyre, talking with the spirits. They told me you are strong.',
      win: 'The spirits were right… but today I was stronger.',
      lose: 'Wow! The spirits will be talking about you for a long time.',
    },
    glacia: {
      intro: 'I came a very long way looking for a Trainer who can melt my ice. Could that be you?',
      win: 'Far too cold. Your flame is still weak.',
      lose: 'At last, some real warmth. You may pass.',
    },
    drake: {
      intro: 'I am the last of the Elite Four. I have crossed stormy seas with my dragons. Do you have what it takes?',
      win: 'You still lack what a dragon demands of a Trainer.',
      lose: 'Magnificent! You have the heart of a dragon master. The Champion awaits.',
    },
    steven: {
      intro: "I collect rare stones from around the world, and you're quite the find. As Hoenn's Champion, I accept your challenge!",
      win: 'Every stone needs polishing. Come back when you shine.',
      lose: "You shone brighter than any stone in my collection. Congratulations, Hoenn's new Champion!",
    },
    // Sinnoh
    aaron: {
      intro: 'Bugs are beautiful and strong! My Pokémon and I will prove it to you!',
      win: 'See? Nobody underestimates bugs!',
      lose: 'You won… My bugs and I will grow even stronger.',
    },
    bertha: {
      intro: 'My, my, what a young visitor! This granny can still move mountains. Shall we?',
      win: 'Hohoho! Experience still counts for a lot, dear.',
      lose: 'What strength! Go on ahead, and take good care of those Pokémon.',
    },
    flint: {
      intro: 'My fire is lit! Show me your passion burns as hot as mine!',
      win: 'Your flame went out too soon!',
      lose: 'What a blaze! You set this battle on fire. Go on through!',
    },
    lucian: {
      intro: 'I was just finishing a book. I hope our battle proves as interesting.',
      win: 'A predictable ending. Study your Pokémon more closely.',
      lose: 'An ending I did not foresee. The Champion is waiting for you.',
    },
    cynthia: {
      intro: "I'm glad you made it this far. As Sinnoh's Champion, I will battle with everything I have.",
      win: 'That was a beautiful battle. Come back whenever you want to challenge me.',
      lose: 'What incredible strength… Today Sinnoh gains a new Champion. Congratulations, from the heart.',
    },
  },

  leagues: { hoenn, sinnoh },
};

export default regions;
