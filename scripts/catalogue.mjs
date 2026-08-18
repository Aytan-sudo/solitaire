// Moissonneuse de donnes gagnables.
//
// Le solveur ne tourne jamais dans le navigateur : il tourne ici, une fois,
// et laisse derriere lui une liste de graines dont on a vu la solution. Le jeu
// n'a plus qu'a y piocher — instantanement, hors ligne, et sans embarquer une
// seule ligne de recherche.
//
//   node scripts/catalogue.mjs --nombre 5000 --sortie data/donnes.json
//
// Le catalogue vaut pour les regles du solveur : pioche par 1, redonnes
// illimitees. Toute autre regle demande sa propre moisson.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { nouvellePartie } from '../js/partie.js';
import { depuisPartie, resoudreAvecRelances } from '../js/solveur.js';

// Paliers de difficulte, en noeuds explores. Ce n'est pas la difficulte
// ressentie par un joueur — personne n'explore un arbre — mais les deux
// varient ensemble : une donne qui se resout en trois mille noeuds se laisse
// faire, une qui en demande cinquante mille cache ses cartes.
const PALIERS = [
    { nom: 'tranquille', plafond: 3000 },
    { nom: 'moyenne', plafond: 30000 },
    { nom: 'corsee', plafond: Infinity }
];

// Cinq ans et demi de defis avant de recommencer : personne ne s'en apercevra,
// et le figer vaut mieux qu'un modulo qui bouge a chaque moisson.
const CALENDRIER = 2000;

const palierDe = noeuds => PALIERS.find(palier => noeuds <= palier.plafond).nom;

function options(argv) {
    const lu = { nombre: 1000, sortie: 'data/donnes.json', depart: 1, budget: 12000, relances: 8 };
    for (let i = 0; i < argv.length; i += 2) {
        const cle = argv[i].replace(/^--/, '');
        if (!(cle in lu)) throw new Error(`option inconnue : ${argv[i]}`);
        lu[cle] = cle === 'sortie' ? argv[i + 1] : Number(argv[i + 1]);
    }
    return lu;
}

export function moissonner({ nombre, depart, budget, relances, journal = () => {} }) {
    const niveaux = Object.fromEntries(PALIERS.map(palier => [palier.nom, []]));
    const debut = Date.now();
    let graine = depart;
    let essayees = 0;
    let trouvees = 0;

    while (trouvees < nombre) {
        const resultat = resoudreAvecRelances(depuisPartie(nouvellePartie(graine)), { budget, relances, graine });
        essayees++;

        if (resultat.gagnee) {
            niveaux[palierDe(resultat.noeuds)].push(graine);
            trouvees++;
            if (trouvees % 100 === 0) journal(trouvees, essayees, Date.now() - debut);
        }
        graine++;
    }
    return { niveaux, essayees, derniere: graine - 1, duree: Date.now() - debut };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const lu = options(process.argv.slice(2));
    console.error(`Moisson de ${lu.nombre} donnes gagnables, ${lu.relances} relances de ${lu.budget} noeuds.`);

    const { niveaux, essayees, derniere, duree } = moissonner({
        ...lu,
        journal: (trouvees, tentees, ms) =>
            console.error(`  ${trouvees} donnes | ${tentees} graines essayees | ${(trouvees / (ms / 1000)).toFixed(1)}/s`)
    });

    const catalogue = {
        version: 1,
        regles: { pioche: 1, redonnes: 'illimitees' },
        genere: new Date().toISOString().slice(0, 10),
        // Taille du calendrier : les N premieres graines, triees, portent le
        // defi du jour. Ce nombre est fige ici une fois pour toutes. Une
        // moisson plus large ajoutera des graines plus hautes sans toucher au
        // debut de la liste, et les defis deja joues resteront les memes.
        calendrier: Math.min(CALENDRIER, lu.nombre),
        niveaux
    };
    mkdirSync(dirname(lu.sortie), { recursive: true });
    writeFileSync(lu.sortie, JSON.stringify(catalogue));

    const compte = PALIERS.map(p => `${niveaux[p.nom].length} ${p.nom}`).join(', ');
    console.error(`\n${lu.nombre} donnes ecrites dans ${lu.sortie} (${compte}).`);
    console.error(`${essayees} graines essayees jusqu'a ${derniere}, ${(duree / 1000).toFixed(0)} s, ` +
        `${(lu.nombre / essayees * 100).toFixed(0)} % de reussite.`);
}
