import { counter, lirePile } from './harness.mjs';
import { accepteColonne, accepteFondation, suiteValide, debutSuite } from '../js/regles.js';
import { depuisNom } from '../js/cartes.js';

const { check, report } = counter();
console.log('\nRegles\n');

const carte = depuisNom;

// Tableau : suite descendante, couleurs alternees.
check('une rouge se pose sur la noire du dessus', accepteColonne(lirePile('RP'), carte('DC')));
check('une noire se pose sur la rouge du dessus', accepteColonne(lirePile('DC'), carte('VT')));
check('deux cartes de meme couleur se refusent', !accepteColonne(lirePile('RP'), carte('DT')));
check('un ecart de deux rangs se refuse', !accepteColonne(lirePile('RP'), carte('VC')));
check('une carte plus haute se refuse', !accepteColonne(lirePile('DC'), carte('RP')));
check('une colonne vide n accepte que le roi', accepteColonne([], carte('RC')));
check('une colonne vide refuse la dame', !accepteColonne([], carte('DC')));

// Fondations : une par famille, de l'as au roi.
check('la fondation vide prend son as', accepteFondation([], 0, carte('AP')));
check('la fondation vide refuse le deux', !accepteFondation([], 0, carte('2P')));
check('la fondation refuse une autre famille', !accepteFondation([], 0, carte('AC')));
check('la fondation monte carte par carte', accepteFondation(lirePile('AP 2P'), 0, carte('3P')));
check('la fondation refuse un saut de rang', !accepteFondation(lirePile('AP'), 0, carte('3P')));
check('la fondation refuse une descente', !accepteFondation(lirePile('AP 2P 3P'), 0, carte('2P')));

// Suites transportables.
check('une carte seule est une suite', suiteValide(lirePile('7C')));
check('une suite alternee est valide', suiteValide(lirePile('RP DC VT 10K')));
check('une suite de meme couleur est invalide', suiteValide(lirePile('RP DT')) === false);
check('une suite qui saute un rang est invalide', suiteValide(lirePile('RP VC')) === false);
check('une suite montante est invalide', suiteValide(lirePile('10K VT')) === false);

// Ou commence la partie transportable d'une colonne.
check('toute la partie visible quand elle est en regle',
    debutSuite(lirePile('2P 3P RP DC VT'), 3) === 3);
check('la suite s arrete a la rupture',
    debutSuite(lirePile('2P RP 9C VT 10K'), 1) === 3);
check('une carte isolee au sommet reste seule',
    debutSuite(lirePile('RP DC 4T'), 0) === 2);
check('la suite ne remonte jamais dans les cartes cachees',
    debutSuite(lirePile('RP DC VT'), 2) === 2);

report();
