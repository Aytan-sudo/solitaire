// Le solveur : cette donne est-elle gagnable ?
//
// Il ne sert pas pendant la partie — prouver qu'une donne est perdue coute
// tres cher, il faut epuiser l'arbre. Il sert a l'inverse, hors ligne, pour
// moissonner des donnes dont on a trouve une solution : scripts/catalogue.mjs
// lui fait tourner des graines, et ne garde que celles qu'il resout.
//
// Deux simplifications le rendent viable, toutes deux liees aux regles
// retenues (pioche par 1, redonnes illimitees) :
//
// 1. Le talon est un ensemble. On peut toujours le faire defiler jusqu'a la
//    carte voulue et le retourner autant qu'on veut : n'importe quelle carte
//    du talon est donc jouable a tout instant. L'ordre disparait, et avec lui
//    une dimension entiere de la recherche. Cette equivalence tombe des qu'on
//    pioche par trois ou qu'on limite les redonnes : le catalogue est lie a
//    ces regles-la.
//
// 2. Les montees sures ne se discutent pas. Une carte de rang r ne peut servir
//    dans le tableau qu'aux deux cartes de rang r-1 de couleur opposee ; si
//    ces deux familles sont deja montees jusqu'a r-1, la monter ne coute
//    jamais rien. Ces coups sont joues d'office, sans creer d'embranchement.
//
// Le remonte-fondation (rendre une carte deja montee au tableau) est en
// revanche ignore, alors que le jeu l'autorise. Le solveur est donc prudent :
// il peut echouer sur une donne gagnable, jamais reussir sur une perdue. Pour
// un catalogue, c'est le bon sens de l'erreur.

import { famille, valeur, TAILLE_PAQUET } from './cartes.js';
import { alea, melanger } from './hasard.js';
import { COLONNES, FONDATIONS, accepteColonne, debutSuite } from './regles.js';

// Familles de la couleur opposee, pour la regle des montees sures.
const OPPOSEES = [[1, 2], [0, 3], [0, 3], [1, 2]];

export const depuisPartie = etat => ({
    cols: etat.colonnes.map(pile => pile.slice()),
    caches: etat.cachees.slice(),
    fonds: etat.fondations.map(pile => pile.length),
    talon: [...etat.pioche, ...etat.defausse]
});

const cloner = e => ({
    cols: e.cols.map(pile => pile.slice()),
    caches: e.caches.slice(),
    fonds: e.fonds.slice(),
    talon: e.talon.slice()
});

export const gagne = e => e.fonds[0] + e.fonds[1] + e.fonds[2] + e.fonds[3] === TAILLE_PAQUET;

// Une fondation qui compte n cartes attend le rang n : la carte suivante est
// donc celle dont la valeur egale la hauteur de sa pile.
const montable = (e, carte) => e.fonds[famille(carte)] === valeur(carte);

const sure = (e, carte) => {
    const v = valeur(carte);
    if (v <= 1) return true;
    const [a, b] = OPPOSEES[famille(carte)];
    return e.fonds[a] >= v && e.fonds[b] >= v;
};

const reveler = (e, i) => {
    if (e.caches[i] > 0 && e.caches[i] >= e.cols[i].length) e.caches[i] = e.cols[i].length - 1;
};

// Identite d'une position. Les colonnes sont triees : leur numero ne veut rien
// dire au Klondike, seul leur contenu compte, et sans ce tri le solveur
// reexplore la meme position autant de fois qu'il y a de facons de ranger deux
// colonnes vides. Les cartes cachees figurent en clair dans la cle : c'est ce
// qui permet de trier sans jamais confondre deux colonnes distinctes.
export function cle(e) {
    const colonnes = e.cols
        .map((pile, i) => String.fromCharCode(e.caches[i], ...pile))
        .sort();
    const talon = e.talon.slice().sort((a, b) => a - b);
    return `${colonnes.join('|')}#${String.fromCharCode(...e.fonds)}#${String.fromCharCode(...talon)}`;
}

// Montees qui ne se discutent pas. Rendues a part pour que la solution relue
// contienne bien tous les coups.
function forcer(e) {
    const coups = [];
    for (let bouge = true; bouge;) {
        bouge = false;

        for (let k = 0; k < e.talon.length && !bouge; k++) {
            const carte = e.talon[k];
            if (!montable(e, carte) || !sure(e, carte)) continue;
            e.talon.splice(k, 1);
            e.fonds[famille(carte)]++;
            coups.push({ de: 'T', carte, vers: 'F' });
            bouge = true;
        }
        if (bouge) continue;

        for (let i = 0; i < COLONNES && !bouge; i++) {
            const colonne = e.cols[i];
            if (colonne.length === 0) continue;
            const carte = colonne[colonne.length - 1];
            if (!montable(e, carte) || !sure(e, carte)) continue;
            colonne.pop();
            e.fonds[famille(carte)]++;
            reveler(e, i);
            coups.push({ de: 'C', i, index: colonne.length, vers: 'F' });
            bouge = true;
        }
    }
    return coups;
}

// Les coups a essayer, du plus prometteur au moins. L'ordre fait tout : une
// recherche en profondeur qui commence par les deplacements steriles part pour
// des millions de noeuds, la meme qui commence par ce qui retourne une carte
// trouve une solution en quelques milliers.
const RETOURNE = 0;   // decouvre une carte cachee : le seul vrai progres
const MONTE = 1;      // monte a une fondation sans etre sur
const TALON = 2;      // sort une carte du talon vers le tableau
const VIDE = 3;       // occupe une colonne vide
const RANGE = 4;      // simple rangement, souvent sterile

export function coups(e, tirage = null) {
    const liste = [];

    for (let i = 0; i < COLONNES; i++) {
        const colonne = e.cols[i];
        if (colonne.length === 0) continue;
        const carte = colonne[colonne.length - 1];
        if (montable(e, carte)) {
            liste.push({ de: 'C', i, index: colonne.length - 1, vers: 'F', rang: MONTE });
        }
    }
    for (const carte of e.talon) {
        if (montable(e, carte)) liste.push({ de: 'T', carte, vers: 'F', rang: MONTE });
    }
    for (const carte of e.talon) {
        for (let j = 0; j < COLONNES; j++) {
            if (accepteColonne(e.cols[j], carte)) {
                liste.push({ de: 'T', carte, vers: 'C', j, rang: TALON });
            }
        }
    }

    for (let i = 0; i < COLONNES; i++) {
        const colonne = e.cols[i];
        if (colonne.length === 0) continue;
        const debut = debutSuite(colonne, e.caches[i]);

        for (let index = debut; index < colonne.length; index++) {
            const carte = colonne[index];
            for (let j = 0; j < COLONNES; j++) {
                if (i === j || !accepteColonne(e.cols[j], carte)) continue;

                // Vider une colonne pour en remplir une autre ne change rien a
                // la position, et sans ce garde-fou les rois se renvoient la
                // balle indefiniment.
                if (index === 0 && e.cols[j].length === 0) continue;

                const decouvre = index === e.caches[i] && e.caches[i] > 0;
                const rang = decouvre ? RETOURNE : (e.cols[j].length === 0 ? VIDE : RANGE);
                liste.push({ de: 'C', i, index, vers: 'C', j, rang });
            }
        }
    }

    // Melange d'abord, tri par rang ensuite : le tri de JavaScript est stable,
    // alors les coups de meme interet gardent l'ordre bouscule. C'est ce qui
    // donne son mordant aux relances — une recherche en profondeur qui s'est
    // engagee dans une mauvaise branche y reste jusqu'a epuiser son budget,
    // tandis que deux departs differents tombent rarement dans le meme piege.
    if (tirage) melanger(liste, tirage);
    liste.sort((a, b) => a.rang - b.rang);
    return liste;
}

export function appliquer(e, coup) {
    const suivant = cloner(e);

    if (coup.de === 'T') {
        suivant.talon.splice(suivant.talon.indexOf(coup.carte), 1);
        if (coup.vers === 'F') suivant.fonds[famille(coup.carte)]++;
        else suivant.cols[coup.j].push(coup.carte);
        return suivant;
    }

    const colonne = suivant.cols[coup.i];
    const cartes = colonne.splice(coup.index);
    if (coup.vers === 'F') suivant.fonds[famille(cartes[0])]++;
    else suivant.cols[coup.j].push(...cartes);
    reveler(suivant, coup.i);
    return suivant;
}

// Recherche en profondeur, table de transpositions, budget de noeuds.
//
// Le budget n'est pas un pis-aller : une donne qui resiste est simplement
// ecartee du catalogue, et il y a une infinite de graines. Mieux vaut cent
// donnes trouvees vite qu'une seule prouvee a grands frais. Le nombre de
// noeuds depenses est rendu, il fait un bon etalon de difficulte.
export function resoudre(depart, { budget = 25000, tirage = null } = {}) {
    const racine = cloner(depart);
    const forces = forcer(racine);

    if (gagne(racine)) return { gagnee: true, epuise: false, noeuds: 0, solution: forces };

    const vus = new Set([cle(racine)]);
    const pile = [{ etat: racine, liste: coups(racine, tirage), i: 0, coup: null, forces }];
    let noeuds = 0;

    while (pile.length) {
        const cadre = pile[pile.length - 1];

        if (cadre.i >= cadre.liste.length) { pile.pop(); continue; }
        if (noeuds >= budget) return { gagnee: false, epuise: true, noeuds, solution: null };

        const coup = cadre.liste[cadre.i++];
        const suivant = appliquer(cadre.etat, coup);
        const enchaines = forcer(suivant);
        noeuds++;

        const empreinte = cle(suivant);
        if (vus.has(empreinte)) continue;
        vus.add(empreinte);

        if (gagne(suivant)) {
            const solution = pile.flatMap(c => (c.coup ? [c.coup, ...c.forces] : c.forces));
            return { gagnee: true, epuise: false, noeuds, solution: [...solution, coup, ...enchaines] };
        }
        pile.push({ etat: suivant, liste: coups(suivant, tirage), i: 0, coup, forces: enchaines });
    }
    return { gagnee: false, epuise: false, noeuds, solution: null };
}

// Plusieurs recherches courtes valent mieux qu'une longue : a temps egal, les
// relances resolvent la moitie de donnes en plus. Le nombre de relances qu'il
// a fallu fait un etalon de difficulte honnete — celle du solveur, pas celle
// du joueur, mais les deux vont dans le meme sens.
export function resoudreAvecRelances(depart, { budget = 12000, relances = 8, graine = 1 } = {}) {
    let noeuds = 0;

    for (let essai = 0; essai < relances; essai++) {
        // La premiere passe garde l'ordre fixe : c'est la plus efficace prise
        // isolement, et les donnes faciles tombent sans jamais tirer au sort.
        const tirage = essai === 0 ? null : alea(graine * 1000 + essai);
        const resultat = resoudre(depart, { budget, tirage });
        noeuds += resultat.noeuds;

        if (resultat.gagnee) return { ...resultat, noeuds, essais: essai + 1 };
        // Une recherche qui a fini son arbre sans budget epuise a tout vu :
        // la donne est perdue, la relancer ne changerait rien.
        if (!resultat.epuise) return { ...resultat, noeuds, essais: essai + 1 };
    }
    return { gagnee: false, epuise: true, noeuds, solution: null, essais: relances };
}
