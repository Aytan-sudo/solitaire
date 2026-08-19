// L'ecran : le double-tap qu'on refuse, le plein ecran qu'on propose.
//
// Deux mecanismes qui ne se voient pas depuis le jeu. Un double-tap laisse
// passer zoome la page au milieu d'une partie ; un bouton de plein ecran offert
// a un navigateur qui n'en a pas ne fait rien du tout. Ni l'un ni l'autre ne
// leve d'exception — d'ou ces verifications contre un faux document.

import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nEcran\n');

// Un document juste assez grand : de quoi ecouter, et de quoi mentir sur ce
// que le navigateur sait faire.
function installerDocument({ plein = 'standard', deja = false, autonome = false } = {}) {
    const ecouteurs = new Map();
    const appels = [];
    const racine = {};

    const document = {
        documentElement: racine,
        addEventListener(type, fonction) {
            if (!ecouteurs.has(type)) ecouteurs.set(type, []);
            ecouteurs.get(type).push(fonction);
        },
        envoyer(type, evenement) {
            for (const fonction of ecouteurs.get(type) ?? []) fonction(evenement);
            return evenement;
        }
    };

    if (plein === 'standard') {
        document.fullscreenEnabled = true;
        document.fullscreenElement = deja ? racine : null;
        document.exitFullscreen = () => { appels.push('sortir'); return Promise.resolve(); };
        racine.requestFullscreen = () => { appels.push('entrer'); return Promise.resolve(); };
    } else if (plein === 'webkit') {
        document.webkitFullscreenEnabled = true;
        document.webkitFullscreenElement = deja ? racine : null;
        document.webkitExitFullscreen = () => { appels.push('sortir'); };
        racine.webkitRequestFullscreen = () => { appels.push('entrer'); };
    } else {
        // L'iPhone : l'API existe, et elle repond non.
        document.webkitFullscreenEnabled = false;
    }

    globalThis.document = document;
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    // Node fournit deja un navigator, en lecture seule : on le remplace.
    Object.defineProperty(globalThis, 'navigator', { value: { standalone: autonome }, configurable: true });
    return { document, appels, ecouteurs };
}

const { interdireDoubleTap, pleinDisponible, estPlein, estInstalle, basculerPlein, surChangementPlein } =
    await import('../js/ecran.js');

// Le double-tap ---------------------------------------------------------

// Une carte, un bouton : ce qui les separe est le seul critere qui compte, car
// couper l'appui coupe le clic qui l'aurait suivi.
const carte = { closest: () => null };
const bouton = { closest: selecteur => (selecteur.includes('button') ? {} : null) };

function appui(document, { a, sur = carte, doigts = 0 }) {
    return document.envoyer('touchend', {
        timeStamp: a,
        target: sur,
        touches: { length: doigts },
        defaut: true,
        preventDefault() { this.defaut = false; }
    });
}

{
    const { document } = installerDocument();
    interdireDoubleTap(document);

    check('un appui isole passe', appui(document, { a: 1000 }).defaut === true);
    check('le second appui d’une paire rapide est coupe',
        appui(document, { a: 1120 }).defaut === false);
    check('un troisieme appui aussi rapide est coupe',
        appui(document, { a: 1240 }).defaut === false);
    check('un appui pose plus tard repasse',
        appui(document, { a: 2000 }).defaut === true);
}

{
    const { document } = installerDocument();
    interdireDoubleTap(document);

    appui(document, { a: 0 });
    check('un bouton reste cliquable au second appui d’une paire',
        appui(document, { a: 100, sur: bouton }).defaut === true);
}

{
    const { document } = installerDocument();
    interdireDoubleTap(document);

    appui(document, { a: 0 });
    check('un doigt encore pose est un pincement, pas un double-tap',
        appui(document, { a: 100, doigts: 1 }).defaut === true);
}

// Le plein ecran --------------------------------------------------------

{
    const { document, appels } = installerDocument({ plein: 'standard' });
    check('le plein ecran est propose quand le navigateur le sait',
        pleinDisponible() === true && estPlein() === false);
    check('la bascule le demande a la racine',
        (await basculerPlein()) === true && appels.join() === 'entrer');

    document.fullscreenElement = document.documentElement;
    check('une fois dedans, la meme bascule en sort',
        (await basculerPlein()) === true && appels.join() === 'entrer,sortir');
}

{
    const { appels } = installerDocument({ plein: 'webkit' });
    check('l’API prefixee de Safari fait l’affaire',
        pleinDisponible() === true && (await basculerPlein()) === true && appels.join() === 'entrer');
}

{
    installerDocument({ plein: 'aucun' });
    check('l’iPhone n’en a pas, et le jeu ne le pretend pas', pleinDisponible() === false);
    check('rien a proposer, rien a promettre', (await basculerPlein()) === false);
}

{
    installerDocument({ plein: 'aucun', autonome: true });
    check('le jeu ajoute a l’ecran d’accueil se sait deja sans bandeau', estInstalle() === true);
}

{
    const { ecouteurs } = installerDocument({ plein: 'standard' });
    surChangementPlein(() => {});
    check('la sortie par la touche d’echappement est ecoutee, prefixe compris',
        ecouteurs.has('fullscreenchange') && ecouteurs.has('webkitfullscreenchange'));
}

report();
