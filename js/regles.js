// Regles de placement du Klondike : ce qui peut se poser sur quoi.
//
// Ce module ne connait ni l'etat d'une partie ni les coups : il ne repond qu'a
// des questions locales, sur une carte et la pile qui la recoit. C'est ce qui
// permettra a une autre reussite (FreeCell, Spider) de ne remplacer que ce
// fichier, sans toucher au moteur ni au rendu.

import { couleursOpposees, famille, valeur, AS, ROI } from './cartes.js';

export const COLONNES = 7;
export const FONDATIONS = 4;

// Un tableau accueille une suite descendante de couleurs alternees ; une
// colonne vide n'accepte qu'un roi.
export function accepteColonne(colonne, carte) {
    if (colonne.length === 0) return valeur(carte) === ROI;
    const dessus = colonne[colonne.length - 1];
    return couleursOpposees(dessus, carte) && valeur(dessus) === valeur(carte) + 1;
}

// Une fondation monte, famille par famille, de l'as au roi. Elle porte le
// numero de sa famille : la carte doit tomber sur la bonne pile.
export function accepteFondation(fondation, indexFondation, carte) {
    if (famille(carte) !== indexFondation) return false;
    if (fondation.length === 0) return valeur(carte) === AS;
    return valeur(fondation[fondation.length - 1]) === valeur(carte) - 1;
}

// Un paquet ne se deplace d'une colonne a l'autre que s'il forme deja une
// suite en regle. On remonte donc depuis le bas de la pile et on s'arrete a la
// premiere rupture : au-dela, plus rien n'est deplacable.
export function suiteValide(cartes) {
    for (let i = 1; i < cartes.length; i++) {
        const precedente = cartes[i - 1];
        const carte = cartes[i];
        if (!couleursOpposees(precedente, carte)) return false;
        if (valeur(precedente) !== valeur(carte) + 1) return false;
    }
    return true;
}

// Index de la carte la plus haute qu'on puisse encore emporter dans une
// colonne : la tete de la plus longue suite en regle, jamais plus haut que la
// derniere carte retournee.
export function debutSuite(colonne, cachees) {
    let debut = colonne.length - 1;
    while (debut > cachees && suiteValide(colonne.slice(debut - 1))) debut--;
    return debut;
}
