// Le paquet : une carte est un entier de 0 a 51, rien de plus.
//
// famille = carte / 13, valeur = carte % 13. Tout l'interet est la : une pile
// est un simple tableau d'entiers, un etat de partie complet tient dans une
// soixantaine de nombres, et l'annuler revient a en garder une copie. Le fait
// qu'une carte soit face visible ne se range pas dans la carte mais dans la
// pile qui la porte : au tableau, seules les premieres cartes d'une colonne
// sont retournees, et un simple compteur suffit a le dire.

export const FAMILLES = ['pique', 'coeur', 'carreau', 'trefle'];
export const SYMBOLES = ['♠', '♥', '♦', '♣'];
export const RANGS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

export const AS = 0;
export const ROI = 12;
export const TAILLE_PAQUET = 52;

export const famille = carte => (carte / 13) | 0;
export const valeur = carte => carte % 13;

// Coeur et carreau sont rouges : ce sont les familles 1 et 2.
export const rouge = carte => {
    const f = famille(carte);
    return f === 1 || f === 2;
};
export const noire = carte => !rouge(carte);

// Les couleurs alternent-elles ? C'est la seule chose que le tableau regarde ;
// la famille exacte ne compte que pour les fondations.
export const couleursOpposees = (a, b) => rouge(a) !== rouge(b);

export const carteDe = (indexFamille, indexValeur) => indexFamille * 13 + indexValeur;

export const nom = carte => `${RANGS[valeur(carte)]}${SYMBOLES[famille(carte)]}`;

export const paquetNeuf = () => Array.from({ length: TAILLE_PAQUET }, (_, i) => i);

// Lecture d'un nom court ('RC', '10P') : reserve aux tests et aux donnes
// ecrites a la main, ou aligner des entiers ne se relit pas.
export function depuisNom(texte) {
    const symbole = texte.slice(-1).toUpperCase();
    const rang = texte.slice(0, -1).toUpperCase();
    const indexFamille = ['P', 'C', 'K', 'T'].indexOf(symbole);
    const indexValeur = RANGS.indexOf(rang);
    if (indexFamille < 0 || indexValeur < 0) throw new Error(`carte inconnue : ${texte}`);
    return carteDe(indexFamille, indexValeur);
}
