// Builds src/data/pokedex/gen<N>.json from PokeAPI.
//   node scripts/build-pokedex.mjs --gen 1
// Run it once per generation; the game registers each file in src/data/generations.ts.
// The output is committed, so the game never calls PokeAPI at runtime (sprites and cries are loaded by URL).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = Number(process.argv[process.argv.indexOf('--gen') + 1] || 1);

const cache = new Map();
async function get(url) {
    if (!url.startsWith('http')) url = `${API}/${url}`;
    if (cache.has(url)) return cache.get(url);
    const promise = (async () => {
        for (let attempt = 1; ; attempt++) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
                return await response.json();
            } catch (error) {
                if (attempt >= 4) throw error;
                await new Promise(resolve => setTimeout(resolve, 600 * attempt));
            }
        }
    })();
    cache.set(url, promise);
    return promise;
}

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: limit }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
        }
    }));
    return out;
}

const idFromUrl = url => Number(url.match(/\/(\d+)\/?$/)[1]);
const clean = text => text.replace(/[\f\n\r­]+/g, ' ').replace(/\s+/g, ' ').replace(/POKéMON/g, 'Pokémon').trim();

/** Picks the most relevant evolution requirement among PokeAPI's per-game details. */
function method(details) {
    const d = details.find(x => x.version_group?.name === 'red-blue') ?? details[0];
    if (!d) return { kind: 'other' };
    const trigger = d.trigger?.name;
    if (trigger === 'level-up' && d.min_level) return { kind: 'level', level: d.min_level };
    if (trigger === 'use-item' && d.item) return { kind: 'item', item: d.item.name };
    if (trigger === 'trade') return d.held_item ? { kind: 'trade', item: d.held_item.name } : { kind: 'trade' };
    if (trigger === 'level-up' && (d.min_happiness || d.min_affection)) return { kind: 'friendship' };
    if (trigger === 'level-up' && d.held_item) return { kind: 'item', item: d.held_item.name };
    return { kind: 'other' };
}

/** species id -> { from, evolutions } using the whole chain (it may include species from other generations). */
function walkChain(node, from, out) {
    const id = idFromUrl(node.species.url);
    out.set(id, {
        from,
        evolutions: node.evolves_to.map(next => ({ to: idFromUrl(next.species.url), ...method(next.evolution_details) })),
    });
    node.evolves_to.forEach(next => walkChain(next, id, out));
}

/** PokeAPI chain links that aren't evolutions in the games (Phione never becomes Manaphy): from -> to. */
const NOT_EVOLUTIONS = [[489, 490]];

const STAT_KEYS ={ hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };

async function build() {
    const generation = await get(`generation/${gen}`);
    const ids = generation.pokemon_species.map(s => idFromUrl(s.url)).sort((a, b) => a - b);
    console.log(`Generation ${gen} (${generation.main_region?.name}): ${ids.length} species`);

    const chains = new Map();
    const entries = await mapLimit(ids, 12, async id => {
        const [pokemon, species] = await Promise.all([get(`pokemon/${id}`), get(`pokemon-species/${id}`)]);
        const chainId = idFromUrl(species.evolution_chain.url);
        if (!chains.has(chainId)) {
            const map = new Map();
            walkChain((await get(species.evolution_chain.url)).chain, null, map);
            chains.set(chainId, map);
        }
        const evo = chains.get(chainId).get(id);
        const en = list => list.find(x => x.language.name === 'en');
        const flavor = ['firered', 'leafgreen', 'yellow', 'red', 'x', 'sword']
            .map(v => species.flavor_text_entries.find(f => f.language.name === 'en' && f.version.name === v))
            .find(Boolean) ?? en(species.flavor_text_entries);
        const stats = {};
        for (const s of pokemon.stats) stats[STAT_KEYS[s.stat.name]] = s.base_stat;

        process.stdout.write('.');
        return {
            id,
            slug: species.name,
            name: en(species.names)?.name ?? species.name,
            genus: en(species.genera)?.genus ?? '',
            types: pokemon.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
            stats,
            captureRate: species.capture_rate,
            legendary: species.is_legendary,
            mythical: species.is_mythical,
            baby: species.is_baby,
            // Species split off a bogus chain link get a family of their own.
            family: NOT_EVOLUTIONS.some(([, to]) => to === id) ? 10000 + id : chainId,
            evolvesFrom: NOT_EVOLUTIONS.some(([from, to]) => to === id && from === evo.from) ? null : evo.from,
            evolutions: evo.evolutions.filter(e => !NOT_EVOLUTIONS.some(([from, to]) => from === id && to === e.to)),
            height: pokemon.height,
            weight: pokemon.weight,
            habitat: species.habitat?.name ?? null,
            flavor: flavor ? clean(flavor.flavor_text) : '',
        };
    });

    const file = join(root, 'src', 'data', 'pokedex', `gen${gen}.json`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ generation: gen, region: generation.main_region?.name ?? '', species: entries }, null, 1) + '\n');
    console.log(`\nWrote ${file}`);
}

build().catch(error => {
    console.error(error);
    process.exit(1);
});
