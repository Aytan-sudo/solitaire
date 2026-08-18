// Choix de la donne : le catalogue de graines gagnables, et comment y piocher.
//
// Le solveur n'existe pas dans le navigateur. Il a tourne une fois, hors
// ligne, et laisse ce fichier de graines derriere lui (scripts/catalogue.mjs).
// Ici on ne fait qu'y choisir un numero.

import { jourLocal } from './hasard.js';

// Origine du calendrier. Le defi du jour est un numero de jour, pas une date
// hachee : deux jours voisins donnent deux donnes voisines dans la liste, ce
// qui n'a aucune importance, et surtout la suite ne bouge jamais.
export const EPOQUE = Date.UTC(2026, 0, 1) / 86400000;

// Numero du jour, calcule sur la date locale. Le defi doit changer a minuit
// chez le joueur ; passer par UTC le ferait basculer a une heure batarde.
export function numeroDuJour(date = new Date()) {
    const [annee, mois, jour] = jourLocal(date).split('-').map(Number);
    return Date.UTC(annee, mois - 1, jour) / 86400000 - EPOQUE;
}

// Toutes les graines, triees. Le tri compte : c'est lui qui rend l'ordre
// independant de la moisson qui l'a produit.
export const graines = catalogue =>
    Object.values(catalogue.niveaux).flat().sort((a, b) => a - b);

// Defi du jour.
//
// Il ne pioche que dans les premieres graines du catalogue, en nombre fige a
// la generation. Sans ce garde-fou, agrandir le catalogue decalerait le
// modulo, et tous les defis passes — comme celui qu'un joueur a commence il y
// a dix minutes — changeraient de donne. Une moisson ultérieure ajoute des
// graines plus hautes : le debut de la liste, lui, ne bouge plus.
export function graineDuJour(catalogue, date = new Date()) {
    const liste = graines(catalogue).slice(0, catalogue.calendrier);
    const jour = numeroDuJour(date);
    return liste[((jour % liste.length) + liste.length) % liste.length];
}

export function graineAuHasard(catalogue, tirage = Math.random) {
    const liste = graines(catalogue);
    return liste[Math.floor(tirage() * liste.length)];
}

export const estGarantie = (catalogue, graine) => graines(catalogue).includes(graine);

// Difficulte annoncee par le catalogue. C'est l'effort qu'a coute la donne au
// solveur, pas celui qu'elle coutera au joueur : le solveur voit les cartes
// retournees, le joueur non. A prendre comme une indication, jamais comme une
// promesse.
export function niveauDe(catalogue, graine) {
    for (const [nom, liste] of Object.entries(catalogue.niveaux)) {
        if (liste.includes(graine)) return nom;
    }
    return null;
}

// Filet de secours, verifie comme le reste : si le catalogue ne se charge pas
// — premiere visite hors ligne, fichier oublie a la mise en ligne — le jeu
// reste jouable, et reste garanti. Vingt-quatre donnes suffisent a ce qu'on ne
// s'en apercoive pas tout de suite ; le defi du jour, lui, se contente de
// tourner plus vite.
export const CATALOGUE_DE_SECOURS = {
    version: 1,
    regles: { pioche: 1, redonnes: 'illimitees' },
    calendrier: 24,
    niveaux: { secours: [1,2,4,5,6,8,11,13,14,15,16,18,24,26,31,36,38,40,47,65,68,97,103,108] }
};

export async function chargerCatalogue(chemin = './data/donnes.json') {
    try {
        const reponse = await fetch(chemin);
        if (!reponse.ok) throw new Error(String(reponse.status));
        const catalogue = await reponse.json();
        if (!graines(catalogue).length) throw new Error('catalogue vide');
        return catalogue;
    } catch {
        return CATALOGUE_DE_SECOURS;
    }
}
