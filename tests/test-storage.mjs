// Preferences, statistiques, reprise.
//
// Deux risques ici, et aucun ne fait de bruit. Le premier : les deux modes de
// jeu qui se partagent le meme compteur, et un temps en donne ouverte qui
// vient effacer un record gagne en aveugle. Le second : un navigateur qui
// refuse le stockage — navigation privee, quota plein — et un jeu qui tombe
// alors qu'il pourrait tres bien se jouer sans rien retenir.

import { counter } from './harness.mjs';

// Faux localStorage, avec un interrupteur pour le faire echouer.
const memoire = new Map();
let refuse = false;
globalThis.localStorage = {
    getItem: cle => { if (refuse) throw new Error('refus'); return memoire.get(cle) ?? null; },
    setItem: (cle, valeur) => { if (refuse) throw new Error('refus'); memoire.set(cle, valeur); },
    removeItem: cle => { if (refuse) throw new Error('refus'); memoire.delete(cle); }
};

const S = await import('../js/storage.js');
const { check, report } = counter();
console.log('\nStockage\n');

// Preferences.
check('les preferences ont des valeurs par defaut',
    S.lirePreferences().theme === 'auto' && S.lirePreferences().ouvert === false);
S.ecrirePreferences({ ...S.lirePreferences(), tapis: 'prune', ouvert: true });
check('les preferences se relisent',
    S.lirePreferences().tapis === 'prune' && S.lirePreferences().ouvert === true);
check('une preference inconnue ne perd pas les autres', S.lirePreferences().theme === 'auto');

// Statistiques, mode par mode.
S.enregistrerFin({ gagnee: true, secondes: 300 });
S.enregistrerFin({ gagnee: true, secondes: 240 });
S.enregistrerFin({ gagnee: false, secondes: 90 });

check('les parties se comptent', S.lireStats().jouees === 3 && S.lireStats().gagnees === 2);
check('le meilleur temps retient le plus court', S.lireStats().meilleurTemps === 240);
check('une defaite casse la serie', S.lireStats().serie === 0);
check('la meilleure serie est retenue', S.lireStats().meilleureSerie === 2);

// Le point sensible : le mode ouvert tient ses comptes ailleurs.
S.enregistrerFin({ gagnee: true, secondes: 30, ouvert: true });
check('le mode ouvert compte a part', S.lireStats(true).jouees === 1);
check('le mode classique reste intact', S.lireStats().jouees === 3);
check('un temps de donne ouverte n ecrase pas le record classique',
    S.lireStats().meilleurTemps === 240 && S.lireStats(true).meilleurTemps === 30);

// Defis du jour, egalement separes.
S.enregistrerFin({ gagnee: true, secondes: 200, defi: '2026-08-18' });
check('un defi reussi est retenu', S.defiFait(S.lireStats(), '2026-08-18'));
check('un defi non joue ne l est pas', !S.defiFait(S.lireStats(), '2026-08-19'));
check('le defi d un mode ne vaut pas pour l autre',
    !S.defiFait(S.lireStats(true), '2026-08-18'));

// Le journal des defis ne doit pas gonfler indefiniment.
for (let jour = 1; jour <= 80; jour++) {
    S.enregistrerFin({ gagnee: true, secondes: 100, defi: `2027-01-${String(jour).padStart(3, '0')}` });
}
check('le journal des defis est elague', Object.keys(S.lireStats().defis).length <= 60);
check('les defis les plus recents survivent', S.defiFait(S.lireStats(), '2027-01-080'));

// Partie en cours.
const partie = { graine: 42, ouvert: true, secondes: 12, etat: { colonnes: new Array(7).fill([]) } };
S.sauverPartie(partie);
check('une partie en cours se relit', S.lirePartie()?.graine === 42);
check('le mode de la partie est conserve', S.lirePartie()?.ouvert === true);
S.oublierPartie();
check('une partie oubliee ne revient pas', S.lirePartie() === null);

// Une sauvegarde abimee ne doit pas empecher de jouer.
memoire.set('solitaire.partie', '{ceci n est pas du json');
check('une sauvegarde illisible est ignoree', S.lirePartie() === null);
memoire.set('solitaire.partie', JSON.stringify({ graine: 1, etat: { colonnes: [[], []] } }));
check('une sauvegarde incomplete est ignoree', S.lirePartie() === null);

// Stockage refuse : le jeu doit continuer sans retenir quoi que ce soit.
refuse = true;
check('des preferences illisibles retombent sur les valeurs par defaut',
    S.lirePreferences().theme === 'auto');
check('des stats illisibles repartent de zero', S.lireStats().jouees === 0);
check('une ecriture refusee se signale sans lever', S.ecrirePreferences({ theme: 'clair' }) === false);
check('une partie illisible vaut absence de partie', S.lirePartie() === null);
check('oublier une partie ne leve pas', (() => { S.oublierPartie(); return true; })());
refuse = false;

report();
