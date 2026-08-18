// Etat d'une partie de Klondike, et ce que chaque coup lui fait.
//
// Aucun DOM ici : le moteur recoit des coups et rend un nouvel etat. Il est
// volontairement immuable — jouer ne modifie rien, il recopie. L'etat pese une
// soixantaine d'entiers, alors une copie par coup ne coute rien, et l'annuler
// se resume a garder la copie precedente. Pas de coup a inverser, donc pas de
// coup qu'on inverserait mal.
//
// Les piles portent un identifiant court, qui se relit dans les tests comme
// dans une URL : P pioche, D defausse, C0..C6 colonnes, F0..F3 fondations
// (une par famille, dans l'ordre de cartes.js).

import { paquetNeuf, TAILLE_PAQUET, famille, valeur, ROI } from './cartes.js';
import { alea, melanger } from './hasard.js';
import { COLONNES, FONDATIONS, accepteColonne, accepteFondation, suiteValide, debutSuite } from './regles.js';

export const PIOCHE = 'P';
export const DEFAUSSE = 'D';
export const colonneId = i => `C${i}`;
export const fondationId = i => `F${i}`;

export function nouvellePartie(graine = 1) {
    const paquet = melanger(paquetNeuf(), alea(graine));
    const colonnes = Array.from({ length: COLONNES }, () => []);

    // Distribution classique, en diagonale : une carte a chaque colonne restante,
    // rangee par rangee. La derniere de chaque colonne se retourne.
    let tirees = 0;
    for (let rangee = 0; rangee < COLONNES; rangee++) {
        for (let col = rangee; col < COLONNES; col++) colonnes[col].push(paquet[tirees++]);
    }

    return {
        graine,
        pioche: paquet.slice(tirees),
        defausse: [],
        fondations: Array.from({ length: FONDATIONS }, () => []),
        colonnes,
        cachees: colonnes.map(pile => pile.length - 1),
        redonnes: 0,
        coups: 0
    };
}

export const cloner = etat => ({
    graine: etat.graine,
    pioche: etat.pioche.slice(),
    defausse: etat.defausse.slice(),
    fondations: etat.fondations.map(pile => pile.slice()),
    colonnes: etat.colonnes.map(pile => pile.slice()),
    cachees: etat.cachees.slice(),
    redonnes: etat.redonnes,
    coups: etat.coups
});

export function pile(etat, id) {
    if (id === PIOCHE) return etat.pioche;
    if (id === DEFAUSSE) return etat.defausse;
    const index = Number(id.slice(1));
    if (id[0] === 'C') return etat.colonnes[index];
    if (id[0] === 'F') return etat.fondations[index];
    return undefined;
}

export const sommet = (etat, id) => {
    const p = pile(etat, id);
    return p && p.length ? p[p.length - 1] : null;
};

// Cartes qu'un coup emporte : une seule partout, sauf depuis une colonne ou on
// peut prendre toute une suite a partir d'une carte visible.
export function paquetDeplace(etat, de, index) {
    const p = pile(etat, de);
    if (!p || p.length === 0) return null;

    if (de[0] === 'C') {
        const cachees = etat.cachees[Number(de.slice(1))];
        if (!Number.isInteger(index) || index < cachees || index >= p.length) return null;
        const cartes = p.slice(index);
        return suiteValide(cartes) ? cartes : null;
    }
    if (de === DEFAUSSE || de[0] === 'F') return [p[p.length - 1]];
    return null;
}

export function coupValide(etat, coup) {
    if (coup.type === 'piocher') return etat.pioche.length > 0;
    if (coup.type === 'redonner') return etat.pioche.length === 0 && etat.defausse.length > 0;
    if (coup.type !== 'deplacer') return false;

    const cartes = paquetDeplace(etat, coup.de, coup.index);
    if (!cartes) return false;
    if (coup.de === coup.vers) return false;

    const destination = pile(etat, coup.vers);
    if (!destination) return false;

    if (coup.vers[0] === 'F') {
        // Une fondation ne prend qu'une carte a la fois, et jamais le milieu
        // d'une suite qu'on transporte.
        if (cartes.length !== 1) return false;
        return accepteFondation(destination, Number(coup.vers.slice(1)), cartes[0]);
    }
    if (coup.vers[0] === 'C') return accepteColonne(destination, cartes[0]);
    return false;
}

// Une colonne dont la derniere carte face visible vient de partir retourne
// celle du dessous : c'est le seul progres du Klondike, et le seul coup qui ne
// se defait pas tout seul.
function revelerSiBesoin(etat, index) {
    const colonne = etat.colonnes[index];
    if (etat.cachees[index] > 0 && etat.cachees[index] >= colonne.length) {
        etat.cachees[index] = colonne.length - 1;
    }
}

export function jouer(etat, coup) {
    if (!coupValide(etat, coup)) return null;
    const suivant = cloner(etat);
    suivant.coups++;

    if (coup.type === 'piocher') {
        suivant.defausse.push(suivant.pioche.pop());
        return suivant;
    }
    if (coup.type === 'redonner') {
        suivant.pioche = suivant.defausse.reverse();
        suivant.defausse = [];
        suivant.redonnes++;
        return suivant;
    }

    const source = pile(suivant, coup.de);
    const cartes = coup.de[0] === 'C' ? source.splice(coup.index) : [source.pop()];
    pile(suivant, coup.vers).push(...cartes);
    if (coup.de[0] === 'C') revelerSiBesoin(suivant, Number(coup.de.slice(1)));
    return suivant;
}

// Toutes les destinations legales pour une carte donnee. Sert au clic-clic, au
// glisser (pour eclairer les cibles) et a l'indice.
export function destinationsPour(etat, de, index) {
    const cartes = paquetDeplace(etat, de, index);
    if (!cartes) return [];
    const cibles = [];
    for (let i = 0; i < FONDATIONS; i++) cibles.push(fondationId(i));
    for (let i = 0; i < COLONNES; i++) cibles.push(colonneId(i));
    return cibles.filter(vers => coupValide(etat, { type: 'deplacer', de, index, vers }));
}

export function coupsPossibles(etat) {
    const coups = [];
    if (etat.pioche.length) coups.push({ type: 'piocher' });
    else if (etat.defausse.length) coups.push({ type: 'redonner' });

    const sources = [];
    if (etat.defausse.length) sources.push([DEFAUSSE, etat.defausse.length - 1]);
    for (let i = 0; i < FONDATIONS; i++) {
        if (etat.fondations[i].length) sources.push([fondationId(i), etat.fondations[i].length - 1]);
    }
    for (let i = 0; i < COLONNES; i++) {
        const colonne = etat.colonnes[i];
        for (let index = debutSuite(colonne, etat.cachees[i]); index >= 0 && index < colonne.length; index++) {
            sources.push([colonneId(i), index]);
        }
    }

    for (const [de, index] of sources) {
        for (const vers of destinationsPour(etat, de, index)) {
            coups.push({ type: 'deplacer', de, index, vers });
        }
    }
    return coups;
}

export const cartesAuxFondations = etat => etat.fondations.reduce((total, pile) => total + pile.length, 0);
export const gagnee = etat => cartesAuxFondations(etat) === TAILLE_PAQUET;

// Toutes les cartes sont retournees : la fin n'est plus qu'une formalite, le
// jeu peut proposer de la derouler tout seul.
export const derouleAutomatique = etat =>
    !gagnee(etat) && etat.cachees.every(compte => compte === 0) && etat.pioche.length + etat.defausse.length === 0;
