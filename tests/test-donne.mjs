// Le choix de la donne. Peu de code, mais deux pieges qui ne se voient qu'a
// l'usage : un defi du jour qui change quand le catalogue grandit, et une
// bascule de minuit calee sur le mauvais fuseau.

import { counter } from './harness.mjs';
import { EPOQUE, numeroDuJour, graines, graineDuJour, graineAuHasard, estGarantie, niveauDe } from '../js/donne.js';
import { alea } from '../js/hasard.js';

const { check, report } = counter();
console.log('\nDonne\n');

const catalogue = {
    version: 1,
    calendrier: 5,
    niveaux: { tranquille: [11, 3, 27], moyenne: [8, 42], corsee: [19, 5] }
};

check('les graines sortent triees', graines(catalogue).join() === '3,5,8,11,19,27,42');
check('le catalogue rend toutes ses graines', graines(catalogue).length === 7);

// Defi du jour.
const jour = date => graineDuJour(catalogue, date);
check('un jour donne toujours la meme donne',
    jour(new Date(2026, 2, 3)) === jour(new Date(2026, 2, 3, 23, 59)));
check('deux jours voisins ne donnent pas la meme donne',
    jour(new Date(2026, 2, 3)) !== jour(new Date(2026, 2, 4)));
check('le defi du jour sort du catalogue',
    graines(catalogue).includes(jour(new Date(2026, 6, 14))));
check('le defi ne pioche que dans le calendrier',
    [...Array(40).keys()].every(n => graines(catalogue).slice(0, 5).includes(jour(new Date(2026, 0, 1 + n)))));

// Le piege : un catalogue agrandi ne doit pas changer les defis deja joues.
// Une moisson ajoute des graines plus hautes, jamais avant les premieres.
const agrandi = {
    ...catalogue,
    niveaux: { tranquille: [11, 3, 27, 91], moyenne: [8, 42, 108], corsee: [19, 5, 77, 64] }
};
check('agrandir le catalogue ne change aucun defi passe',
    [...Array(60).keys()].every(n => {
        const date = new Date(2026, 0, 1 + n);
        return graineDuJour(catalogue, date) === graineDuJour(agrandi, date);
    }));

// Minuit chez le joueur, pas a Greenwich.
check("l'origine du calendrier est le 1er janvier 2026", EPOQUE === Date.UTC(2026, 0, 1) / 86400000);
check('le premier jour porte le numero zero', numeroDuJour(new Date(2026, 0, 1, 12)) === 0);
check('le lendemain porte le numero un', numeroDuJour(new Date(2026, 0, 2, 12)) === 1);
check('juste apres minuit compte pour le jour qui commence',
    numeroDuJour(new Date(2026, 0, 2, 0, 1)) === 1);
check('juste avant minuit compte encore pour la veille',
    numeroDuJour(new Date(2026, 0, 1, 23, 59)) === 0);
check('le numero du jour avance de un par jour',
    numeroDuJour(new Date(2026, 7, 18)) - numeroDuJour(new Date(2026, 7, 17)) === 1);
check('le changement d heure ne saute pas un jour',
    numeroDuJour(new Date(2026, 2, 30)) - numeroDuJour(new Date(2026, 2, 29)) === 1);

// Tirage au hasard et appartenance.
const tirage = alea(4);
check('une donne au hasard sort du catalogue',
    [...Array(50).keys()].every(() => graines(catalogue).includes(graineAuHasard(catalogue, tirage))));
check('le hasard ne tombe pas toujours sur la meme',
    new Set([...Array(50).keys()].map(() => graineAuHasard(catalogue, tirage))).size > 1);
check('une graine du catalogue est reconnue garantie', estGarantie(catalogue, 42));
check('une graine inconnue ne l est pas', !estGarantie(catalogue, 43));
check('le niveau d une graine se retrouve', niveauDe(catalogue, 42) === 'moyenne');
check('une graine inconnue n a pas de niveau', niveauDe(catalogue, 43) === null);

report();
