// Preferences, statistiques, partie en cours.
//
// Tout tient dans le localStorage, qui peut manquer — navigation privee,
// stockage refuse. Rien ici ne doit faire tomber le jeu pour autant : une
// partie qu'on ne peut pas sauvegarder reste une partie jouable.

const CLE_PREFERENCES = 'solitaire.preferences';
const CLE_STATS = 'solitaire.stats';
const CLE_PARTIE = 'solitaire.partie';

export const PREFERENCES_PAR_DEFAUT = { theme: 'auto', tapis: 'vert', ouvert: false };

export const STATS_PAR_DEFAUT = {
    jouees: 0,
    gagnees: 0,
    serie: 0,
    meilleureSerie: 0,
    meilleurTemps: null,
    defis: {}          // jour -> secondes, pour savoir ce qui est deja fait
};

function lire(cle, defaut) {
    try {
        const brut = localStorage.getItem(cle);
        if (!brut) return { ...defaut };
        return { ...defaut, ...JSON.parse(brut) };
    } catch {
        return { ...defaut };
    }
}

function ecrire(cle, valeur) {
    try {
        localStorage.setItem(cle, JSON.stringify(valeur));
        return true;
    } catch {
        return false;
    }
}

export const lirePreferences = () => lire(CLE_PREFERENCES, PREFERENCES_PAR_DEFAUT);
export const ecrirePreferences = preferences => ecrire(CLE_PREFERENCES, preferences);

// Un record n'a de sens que compare a ce qui lui ressemble. Une partie ou
// toutes les cartes sont visibles n'a rien a voir avec une partie en aveugle :
// les deux tiennent leurs comptes chacune de leur cote, plutot que de melanger
// dans un meme palmares des parties incomparables. Le mode classique garde la
// cle d'origine, pour ne pas effacer les parties deja jouees.
const cleStats = ouvert => (ouvert ? `${CLE_STATS}.ouvert` : CLE_STATS);

export const lireStats = (ouvert = false) => lire(cleStats(ouvert), STATS_PAR_DEFAUT);

// Une partie compte des qu'elle est terminee — gagnee ou abandonnee pour une
// autre. Compter les seules victoires donnerait un taux de reussite de cent
// pour cent, ce qui ne renseigne personne.
export function enregistrerFin({ gagnee, secondes, defi = null, ouvert = false }) {
    const stats = lireStats(ouvert);
    stats.jouees++;

    if (gagnee) {
        stats.gagnees++;
        stats.serie++;
        stats.meilleureSerie = Math.max(stats.meilleureSerie, stats.serie);
        if (stats.meilleurTemps === null || secondes < stats.meilleurTemps) stats.meilleurTemps = secondes;
        if (defi) stats.defis = elaguer({ ...stats.defis, [defi]: secondes });
    } else {
        stats.serie = 0;
    }

    ecrire(cleStats(ouvert), stats);
    return stats;
}

// Les defis ne servent qu'a griser le bouton du jour : deux mois suffisent
// largement, et le stockage local n'est pas extensible.
function elaguer(defis) {
    const jours = Object.keys(defis).sort();
    return Object.fromEntries(jours.slice(-60).map(jour => [jour, defis[jour]]));
}

export const defiFait = (stats, jour) => jour in stats.defis;

// Partie en cours. L'etat pese une soixantaine d'entiers : le sauver a chaque
// coup ne coute rien, et evite d'avoir a deviner quand le faire.
export const sauverPartie = partie => ecrire(CLE_PARTIE, partie);

export function lirePartie() {
    try {
        const brut = localStorage.getItem(CLE_PARTIE);
        if (!brut) return null;
        const partie = JSON.parse(brut);
        return partie?.etat?.colonnes?.length === 7 ? partie : null;
    } catch {
        return null;
    }
}

export function oublierPartie() {
    try { localStorage.removeItem(CLE_PARTIE); } catch { /* rien a faire */ }
}
