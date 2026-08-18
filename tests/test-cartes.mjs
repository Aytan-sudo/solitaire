import { counter } from './harness.mjs';
import { paquetNeuf, famille, valeur, rouge, noire, couleursOpposees, nom, depuisNom, carteDe, TAILLE_PAQUET, AS, ROI } from '../js/cartes.js';
import { alea, melanger, empreinte, jourLocal } from '../js/hasard.js';

const { check, report } = counter();
console.log('\nCartes\n');

const paquet = paquetNeuf();
check('le paquet compte 52 cartes', paquet.length === TAILLE_PAQUET);
check('le paquet ne contient aucun doublon', new Set(paquet).size === TAILLE_PAQUET);
check('chaque famille compte treize cartes',
    [0, 1, 2, 3].every(f => paquet.filter(c => famille(c) === f).length === 13));
check('chaque valeur revient quatre fois',
    [...Array(13).keys()].every(v => paquet.filter(c => valeur(c) === v).length === 4));

check('coeur et carreau sont rouges', rouge(depuisNom('AC')) && rouge(depuisNom('AK')));
check('pique et trefle sont noirs', noire(depuisNom('AP')) && noire(depuisNom('AT')));
check('les couleurs opposees se reconnaissent', couleursOpposees(depuisNom('RP'), depuisNom('DC')));
check('deux noires ne sont pas opposees', !couleursOpposees(depuisNom('RP'), depuisNom('DT')));

check("l'as vaut zero et le roi douze", valeur(depuisNom('AP')) === AS && valeur(depuisNom('RP')) === ROI);
check('le nom se relit tel quel', [...Array(52).keys()].every(c => depuisNom(nom(c).replace('♠', 'P').replace('♥', 'C').replace('♦', 'K').replace('♣', 'T')) === c));
check('carteDe reconstruit la carte', carteDe(2, 5) === depuisNom('6K'));

// Un melange qui perd ou duplique une carte ne se voit qu'a la partie suivante.
const melange = melanger(paquetNeuf(), alea(12345));
check('le melange conserve les 52 cartes', new Set(melange).size === TAILLE_PAQUET);
check('le melange derange le paquet', melange.some((carte, i) => carte !== i));

// Deux joueurs qui ouvrent le meme defi doivent voir la meme donne.
const a = melanger(paquetNeuf(), alea(777));
const b = melanger(paquetNeuf(), alea(777));
check('une graine donne toujours le meme melange', a.every((carte, i) => carte === b[i]));
check('deux graines donnent des melanges differents',
    melanger(paquetNeuf(), alea(778)).some((carte, i) => carte !== a[i]));

check("l'empreinte d'une date est stable", empreinte('2026-08-18') === empreinte('2026-08-18'));
check('deux dates voisines ne se confondent pas', empreinte('2026-08-18') !== empreinte('2026-08-19'));
check('le jour local se lit AAAA-MM-JJ', /^\d{4}-\d{2}-\d{2}$/.test(jourLocal(new Date(2026, 7, 18))));
check('le jour local ne bascule pas la veille', jourLocal(new Date(2026, 7, 18, 0, 30)) === '2026-08-18');

report();
