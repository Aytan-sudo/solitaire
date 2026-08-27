// Le partage. Deux promesses a tenir, et elles ne se voient pas a l'oeil nu :
// le lien refabrique exactement la donne, et il ne dit rien du joueur qui
// l'envoie — ni son temps, ni ses coups, ni la solution.

import { counter } from './harness.mjs';
import { lienDeLaDonne, messageDePartage } from '../js/partage.js';

const { check, report } = counter();
console.log('\nPartage\n');

const BASE = 'https://aytan-sudo.github.io/solitaire/';

// Le lien -------------------------------------------------------------

check('le defi se partage par sa date',
    lienDeLaDonne(BASE, { jour: '2026-08-27', graine: 1234 })
        === 'https://aytan-sudo.github.io/solitaire/?jour=2026-08-27');

check('une partie libre se partage par son numero',
    lienDeLaDonne(BASE, { graine: 1234 }) === 'https://aytan-sudo.github.io/solitaire/?donne=1234');

// L'adresse d'ou l'on joue porte deja des parametres : ceux d'une partie
// precedente, ou ceux qu'un site tiers a colles au lien. Le partage repart de
// l'adresse nue, sinon il empilerait les donnes.
check('le lien repart de l adresse nue',
    lienDeLaDonne(`${BASE}?donne=99&utm=courriel`, { jour: '2026-08-27', graine: 1234 })
        === 'https://aytan-sudo.github.io/solitaire/?jour=2026-08-27');

// En developpement, le jeu tourne sur un localhost. Le lien doit rester celui
// du lieu, sinon on partage une adresse qu'on n'a pas testee.
check('le lien reste celui du lieu',
    lienDeLaDonne('http://localhost:8769/', { graine: 7 }) === 'http://localhost:8769/?donne=7');

// Le message ----------------------------------------------------------

const gagne = messageDePartage({
    base: BASE, jour: '2026-08-27', graine: 1234, ouvert: false,
    gagnee: true, secondes: 252, coups: 137
});
const lignes = gagne.split('\n');

check('la victoire tient en quatre lignes', lignes.length === 4, String(lignes.length));
check('la premiere ligne dit le jeu et la date', lignes[0] === 'Solitaire — défi du 27/08/2026', lignes[0]);
check('la deuxieme dit le temps et les coups', lignes[1] === 'Gagné en 4:12 · 137 coups', lignes[1]);
check('la troisieme range les quatre familles', lignes[2] === '♠️♥️♦️♣️', lignes[2]);
check('la derniere est le lien', lignes[3] === `${BASE}?jour=2026-08-27`, lignes[3]);

// La promesse a ne pas casser : le lien refait la donne, il ne raconte pas la
// partie. Celui qui l'ouvre commence a zero.
check('le lien ne porte ni le temps ni les coups',
    !lignes[3].includes('252') && !lignes[3].includes('4:12') && !lignes[3].includes('137'));

check('le mode ouvert se dit, pour que les temps ne se comparent pas a tort',
    messageDePartage({ base: BASE, graine: 1234, ouvert: true, gagnee: true, secondes: 60, coups: 90 })
        .includes('donne ouverte'));

const enCours = messageDePartage({
    base: BASE, graine: 1234, gagnee: false, secondes: 300, coups: 12
});
check('une partie en cours n annonce aucun resultat',
    !enCours.includes('Gagné') && !enCours.includes('5:00') && !enCours.includes('12 coups'), enCours);
check('une partie en cours invite quand meme', enCours.includes('Saurez-vous'));
check('une partie libre porte son numero', enCours.includes(`${BASE}?donne=1234`), enCours);

// Le chrono compte en flottant tant qu'il tourne : une seconde et demie ne doit
// pas s'ecrire ':1.5'.
check('les secondes s ecrivent en entier',
    messageDePartage({ base: BASE, graine: 1, gagnee: true, secondes: 61.7, coups: 3 })
        .includes('1:01'));

report();
