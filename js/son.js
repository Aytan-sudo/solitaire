// Synthese WebAudio : pas un octet d'audio dans le depot, sept timbres et
// c'est tout. Le son accompagne le jeu, il ne le commente pas — d'ou des
// durees tres courtes et un volume bas par principe. Une partie de Klondike,
// c'est deux ou trois cents gestes : un son qu'on remarque au dixieme est
// insupportable au centieme.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume : une note ecrite plus bas ne leve aucune erreur, elle part
// simplement sans arriver. Le jeu se voulant mobile d'abord, c'est un defaut et
// pas un reglage — tests/test-son.mjs garde le plancher.

import { valeur } from './cartes.js';

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.07, volume = 0.028, delai = 0, vers = null, forme = 'triangle' } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

// La carte qui se pose : un carton mat sur le tapis. C'est le son de fond de la
// partie, celui qu'on entendra le plus — presque un bruit, jamais une note.
export const sonPose = () => note(370);

// La montee en fondation, et la seule idee de cette gamme : la hauteur suit le
// rang. L'As en bas, le Roi presque une octave au-dessus, les treize rangs
// repartis entre les deux. Ranger une famille se termine donc sur une montee —
// on entend la pile grimper sans avoir a la regarder.
export const AS = 440;
export const sonFondation = carte =>
    note(AS * Math.pow(2, valeur(carte) / 13), { duree: 0.1, volume: 0.03, forme: 'sine' });

// Le retournement. Deux notes collees qui montent : le petit « flip » du
// carton. C'est le seul vrai progres du Klondike — la seule chose qui ne se
// defait pas toute seule — alors c'est le son le plus reconnaissable du jeu.
export function sonRetournement() {
    note(620, { duree: 0.035, volume: 0.022 });
    note(780, { duree: 0.05, volume: 0.022, delai: 0.045 });
}

// La pioche, le plus discret de tous. On fait defiler le talon vingt fois de
// suite : ca doit rester un frottement, pas un metronome.
export const sonPioche = () => note(520, { duree: 0.03, volume: 0.014, forme: 'sine' });

// La redonne : la pioche, mais retombante. Le talon repart pour un tour.
export const sonRedonne = () => note(620, { duree: 0.11, volume: 0.018, vers: 400, forme: 'sine' });

// Le refus. Il ne dit pas non par la profondeur — la, aucun telephone ne
// restituerait rien — mais par la chute : la note part au-dessus de la pose et
// retombe au ras du plancher. C'est le mouvement qui porte le sens, et le
// mouvement, lui, survit au haut-parleur d'un telephone.
export const sonRefus = () => note(420, { duree: 0.09, volume: 0.024, vers: 320, forme: 'sine' });

// La seule fanfare : cinq notes egrenees qui montent, les 52 cartes sont
// rangees.
export function sonVictoire() {
    [392, 523, 659, 784, 1046].forEach((frequence, rang) =>
        note(frequence, { duree: 0.2, volume: 0.03, delai: rang * 0.09 }));
}

// Le deblocage au geste.
//
// iOS ne laisse demarrer un contexte audio que depuis un evenement
// d'activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Solitaire y echappe aujourd'hui — poser une carte comme
// la taper se conclut sur `pointerup` — mais le glisser, lui, se suit dans
// `pointermove`, qui n'en est pas un : il suffirait qu'un son y naisse un jour
// pour que le jeu devienne muet au doigt, sans lever la moindre erreur ni se
// voir depuis un ordinateur. Le contexte se prepare donc des le poser du doigt,
// avant que le jeu n'ait une note a demander.
//
// `autorise` evite d'ouvrir un contexte audio chez qui a coupe le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

// Un jeu ne chante pas dans le dos de qui est parti lire ailleurs.
export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
