// Harnais commun aux tests. Le noyau du jeu (cartes, regles, partie, solveur)
// ne touche pas au DOM : il se teste en Node, sans navigateur.

import { depuisNom, famille, nom, TAILLE_PAQUET } from '../js/cartes.js';
import { COLONNES, FONDATIONS } from '../js/regles.js';
import { nouvellePartie, jouer, sommet, gagnee, DEFAUSSE, colonneId, fondationId } from '../js/partie.js';

export function counter() {
    const etat = { pass: 0, fail: 0 };
    const check = (libelle, condition, detail = '') => {
        if (condition) { etat.pass++; console.log(`  OK    ${libelle}`); }
        else { etat.fail++; console.log(`  ECHEC ${libelle} ${detail}`); }
    };
    const report = () => {
        console.log(`\n${etat.pass} reussis, ${etat.fail} echecs\n`);
        process.exit(etat.fail === 0 ? 0 : 1);
    };
    return { check, report };
}

// Lecture d'une pile ecrite a la main : 'RP DC 10T'. Une position posee en
// entiers ne se relit pas, et un test qu'on ne relit pas ne se corrige pas.
export const lirePile = texte => (texte.trim() ? texte.trim().split(/\s+/).map(depuisNom) : []);

// Position construite de toutes pieces, pour eprouver un coup precis sans
// avoir a chercher la donne qui l'amenerait.
export function etatManuel({ colonnes = [], cachees, pioche = '', defausse = '', fondations = [] } = {}) {
    const tableau = Array.from({ length: COLONNES }, (_, i) => lirePile(colonnes[i] ?? ''));
    return {
        graine: 0,
        pioche: lirePile(pioche),
        defausse: lirePile(defausse),
        fondations: Array.from({ length: FONDATIONS }, (_, i) => lirePile(fondations[i] ?? '')),
        colonnes: tableau,
        cachees: tableau.map((pile, i) => cachees?.[i] ?? 0),
        redonnes: 0,
        coups: 0
    };
}

// Rejoue une solution dans le moteur. Les coups du talon ne disent pas combien
// de fois piocher : le solveur tient le talon pour un ensemble, c'est ici
// qu'on paie la difference en tours de talon.
export function rejouer(graine, solution) {
    let etat = nouvellePartie(graine);

    for (const coup of solution) {
        if (coup.de === 'T') {
            let tours = 0;
            while (sommet(etat, DEFAUSSE) !== coup.carte) {
                const suivant = jouer(etat, { type: etat.pioche.length ? 'piocher' : 'redonner' });
                if (!suivant || ++tours > TAILLE_PAQUET * 3) {
                    return { ok: false, ou: `talon introuvable pour ${nom(coup.carte)}` };
                }
                etat = suivant;
            }
            const vers = coup.vers === 'F' ? fondationId(famille(coup.carte)) : colonneId(coup.j);
            const suivant = jouer(etat, { type: 'deplacer', de: DEFAUSSE, index: 0, vers });
            if (!suivant) return { ok: false, ou: `${nom(coup.carte)} refusee vers ${vers}` };
            etat = suivant;
            continue;
        }

        const carte = etat.colonnes[coup.i][coup.index];
        if (carte === undefined) return { ok: false, ou: `case vide en C${coup.i}[${coup.index}]` };
        const vers = coup.vers === 'F' ? fondationId(famille(carte)) : colonneId(coup.j);
        const suivant = jouer(etat, { type: 'deplacer', de: colonneId(coup.i), index: coup.index, vers });
        if (!suivant) return { ok: false, ou: `${nom(carte)} refusee de C${coup.i} vers ${vers}` };
        etat = suivant;
    }
    return { ok: gagnee(etat), ou: gagnee(etat) ? '' : 'la solution ne mene pas a la victoire', etat };
}
