// Le catalogue est une promesse : chaque graine qu'il contient mene a une
// partie gagnable. Une promesse qu'on ne verifie pas est une promesse fausse,
// alors ces tests en tirent des graines au sort, les resolvent a nouveau, et
// rejouent la solution coup par coup dans le moteur. Si la moisson a laisse
// passer une donne perdue, elle tombe ici.

import { readFileSync, existsSync } from 'node:fs';
import { counter, rejouer } from './harness.mjs';
import { nouvellePartie } from '../js/partie.js';
import { depuisPartie, resoudreAvecRelances } from '../js/solveur.js';
import { graines, graineDuJour, graineAuHasard, estGarantie } from '../js/donne.js';
import { alea } from '../js/hasard.js';
import { moissonner } from '../scripts/catalogue.mjs';

const { check, report } = counter();
console.log('\nCatalogue\n');

// Une moisson miniature, pour eprouver la moissonneuse elle-meme sans
// dependre du fichier livre.
const petite = moissonner({ nombre: 12, depart: 1, budget: 12000, relances: 8 });
const recoltees = Object.values(petite.niveaux).flat();
check('la moisson rend le nombre de donnes demande', recoltees.length === 12);
check('la moisson ne ramene aucun doublon', new Set(recoltees).size === 12);
check('la moisson essaie plus de graines qu elle n en garde', petite.essayees >= 12);
check('chaque graine moissonnee est reellement gagnable',
    recoltees.every(graine => resoudreAvecRelances(depuisPartie(nouvellePartie(graine)), { graine }).gagnee));
check('la moisson range chaque donne dans un seul palier',
    Object.values(petite.niveaux).filter(liste => liste.length).length >= 1
    && recoltees.length === new Set(recoltees).size);

const chemin = 'data/donnes.json';
if (!existsSync(chemin)) {
    console.log(`  (${chemin} absent : lancer npm run catalogue)`);
    report();
}

const catalogue = JSON.parse(readFileSync(chemin, 'utf8'));
const liste = graines(catalogue);

check('le catalogue porte un numero de version', catalogue.version === 1);
check('le catalogue annonce ses regles',
    catalogue.regles.pioche === 1 && catalogue.regles.redonnes === 'illimitees');
check('le catalogue fige la taille de son calendrier',
    Number.isInteger(catalogue.calendrier) && catalogue.calendrier > 0);
check('le calendrier tient dans le catalogue', catalogue.calendrier <= liste.length);
check('le catalogue contient de quoi jouer', liste.length >= 1000, `${liste.length} donnes`);
check('aucune graine n apparait deux fois', new Set(liste).size === liste.length);
check('toutes les graines sont des entiers positifs',
    liste.every(graine => Number.isInteger(graine) && graine > 0));
check('les trois paliers sont peuples',
    Object.values(catalogue.niveaux).every(niveau => niveau.length > 0),
    Object.entries(catalogue.niveaux).map(([nom, l]) => `${nom} ${l.length}`).join(' '));

// La verification qui compte : des graines tirees au sort, resolues puis
// rejouees dans le moteur jusqu'a la victoire.
const tirage = alea(20260818);
const echantillon = [...Array(15).keys()].map(() => graineAuHasard(catalogue, tirage));
const menteuses = [];
for (const graine of echantillon) {
    const resultat = resoudreAvecRelances(depuisPartie(nouvellePartie(graine)), { graine, relances: 16 });
    if (!resultat.gagnee) { menteuses.push(`${graine} : plus resoluble`); continue; }
    const relecture = rejouer(graine, resultat.solution);
    if (!relecture.ok) menteuses.push(`${graine} : ${relecture.ou}`);
}
check(`les ${echantillon.length} donnes tirees au sort se gagnent toutes`,
    menteuses.length === 0, menteuses.slice(0, 3).join(' | '));

// Le defi du jour, sur deux ans de calendrier.
const defis = [...Array(730).keys()].map(n => graineDuJour(catalogue, new Date(2026, 0, 1 + n)));
check('chaque jour de deux ans propose une donne du catalogue',
    defis.every(graine => estGarantie(catalogue, graine)));
check('le defi ne se repete pas sur deux ans',
    new Set(defis).size === defis.length, `${new Set(defis).size} donnes distinctes`);

report();
