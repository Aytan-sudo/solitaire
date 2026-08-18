import { counter, etatManuel, lirePile } from './harness.mjs';
import { depuisNom, TAILLE_PAQUET } from '../js/cartes.js';
import {
    nouvellePartie, jouer, coupValide, coupsPossibles, destinationsPour,
    paquetDeplace, sommet, gagnee, cartesAuxFondations, derouleAutomatique, cloner
} from '../js/partie.js';

const { check, report } = counter();
console.log('\nPartie\n');

const partie = nouvellePartie(2026);

// La donne : 28 cartes au tableau, 24 au talon, et pas une carte egaree.
const toutes = [...partie.pioche, ...partie.colonnes.flat()];
check('la donne distribue les 52 cartes', toutes.length === TAILLE_PAQUET);
check('la donne ne perd ni ne double aucune carte', new Set(toutes).size === TAILLE_PAQUET);
check('les colonnes vont de une a sept cartes',
    partie.colonnes.every((pile, i) => pile.length === i + 1));
check('le talon garde vingt-quatre cartes', partie.pioche.length === 24);
check('une seule carte est retournee par colonne',
    partie.cachees.every((compte, i) => compte === i));
check('les fondations partent vides', cartesAuxFondations(partie) === 0);
check('la meme graine redonne la meme donne',
    nouvellePartie(2026).colonnes.flat().join() === partie.colonnes.flat().join());
check('une autre graine donne une autre donne',
    nouvellePartie(2027).colonnes.flat().join() !== partie.colonnes.flat().join());

// Piocher, puis retourner le talon.
const pioche = jouer(partie, { type: 'piocher' });
check('piocher deplace une carte vers la defausse',
    pioche.pioche.length === 23 && pioche.defausse.length === 1);
check('la carte piochee est la premiere du talon',
    pioche.defausse[0] === partie.pioche[partie.pioche.length - 1]);
check('jouer ne modifie pas l etat precedent',
    partie.pioche.length === 24 && partie.defausse.length === 0);
check('le compteur de coups avance', pioche.coups === partie.coups + 1);

let videe = partie;
for (let i = 0; i < 24; i++) videe = jouer(videe, { type: 'piocher' });
check('le talon se vide en vingt-quatre pioches', videe.pioche.length === 0 && videe.defausse.length === 24);
check('piocher un talon vide est refuse', jouer(videe, { type: 'piocher' }) === null);

const redonnee = jouer(videe, { type: 'redonner' });
check('la redonne remplit le talon', redonnee.pioche.length === 24 && redonnee.defausse.length === 0);
check('la redonne remet les cartes dans le meme ordre',
    redonnee.pioche.join() === partie.pioche.join());
check('la redonne se compte', redonnee.redonnes === 1);
check('redonner avec un talon plein est refuse', jouer(partie, { type: 'redonner' }) === null);
check('redonner sans defausse est refuse', jouer(nouvellePartie(1), { type: 'redonner' }) === null);

// Deplacements sur une position posee a la main.
const table = etatManuel({
    colonnes: ['5P', '2P 3P RC', '9T 8K 7T', 'DP', '', '4C 3T 9P', 'AK'],
    cachees: [0, 2, 1, 0, 0, 1, 0],
    defausse: '6C',
    fondations: ['', 'AC 2C', '', '']
});

check('la dame noire va sur le roi rouge',
    coupValide(table, { type: 'deplacer', de: 'C3', index: 0, vers: 'C1' }));
check('la dame noire ne va pas sur une colonne pleine d une autre couleur',
    !coupValide(table, { type: 'deplacer', de: 'C3', index: 0, vers: 'C0' }));
check('le roi rouge va sur la colonne vide',
    coupValide(table, { type: 'deplacer', de: 'C1', index: 2, vers: 'C4' }));
check('le cinq noir ne va pas sur la colonne vide',
    !coupValide(table, { type: 'deplacer', de: 'C0', index: 0, vers: 'C4' }));
check('l as de carreau monte a sa fondation',
    coupValide(table, { type: 'deplacer', de: 'C6', index: 0, vers: 'F2' }));
check('l as de carreau refuse la fondation des coeurs',
    !coupValide(table, { type: 'deplacer', de: 'C6', index: 0, vers: 'F1' }));
const montee = etatManuel({ colonnes: ['3C', '3T'], fondations: ['', 'AC 2C', '', ''] });
check('le trois de coeur monte sur le deux de coeur',
    coupValide(montee, { type: 'deplacer', de: 'C0', index: 0, vers: 'F1' }));
check('le trois de trefle ne monte pas sur les coeurs',
    !coupValide(montee, { type: 'deplacer', de: 'C1', index: 0, vers: 'F1' }));
check('la defausse se pose sur une suite en regle',
    coupValide(table, { type: 'deplacer', de: 'D', index: 0, vers: 'C2' }));
check('une carte cachee ne se prend pas',
    paquetDeplace(table, 'C1', 1) === null);
check('une suite rompue ne se transporte pas',
    paquetDeplace(table, 'C5', 1) === null);
check('une suite en regle se transporte entiere',
    paquetDeplace(table, 'C2', 1).length === 2);
check('une pile vide ne fournit rien', paquetDeplace(table, 'C4', 0) === null);
check('une carte ne se deplace pas sur sa propre pile',
    !coupValide(table, { type: 'deplacer', de: 'C0', index: 0, vers: 'C0' }));

// Le retournement : le seul progres qui ne se defait pas.
const apres = jouer(table, { type: 'deplacer', de: 'C1', index: 2, vers: 'C4' });
check('la colonne quittee retourne sa carte suivante', apres.cachees[1] === 1);
check('la carte retournee est bien la derniere du reste', sommet(apres, 'C1') === depuisNom('3P'));
check('la colonne d arrivee recoit la carte', sommet(apres, 'C4') === depuisNom('RC'));
check('une colonne sans carte cachee ne retourne rien',
    jouer(table, { type: 'deplacer', de: 'C3', index: 0, vers: 'C1' }).cachees[3] === 0);

// Transport d'une suite complete d'une colonne a l'autre.
const suite = etatManuel({ colonnes: ['9C', '8P 7C', '8T'] });
const transportee = jouer(suite, { type: 'deplacer', de: 'C1', index: 0, vers: 'C0' });
check('une suite entiere change de colonne',
    transportee.colonnes[0].length === 3 && transportee.colonnes[1].length === 0);
const coupee = jouer(suite, { type: 'deplacer', de: 'C1', index: 1, vers: 'C2' });
check('une suite se coupe pour n emporter que sa fin',
    coupee.colonnes[2].length === 2 && coupee.colonnes[1].length === 1);
check('une suite ne se pose pas sur une carte de meme couleur',
    jouer(suite, { type: 'deplacer', de: 'C1', index: 1, vers: 'C0' }) === null);

// Ce que le jeu propose au joueur.
const cibles = destinationsPour(table, 'C3', 0);
check('les destinations d une carte se listent', cibles.join() === 'C1');
check('une carte sans place ne propose rien', destinationsPour(table, 'C0', 0).length === 0);
const possibles = coupsPossibles(table);
check('les coups possibles incluent la pioche',
    coupsPossibles(partie).some(coup => coup.type === 'piocher'));
check('un talon vide propose la redonne a la place',
    possibles.some(coup => coup.type === 'redonner') && !possibles.some(coup => coup.type === 'piocher'));
check('les coups possibles sont tous jouables', possibles.every(coup => jouer(table, coup) !== null));
check('les coups possibles d une donne fraiche sont tous jouables',
    coupsPossibles(partie).every(coup => jouer(partie, coup) !== null));
check('les coups possibles ne se repetent pas',
    new Set(possibles.map(coup => JSON.stringify(coup))).size === possibles.length);

// Fin de partie.
const presqueGagnee = etatManuel({
    fondations: [
        'AP 2P 3P 4P 5P 6P 7P 8P 9P 10P VP DP RP',
        'AC 2C 3C 4C 5C 6C 7C 8C 9C 10C VC DC RC',
        'AK 2K 3K 4K 5K 6K 7K 8K 9K 10K VK DK RK',
        'AT 2T 3T 4T 5T 6T 7T 8T 9T 10T VT DT'
    ],
    colonnes: ['RT', '', '', '', '', '', '']
});
check('la partie n est pas gagnee avant la derniere carte', !gagnee(presqueGagnee));
check('le deroule automatique s annonce', derouleAutomatique(presqueGagnee));
check('la derniere carte gagne la partie',
    gagnee(jouer(presqueGagnee, { type: 'deplacer', de: 'C0', index: 0, vers: 'F3' })));
check('une partie fraiche ne se deroule pas toute seule', !derouleAutomatique(partie));

const copie = cloner(table);
copie.colonnes[0].push(depuisNom('RT'));
check('cloner detache vraiment les piles', table.colonnes[0].length === 1);

report();
