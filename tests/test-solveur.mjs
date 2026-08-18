// Le solveur travaille sur une position simplifiee : talon reduit a un
// ensemble, fondations reduites a des hauteurs. Ces raccourcis sont le coeur
// de sa rapidite, et le seul endroit ou il peut mentir. Ces tests rejouent
// donc chaque solution dans le vrai moteur, coup par coup : si l'abstraction
// se decolle des regles, la relecture echoue.

import { counter, etatManuel, rejouer } from './harness.mjs';
import { TAILLE_PAQUET } from '../js/cartes.js';
import { nouvellePartie } from '../js/partie.js';
import { depuisPartie, resoudre, resoudreAvecRelances, cle, coups, appliquer, gagne } from '../js/solveur.js';

const { check, report } = counter();
console.log('\nSolveur\n');

// Une position deja gagnee, et une a un coup de l'etre.
const finie = etatManuel({
    fondations: [
        'AP 2P 3P 4P 5P 6P 7P 8P 9P 10P VP DP RP', 'AC 2C 3C 4C 5C 6C 7C 8C 9C 10C VC DC RC',
        'AK 2K 3K 4K 5K 6K 7K 8K 9K 10K VK DK RK', 'AT 2T 3T 4T 5T 6T 7T 8T 9T 10T VT DT RT'
    ]
});
check('une position gagnee est reconnue', gagne(depuisPartie(finie)));
check('une position gagnee se resout sans un noeud', resoudre(depuisPartie(finie)).gagnee);

// Une position sans le moindre coup : ni talon, ni montee, ni rangement.
const bloquee = etatManuel({ colonnes: ['2P', '2C'], cachees: [0, 0] });
const echec = resoudre(depuisPartie(bloquee));
check('une position bloquee est prouvee perdue', !echec.gagnee && !echec.epuise);
check('une position bloquee ne rend aucune solution', echec.solution === null);

// La cle d'identite : c'est elle qui empeche la recherche de tourner en rond.
const position = depuisPartie(nouvellePartie(7));
check('la cle est stable', cle(position) === cle(depuisPartie(nouvellePartie(7))));
check('deux donnes ont des cles differentes', cle(position) !== cle(depuisPartie(nouvellePartie(8))));
const bouge = appliquer(position, coups(position)[0]);
check('un coup change la cle', cle(bouge) !== cle(position));
check('un coup ne perd aucune carte',
    bouge.talon.length + bouge.cols.flat().length + bouge.fonds.reduce((a, b) => a + b, 0) === TAILLE_PAQUET);

// Deux colonnes vides sont interchangeables : sans ce repli, la recherche
// explore la meme position autant de fois qu'il y a de facons de les ranger.
const gauche = etatManuel({ colonnes: ['', 'RP', '', '', '', '', ''] });
const droite = etatManuel({ colonnes: ['', '', '', '', '', 'RP', ''] });
check('le numero des colonnes ne fait pas partie de la position',
    cle(depuisPartie(gauche)) === cle(depuisPartie(droite)));

// Le gros du travail : des solutions relues par le moteur.
let relues = 0;
let manquees = 0;
const ratees = [];
for (let graine = 1; graine <= 60; graine++) {
    const resultat = resoudreAvecRelances(depuisPartie(nouvellePartie(graine)), { graine });
    if (!resultat.gagnee) { manquees++; continue; }
    const relecture = rejouer(graine, resultat.solution);
    if (relecture.ok) relues++;
    else ratees.push(`graine ${graine} : ${relecture.ou}`);
}
check(`les ${relues} solutions trouvees se rejouent toutes dans le moteur`,
    ratees.length === 0, ratees.slice(0, 3).join(' | '));
check('le solveur resout une bonne part des donnes', relues >= 35, `${relues} sur 60`);
console.log(`  (${relues} donnes resolues sur 60, ${manquees} ecartees)`);

// Les relances : une donne perdue ne se relance pas, une donne facile ne
// consomme pas de tirage au sort, et deux moissons identiques se ressemblent.
const perdue = resoudreAvecRelances(depuisPartie(bloquee), { relances: 8 });
check('une donne prouvee perdue ne se relance pas', perdue.essais === 1);
const facile = resoudreAvecRelances(depuisPartie(nouvellePartie(2)), { graine: 2 });
check('une donne resolue rend le nombre de relances depensees', facile.essais >= 1);
check('le solveur rend le meme verdict pour la meme graine',
    resoudreAvecRelances(depuisPartie(nouvellePartie(9)), { graine: 9 }).gagnee
    === resoudreAvecRelances(depuisPartie(nouvellePartie(9)), { graine: 9 }).gagnee);
check('les relances trouvent plus que la seule passe fixe',
    [...Array(40).keys()].filter(n => resoudreAvecRelances(depuisPartie(nouvellePartie(n + 1)), { graine: n + 1 }).gagnee).length
    >= [...Array(40).keys()].filter(n => resoudre(depuisPartie(nouvellePartie(n + 1)), { budget: 12000 }).gagnee).length);

// Le budget doit se tenir : un catalogue se moissonne en temps borne.
const serre = resoudre(depuisPartie(nouvellePartie(3)), { budget: 50 });
check('le budget arrete la recherche', serre.noeuds <= 50);
check('une recherche interrompue se declare epuisee, pas perdue',
    !serre.gagnee ? serre.epuise : true);

report();
