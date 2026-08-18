// Hasard reproductible.
//
// Une donne se resume a une graine : c'est ce qui permet de rejouer la meme
// partie apres l'avoir perdue, de la partager par un lien, et de donner a tout
// le monde le meme defi du jour sans le moindre serveur.

// mulberry32 : court, rapide, et surtout identique d'un navigateur a l'autre.
// Math.random ne promet rien de tel, et ne se reseme pas.
export function alea(graine) {
    let etat = graine | 0;
    return () => {
        etat = (etat + 0x6D2B79F5) | 0;
        let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Melange de Fisher-Yates, en place. Le seul melange qui tire chacune des 52!
// permutations avec la meme probabilite ; les variantes approximatives donnent
// des paquets ou certaines cartes restent trop souvent voisines.
export function melanger(paquet, tirage) {
    for (let i = paquet.length - 1; i > 0; i--) {
        const j = Math.floor(tirage() * (i + 1));
        [paquet[i], paquet[j]] = [paquet[j], paquet[i]];
    }
    return paquet;
}

// Graine du jour, en heure locale : le defi doit changer a minuit chez le
// joueur, pas a une heure batarde imposee par UTC.
export function jourLocal(date = new Date()) {
    const mois = String(date.getMonth() + 1).padStart(2, '0');
    const jour = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mois}-${jour}`;
}

// FNV-1a : une date lisible devient un entier, de facon stable dans le temps.
export function empreinte(texte) {
    let h = 0x811C9DC5;
    for (let i = 0; i < texte.length; i++) {
        h ^= texte.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
