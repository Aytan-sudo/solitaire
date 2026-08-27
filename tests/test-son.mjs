// Le son — tout ce qui se verifie sans oreille.
//
// Le piege que cette suite existe pour attraper ne leve aucune erreur et ne se
// voit pas depuis un ordinateur : une note ecrite sous 300 Hz part bien, elle
// n'arrive simplement jamais. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume. Compter les notes emises ne dit donc rien de ce qui parvient a
// l'oreille : c'est leur hauteur qu'il faut relever.
//
// Un contexte audio factice fait tourner le vrai module et note ce qui en sort,
// rampes comprises (modele Mosaicomino). Le releve a la source reste en second
// rideau, pour attraper un timbre qu'on aurait ajoute sans l'appeler ici.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';
import { carteDe, AS as AS_CARTE, ROI } from '../js/cartes.js';

const { check, report } = counter();
console.log('\nSon\n');

// Un haut-parleur de telephone ne descend pas plus bas. C'est la cible du
// projet : sous ce seuil, la note n'existe pas.
const PLANCHER = 300;

// Le banc d'essai : juste assez d'API WebAudio pour que js/son.js tourne, et un
// carnet ou chaque oscillateur laisse ses hauteurs et son enveloppe.
function bancDEssai() {
    const emises = [];
    class Parametre {
        constructor(carnet) { this.carnet = carnet; }
        setValueAtTime(valeur) { this.carnet.push(valeur); return this; }
        exponentialRampToValueAtTime(valeur) { this.carnet.push(valeur); return this; }
    }
    class Contexte {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        // note() cree toujours l'oscillateur puis son gain : le dernier ouvert
        // est donc bien celui que ce gain habille.
        createOscillator() {
            const note = { forme: null, hauteurs: [], gains: [], debut: null, fin: null };
            emises.push(note);
            return {
                set type(valeur) { note.forme = valeur; },
                get type() { return note.forme; },
                frequency: new Parametre(note.hauteurs),
                connect: cible => cible,
                start: temps => { note.debut = temps; },
                stop: temps => { note.fin = temps; }
            };
        }
        createGain() {
            return { gain: new Parametre(emises.at(-1).gains), connect: cible => cible };
        }
        resume() { this.state = 'running'; }
        suspend() { this.state = 'suspended'; }
    }
    globalThis.AudioContext = Contexte;
    return emises;
}

const emises = bancDEssai();
const son = await import('../js/son.js');

const jouer = timbre => {
    const debut = emises.length;
    timbre();
    return emises.slice(debut);
};

const pose = jouer(son.sonPose);
const retournement = jouer(son.sonRetournement);
const pioche = jouer(son.sonPioche);
const redonne = jouer(son.sonRedonne);
const refus = jouer(son.sonRefus);
const victoire = jouer(son.sonVictoire);
// Les treize rangs, pique : la gamme entiere passe au banc, pas seulement ses
// deux bouts.
const fondations = [...Array(13).keys()].map(rang => jouer(() => son.sonFondation(carteDe(0, rang)))[0]);

check('les sept timbres sonnent',
    [pose, retournement, pioche, redonne, refus, victoire].every(timbre => timbre.length > 0)
    && fondations.length === 13);

// Le coeur de la suite : plus rien, pas meme une cible de rampe, ne descend
// sous le plancher.
const sous = emises.flatMap(note => note.hauteurs).filter(hauteur => hauteur < PLANCHER);
check('aucune note ne passe sous le plancher du haut-parleur',
    sous.length === 0, sous.map(hauteur => `${Math.round(hauteur)} Hz`).join(' '));

// La gamme des fondations : la hauteur suit le rang. C'est la seule idee de ce
// jeu de timbres — ranger une famille se termine sur une montee, qu'on entend
// sans avoir a regarder la pile.
const gamme = fondations.map(note => note.hauteurs[0]);
check('la fondation monte avec le rang de la carte',
    gamme.every((hauteur, rang) => rang === 0 || hauteur > gamme[rang - 1]),
    gamme.map(Math.round).join(' '));
check('l as est la plus grave de la gamme', gamme[AS_CARTE] === Math.min(...gamme));
check('le roi est la plus aigue', gamme[ROI] === Math.max(...gamme));
check('la gamme couvre presque une octave',
    gamme[ROI] / gamme[AS_CARTE] > 1.8 && gamme[ROI] / gamme[AS_CARTE] < 2,
    String(gamme[ROI] / gamme[AS_CARTE]));
check('la fondation se distingue de la pose', gamme[AS_CARTE] > pose[0].hauteurs[0]);

// Le refus ne dit pas non par la profondeur — qu'aucun telephone ne
// restituerait — mais par la chute. C'est cette intention que le test garde.
check('le refus descend au lieu de s enfoncer',
    refus.length === 1 && refus[0].hauteurs.length === 2
    && refus[0].hauteurs[0] > refus[0].hauteurs[1]
    && refus[0].hauteurs[1] >= PLANCHER,
    refus[0]?.hauteurs.join(' → '));
check('le refus part au-dessus de la pose et ne s y confond pas',
    refus[0].hauteurs[0] > pose[0].hauteurs[0]);
check('la redonne retombe, elle aussi',
    redonne[0].hauteurs.length === 2 && redonne[0].hauteurs[0] > redonne[0].hauteurs[1]);

// Le retournement : deux notes collees qui montent, le petit « flip » du
// carton. Le seul vrai progres du Klondike, donc le son a reconnaitre.
const montee = retournement.map(note => note.hauteurs[0]);
check('le retournement monte en deux notes',
    retournement.length === 2 && montee[1] > montee[0], montee.join(' → '));
check('les deux notes se suivent de pres',
    retournement[1].debut - retournement[0].debut < 0.1);

// La pioche se repete a l'envi : vingt appuis d'affilee sur le talon ne doivent
// pas faire vingt coups de marteau.
const volume = note => Math.max(...note.gains);
const duree = note => note.fin - note.debut;
check('la pioche reste plus discrete que la pose', volume(pioche[0]) < volume(pose[0]));
check('la pioche reste plus breve que la pose', duree(pioche[0]) < duree(pose[0]));
check('la pioche est le plus discret de tous les timbres',
    [pose, retournement, redonne, refus, victoire, [fondations[0]]]
        .every(timbre => timbre.every(note => volume(note) >= volume(pioche[0]))));

// La fanfare monte : c'est ce qui la fait entendre comme une fin heureuse.
const finale = victoire.map(note => note.hauteurs[0]);
check('la victoire monte de bout en bout',
    finale.every((hauteur, rang) => rang === 0 || hauteur > finale[rang - 1]), finale.join(' '));
check('la victoire s egrene au lieu de plaquer un accord',
    victoire.every((note, rang) => rang === 0 || note.debut > victoire[rang - 1].debut));

// Second rideau : un timbre ajoute demain sans passer par cette suite serait
// invisible au banc d'essai. On relit donc aussi le module au lexique.
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(racine, 'js', 'son.js'), 'utf8');
const ecrites = [
    ...[...source.matchAll(/note\((\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/vers:\s*(\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/^export const AS = (\d+);$/gm)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/^\s*\[([\d,\s]+)\]\.forEach/gm)]
        .flatMap(([, liste]) => liste.split(',').map(Number))
];
const basses = ecrites.filter(hauteur => hauteur < PLANCHER);
check('aucune frequence ecrite dans le module ne passe sous le plancher',
    basses.length === 0, basses.join(' '));
check('les frequences ecrites ont bien ete relevees', ecrites.length >= 11, String(ecrites.length));

// Le second piege du son sur telephone : iOS ne demarre un contexte audio que
// depuis un evenement d'activation. Le glisser se suit dans `pointermove`, qui
// n'en est pas un — d'ou le filet pose des le poser du doigt.
const cablage = readFileSync(join(racine, 'js', 'app.js'), 'utf8');
check('le contexte se prepare des le premier geste',
    source.includes("'pointerdown'") && cablage.includes('preparerSon(document'));
check('le son se tait quand l onglet passe a l arriere-plan',
    cablage.includes('surveillerVisibilite(document)'));

// Couper le son doit couper le son, et rien d'autre : un jeu muet reste un jeu
// qui vibre si on le lui a demande.
check('les deux sensations se reglent separement',
    cablage.includes('if (preferences.sons)') && cablage.includes('if (preferences.vibration)'));

report();
