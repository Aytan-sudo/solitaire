// Le cablage : ce qui relie le moteur, le tapis et le joueur.
//
// Tout ce qui decide est ailleurs — les regles dans partie.js, le choix de la
// donne dans donne.js, l'allure dans rendu.js. Ce fichier ne fait qu'ordonner
// les evenements : un coup, un dessin, une sauvegarde.

import { nouvellePartie, jouer as jouerCoup, coupsPossibles, gagnee, derouleAutomatique, sommet } from './partie.js';
import { chargerCatalogue, graineDuJour, graineAuHasard, estGarantie } from './donne.js';
import { jourLocal, depuisJourLocal } from './hasard.js';
import { creerRendu } from './rendu.js';
import { creerGestes } from './geste.js';
import { creerInterface, formaterJour } from './ui.js';
import { messageDePartage } from './partage.js';
import {
    preparerSon, surveillerVisibilite, sonPose, sonFondation, sonRetournement,
    sonPioche, sonRedonne, sonRefus, sonVictoire
} from './son.js';
import {
    interdireDoubleTap, basculerPlein, pleinDisponible, estPlein, estInstalle, surChangementPlein
} from './ecran.js';
import * as themes from './themes.js';
import {
    lirePreferences, ecrirePreferences, lireStats, enregistrerFin, defiFait,
    sauverPartie, lirePartie, oublierPartie
} from './storage.js';

const plateau = document.getElementById('plateau');
const rendu = creerRendu({
    plateau,
    emplacements: document.getElementById('emplacements'),
    cartes: document.getElementById('cartes')
});

let preferences = lirePreferences();
let catalogue = null;

const jeu = {
    etat: null,
    graine: null,
    defi: null,        // jour du defi, s'il compte pour la serie
    jour: null,        // jour dont c'est la grille, meme rouvert plus tard
    ouvert: false,     // mode de la partie en cours, fige a la donne
    secondes: 0,       // temps deja accumule
    depuis: null,      // debut de la tranche en cours, null si a l'arret
    finie: false
};

// Chrono ---------------------------------------------------------------
//
// Le temps se calcule a partir d'horodatages, pas en comptant des battements :
// un onglet mis en arriere-plan ralentit les minuteries, et le joueur qui
// revient retrouverait un chrono en retard sur sa partie.

const ecoule = () =>
    Math.floor(jeu.secondes + (jeu.depuis === null ? 0 : (Date.now() - jeu.depuis) / 1000));

function demarrerChrono() {
    if (jeu.depuis === null && !jeu.finie) jeu.depuis = Date.now();
}

function arreterChrono() {
    if (jeu.depuis === null) return;
    jeu.secondes += (Date.now() - jeu.depuis) / 1000;
    jeu.depuis = null;
}

setInterval(() => ihm.majCompteurs(ecoule(), jeu.etat?.coups ?? 0), 500);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { arreterChrono(); sauver(); }
    else if (jeu.etat?.coups > 0) demarrerChrono();
});

// Deroulement d'une partie ---------------------------------------------

function installer(etat, { graine, defi = null, jour = defi, ouvert = false, secondes = 0, anime = true }) {
    Object.assign(jeu, { etat, graine, defi, jour, ouvert, secondes, depuis: null, finie: gagnee(etat) });
    if (anime) rendu.distribuer(etat); else rendu.dessiner(etat, { anime: false });
    apresCoup({ sauver: false });
}

function commencer({ graine, defi = null, jour = defi }) {
    abandonner();
    ihm.fermerFeuilles();
    installer(nouvellePartie(graine, { ouvert: preferences.ouvert }),
        { graine, defi, jour, ouvert: preferences.ouvert });

    // Un lien partage peut porter n'importe quel numero, y compris une donne
    // que personne n'a jamais resolue. Le jeu la distribue quand meme — c'est
    // ce qu'on lui demande — mais il ne laisse pas croire qu'elle est garantie.
    if (jour) ihm.annoncer(`Défi du ${formaterJour(jour)}`);
    else if (estGarantie(catalogue, graine)) ihm.annoncer(`Donne n° ${graine}`);
    else ihm.annoncer(`Donne n° ${graine} — non garantie`);
}

// Le defi d'un jour donne. Rouvert plus tard, un lien redonne bien sa grille —
// c'est tout l'interet de le partager — mais hors serie : seule la partie
// jouee le jour meme compte au palmares du defi. D'ou les deux champs, le
// `jour` qu'on affiche et le `defi` qu'on comptabilise.
function commencerDefi(jour = jourLocal()) {
    commencer({
        graine: graineDuJour(catalogue, depuisJourLocal(jour)),
        defi: jour === jourLocal() ? jour : null,
        jour
    });
}

// Une partie entamee puis quittee compte comme perdue. Ne compter que les
// victoires donnerait cent pour cent de reussite, ce qui ne renseigne
// personne — surtout avec des donnes toutes gagnables.
function abandonner() {
    if (!jeu.etat || jeu.finie || jeu.etat.coups === 0) return;
    arreterChrono();
    enregistrerFin({ gagnee: false, secondes: ecoule(), defi: jeu.defi, ouvert: jeu.ouvert });
    rafraichirStats();
}

function jouer(coup) {
    if (jeu.finie) return false;
    const suivant = jouerCoup(jeu.etat, coup);
    if (!suivant) return false;

    sonner(jeu.etat, suivant, coup);
    jeu.etat = suivant;
    demarrerChrono();
    rendu.dessiner(jeu.etat);
    apresCoup();
    return true;
}

// Sensations -----------------------------------------------------------
//
// Ce que le coup a fait ne se lit pas dans le coup, mais dans l'ecart entre les
// deux etats : une carte retournee, par exemple, n'est demandee par personne —
// elle arrive parce qu'une colonne s'est decouverte. C'est donc l'ecart qu'on
// ecoute.

const cachees = etat => etat.cachees.reduce((total, compte) => total + compte, 0);

function sonner(avant, apres, coup) {
    if (!preferences.sons && !preferences.vibration) return;

    // Le retournement passe devant : c'est le seul vrai progres du Klondike, et
    // il vaut mieux l'entendre que d'entendre la pose qui l'a provoque.
    if (cachees(apres) < cachees(avant)) {
        emettre(sonRetournement, [12, 26, 12]);
        return;
    }
    if (coup.type === 'piocher') return emettre(sonPioche, null);
    if (coup.type === 'redonner') return emettre(sonRedonne, 14);
    if (coup.vers[0] === 'F') return emettre(() => sonFondation(sommet(apres, coup.vers)), 12);
    emettre(sonPose, 10);
}

// Le deroule final enchaine jusqu'a cinquante montees en quelques secondes.
// Les entendre grimper est agreable ; les sentir toutes vibrer ne l'est pas.
let deroule = false;

function emettre(son, vibration) {
    if (preferences.sons) son();
    if (preferences.vibration && vibration !== null && !deroule) navigator.vibrate?.(vibration);
}

// La tape qui ne mene nulle part. Elle ne passe pas par jouer() — aucun etat ne
// change — mais c'est bien une reponse du jeu, et la seule qu'il donne.
function refuser(carte) {
    rendu.refuser(carte);
    emettre(sonRefus, 30);
}

function apresCoup({ sauver: doitSauver = true } = {}) {
    ihm.majCompteurs(ecoule(), jeu.etat.coups);
    ihm.majTerminer(derouleAutomatique(jeu.etat));
    if (doitSauver) sauver();
    if (gagnee(jeu.etat)) gagner();
}

function sauver() {
    if (!jeu.etat || jeu.finie) return;
    sauverPartie({
        etat: jeu.etat,
        graine: jeu.graine,
        defi: jeu.defi,
        jour: jeu.jour,
        ouvert: jeu.ouvert,
        secondes: ecoule(),
        version: 1
    });
}

function gagner() {
    arreterChrono();
    jeu.finie = true;
    oublierPartie();
    ihm.majTerminer(false);

    const secondes = ecoule();
    const avant = lireStats(jeu.ouvert).meilleurTemps;
    const record = avant === null || secondes < avant;

    enregistrerFin({ gagnee: true, secondes, defi: jeu.defi, ouvert: jeu.ouvert });
    rafraichirStats();
    if (preferences.sons) sonVictoire();
    if (preferences.vibration) navigator.vibrate?.([16, 60, 16, 60, 30]);

    setTimeout(() => ihm.montrerVictoire({
        secondes, nombreCoups: jeu.etat.coups, defi: jeu.defi, record
    }), 700);
}

// Deroule final. Il ne joue que des montees : quand il n'en reste plus, c'est
// qu'une carte gene encore, et le joueur reprend la main. Une position ou tout
// est retourne n'est pas toujours rangeable d'un seul geste.
function terminer() {
    const coup = coupsPossibles(jeu.etat).find(c => c.type === 'deplacer' && c.vers[0] === 'F');
    if (!coup) {
        deroule = false;
        if (!gagnee(jeu.etat)) ihm.annoncer('Il reste des cartes à déplacer.');
        return;
    }
    deroule = true;
    jouer(coup);
    setTimeout(terminer, 110);
}

// Preferences ----------------------------------------------------------

function appliquerPreferences() {
    themes.appliquer(preferences);
    ihm.majPreferences(preferences);
    ecrirePreferences(preferences);
}

// Ce que le panneau des reglages a le droit de proposer depend du navigateur,
// et de l'endroit d'ou le jeu est ouvert.
const rafraichirEcran = () => ihm.majEcran({
    disponible: pleinDisponible(),
    actif: estPlein(),
    installe: estInstalle()
});

// Le panneau montre les comptes du mode choisi, celui qu'on jouera au
// prochain coup de cartes — pas forcement celui de la partie en cours.
function rafraichirStats() {
    const stats = lireStats(preferences.ouvert);
    ihm.majStats(stats, defiFait(stats, jourLocal()), preferences.ouvert);
}

// Partage --------------------------------------------------------------
//
// Le lien ne porte que de quoi refabriquer la donne — un jour, ou un numero.
// Jamais le resultat, jamais la solution : celui qui l'ouvre commence a zero,
// avec les memes cartes.

async function partager() {
    const texte = messageDePartage({
        base: location.href,
        jour: jeu.jour,
        graine: jeu.graine,
        ouvert: jeu.ouvert,
        gagnee: jeu.finie,
        secondes: ecoule(),
        coups: jeu.etat?.coups ?? 0
    });

    try {
        // La feuille de partage du systeme d'abord : c'est elle qu'on attend au
        // telephone, et elle laisse le joueur choisir ou va son resultat. Le
        // presse-papier n'est qu'un repli, pour l'ordinateur.
        if (navigator.share) await navigator.share({ title: 'Solitaire', text: texte });
        else {
            await navigator.clipboard.writeText(texte);
            ihm.annoncer('Le message est copié.');
        }
    } catch (erreur) {
        // Refermer la feuille sans rien choisir n'est pas un echec.
        if (erreur?.name !== 'AbortError') ihm.annoncer('Le partage n’a pas fonctionné.');
    }
}

// Mise en place --------------------------------------------------------

const ihm = creerInterface({
    // Le mode se fige a la donne. Une partie pas encore entamee se
    // redistribue aussitot — meme numero, meme donne, cartes visibles. Une
    // partie en cours, elle, ne se convertit pas : on ne peut pas recacher des
    // cartes qui ont deja bouge.
    surMode: ouvert => {
        if (preferences.ouvert === ouvert) return;
        preferences = { ...preferences, ouvert };
        appliquerPreferences();
        rafraichirStats();

        if (jeu.etat && jeu.etat.coups === 0 && !jeu.finie) {
            installer(nouvellePartie(jeu.graine, { ouvert }), { graine: jeu.graine, defi: jeu.defi, ouvert });
            ihm.annoncer(ouvert ? 'Donne ouverte' : 'Donne classique');
        } else {
            ihm.annoncer('S’appliquera à la prochaine donne');
        }
    },
    surTheme: theme => { preferences = { ...preferences, theme }; appliquerPreferences(); },
    surSensation: (nom, actif) => { preferences = { ...preferences, [nom]: actif }; appliquerPreferences(); },
    surTapis: tapis => { preferences = { ...preferences, tapis }; appliquerPreferences(); },
    // Le plein ecran ne se retient pas d'une partie a l'autre : le rouvrir
    // demande un geste du joueur, et un jeu qui s'y jetterait au premier appui
    // au retour serait plus surprenant qu'utile.
    surPlein: async () => {
        if (!await basculerPlein()) ihm.annoncer('Le plein écran a été refusé.');
        rafraichirEcran();
    },
    surNouvelle: () => commencer({ graine: graineAuHasard(catalogue) }),
    surDefi: () => commencerDefi(),
    surRejouer: () => commencer({ graine: jeu.graine }),
    surTerminer: terminer,
    surPartager: partager
});

creerGestes({
    plateau,
    rendu,
    lire: () => jeu.etat,
    jouer,
    refuser,
    annoncer: ihm.annoncer
});

// Le contexte audio se prepare des le premier geste, avant que le jeu n'ait une
// note a demander : iOS ne le laisse demarrer que depuis une activation, et un
// contexte ne au mauvais moment reste suspendu toute la partie — sans lever la
// moindre erreur, et sans que rien n'y paraisse depuis un ordinateur.
preparerSon(document, () => preferences.sons);
surveillerVisibilite(document);

// Le zoom du double-tap arrive au pire moment : deux cartes jouees coup sur
// coup, et le tapis part de travers au milieu de la partie.
interdireDoubleTap(document);
surChangementPlein(rafraichirEcran);

// La geometrie depend de la place disponible : rotation, clavier logiciel,
// fenetre redimensionnee. Le redessin est instantane, sinon les cartes
// glisseraient a chaque pixel gagne.
new ResizeObserver(() => {
    rendu.mesurer();
    if (jeu.etat) rendu.dessiner(jeu.etat, { anime: false });
}).observe(plateau);

async function demarrer() {
    appliquerPreferences();
    rafraichirEcran();
    rendu.mesurer();
    catalogue = await chargerCatalogue();
    rafraichirStats();

    // Une donne demandee dans l'adresse passe avant tout : c'est un lien
    // partage, on ne va pas ouvrir autre chose.
    const parametres = new URLSearchParams(location.search);
    const demandee = Number(parametres.get('donne'));

    // `?defi` est l'adresse d'origine et vaut le defi d'aujourd'hui ; `?jour=`
    // est celle de la convention, et sait en plus rouvrir un defi passe. Une
    // date illisible retombe sur celui du jour : l'intention etait claire.
    const jour = parametres.get('jour');
    if (jour !== null) {
        commencerDefi(/^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : undefined);
        return;
    }
    if (parametres.has('defi')) {
        commencerDefi();
        return;
    }
    if (Number.isInteger(demandee) && demandee > 0) {
        commencer({ graine: demandee });
        return;
    }

    const reprise = lirePartie();
    if (reprise) {
        installer(reprise.etat, {
            graine: reprise.graine,
            defi: reprise.defi,
            jour: reprise.jour ?? reprise.defi,
            ouvert: Boolean(reprise.ouvert),
            secondes: reprise.secondes,
            anime: false
        });
        ihm.annoncer('Partie reprise');
        return;
    }
    commencer({ graine: graineAuHasard(catalogue) });
}

demarrer();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
