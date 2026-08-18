// Le rendu et le geste, eprouves contre un faux document.
//
// C'est la couche ou une faute ne se voit pas : une carte qu'on ne peut pas
// attraper, une cible qui n'accepte rien, une colonne qui sort de l'ecran. Rien
// de tout cela ne leve d'exception. Alors on lui envoie de vrais gestes et on
// regarde ce qu'elle en fait.

import { counter, etatManuel } from './harness.mjs';
import { installerDom, geste } from './dom.mjs';
import { depuisNom, nom } from '../js/cartes.js';
import { jouer as jouerCoup, nouvellePartie, colonneId, fondationId } from '../js/partie.js';
import { COLONNES } from '../js/regles.js';

const { plateau, emplacements, cartes } = installerDom({ largeur: 800, hauteur: 640 });
const { creerRendu } = await import('../js/rendu.js');
const { creerGestes, meilleureDestination } = await import('../js/geste.js');

const { check, report } = counter();
console.log('\nRendu et geste\n');

const rendu = creerRendu({ plateau, emplacements, cartes });
const g = rendu.mesurer();

// Geometrie : tout doit tenir dans le tapis, sinon des cartes sont hors de
// portee du doigt comme du regard.
check('les sept colonnes tiennent dans la largeur',
    g.colonneX(COLONNES - 1) + g.carteL <= plateau.clientWidth + 0.5,
    `${(g.colonneX(6) + g.carteL).toFixed(1)} pour ${plateau.clientWidth}`);
check('la premiere colonne ne deborde pas a gauche', g.colonneX(0) >= 0);
check('les colonnes sont centrees',
    Math.abs(g.colonneX(0) - (plateau.clientWidth - (g.colonneX(6) + g.carteL))) < 0.5);
check('les cartes gardent leurs proportions', Math.abs(g.carteH / g.carteL - 1.4) < 0.01);
check('le tableau commence sous la rangee du haut', g.hautTableau > g.hautRangee + g.carteH);

// Sur un grand ecran, les cartes cessent de grandir et le jeu se centre.
const large = installerDom({ largeur: 1900, hauteur: 1000 });
const renduLarge = creerRendu(large);
const gLarge = renduLarge.mesurer();
check('les cartes ne grandissent pas indefiniment', gLarge.carteL <= 106.5, `${gLarge.carteL.toFixed(0)} px`);
check('le jeu reste centre sur un grand ecran',
    Math.abs(gLarge.colonneX(0) - (1900 - (gLarge.colonneX(6) + gLarge.carteL))) < 0.5);

// Une colonne longue doit rester dans le tapis : c'est la que l'empilement se
// resserre. Treize cartes visibles, le pire cas du Klondike.
const longue = etatManuel({ colonnes: ['RP DC VT 10K 9P 8C 7T 6K 5P 4C 3T 2K AP'] });
const disposition = rendu.dessiner(longue);
const derniere = disposition.positions.get(depuisNom('AP'));
check('une colonne de treize cartes reste dans le tapis',
    derniere.y + g.carteH <= plateau.clientHeight + 0.5,
    `${(derniere.y + g.carteH).toFixed(0)} pour ${plateau.clientHeight}`);
check('une colonne longue reste ordonnee',
    disposition.positions.get(depuisNom('DC')).y > disposition.positions.get(depuisNom('RP')).y);

// Une position ou chaque geste a une consequence connue.
const position = etatManuel({
    colonnes: ['AP', '9T', '10C', '', 'RP DC VP', '4T', 'RT'],
    cachees: [0, 0, 0, 0, 0, 0, 0],
    pioche: '2P 3P'
});

let etat = position;
const joues = [];
const annonces = [];

rendu.dessiner(etat);
creerGestes({
    plateau,
    rendu,
    lire: () => etat,
    jouer: coup => {
        const suivant = jouerCoup(etat, coup);
        joues.push({ coup, accepte: Boolean(suivant) });
        if (suivant) { etat = suivant; rendu.dessiner(etat); }
        return Boolean(suivant);
    },
    annoncer: texte => annonces.push(texte)
});

const doigt = geste(plateau);
const carte = texte => rendu.element(depuisNom(texte));
const dernierCoup = () => joues[joues.length - 1]?.coup;
const remettre = () => { etat = position; joues.length = 0; rendu.dessiner(etat); };

// Le choix de la destination, avant tout geste : fondation d'abord, colonne
// occupee ensuite, colonne vide en dernier.
check('une tape vise la fondation en priorite',
    meilleureDestination(etat, colonneId(0), 0) === fondationId(0));
check('a defaut, une colonne deja peuplee',
    meilleureDestination(etat, colonneId(1), 0) === colonneId(2));
check('une colonne vide ne sert qu au roi',
    meilleureDestination(etat, colonneId(4), 0) === colonneId(3));
check('une carte sans place ne propose rien',
    meilleureDestination(etat, colonneId(5), 0) === null);

// Taper.
doigt.taper(carte('AP'));
check("taper l'as l'envoie a sa fondation",
    dernierCoup()?.vers === fondationId(0) && etat.fondations[0].length === 1);

remettre();
doigt.taper(carte('4T'));
check('taper une carte sans destination ne joue rien', joues.length === 0);
check('la carte refusee est signalee', carte('4T').classes.has('refus'));

doigt.taper(rendu.creux('P'));
check('taper le talon pioche', dernierCoup()?.type === 'piocher' && etat.defausse.length === 1);

// Glisser.
remettre();
const pas = g.carteL + g.ecart;
doigt.glisser(carte('9T'), pas, 0);
check('glisser une carte sur une colonne legale la deplace',
    dernierCoup()?.vers === colonneId(2) && etat.colonnes[2].length === 2);

remettre();
doigt.glisser(carte('9T'), pas * 2, 0);
check('glisser sur une colonne vide sans y avoir droit ne joue rien', joues.length === 0);
check('les cartes reprennent leur place apres un refus',
    rendu.disposition().positions.get(depuisNom('9T')).x === g.colonneX(1));

remettre();
doigt.glisser(carte('RP'), -pas, 0);
check('une suite entiere se glisse d un bloc',
    dernierCoup()?.vers === colonneId(3) && etat.colonnes[3].length === 3);
check('la suite arrive dans le bon ordre',
    etat.colonnes[3].map(nom).join(' ') === 'R♠ D♥ V♠');

// Une dame ne va pas sur une colonne vide, mais elle va sur un roi noir : on
// n'emporte alors que la fin de la suite, et le roi reste seul derriere.
remettre();
doigt.glisser(carte('DC'), pas * 2, 0);
check('on peut n emporter que la fin d une suite',
    dernierCoup()?.vers === colonneId(6) && etat.colonnes[6].length === 3 && etat.colonnes[4].length === 1);
check('le reste de la suite ne bouge pas', etat.colonnes[4].map(nom).join(' ') === 'R♠');

// Un mouvement trop court reste une tape : sans ce seuil, un doigt qui tremble
// annulerait tous les clic-clic.
remettre();
doigt.appuyer(carte('AP'), 0, 0);
doigt.bouger(3, 2);
doigt.relacher(3, 2);
check('un doigt qui tremble tape quand meme', dernierCoup()?.vers === fondationId(0));

// Le plan des cartes. Une carte en mouvement doit passer par-dessus tout le
// reste : son plan d'arrivee ne dit rien du chemin, et sans surelevation elle
// se glisse sous les colonnes qu'elle survole.
const plan = texte => Number(carte(texte).style.zIndex);
const plansAutres = (...exclues) => {
    const exclus = new Set(exclues.map(depuisNom));
    return [...rendu.disposition().positions.keys()]
        .filter(carte => !exclus.has(carte))
        .map(carte => Number(rendu.element(carte).style.zIndex));
};

remettre();
rendu.dessiner(etat, { anime: false });
check('au repos, les plans restent ceux de la disposition',
    Math.max(...plansAutres()) < 52, `${Math.max(...plansAutres())}`);

doigt.appuyer(carte('DC'), 0, 0);
doigt.bouger(pas, 0);
check('la carte tenue passe au-dessus de toutes les autres',
    plan('DC') > Math.max(...plansAutres('DC', 'VP')));
check('la suite tenue garde son ordre', plan('VP') > plan('DC'));
doigt.relacher(pas, 0);
check('la carte reposee redescend', plan('DC') < 52, `${plan('DC')}`);

remettre();
doigt.taper(carte('AP'));
check('la carte qui vole vers sa fondation survole le tableau',
    plan('AP') > Math.max(...plansAutres('AP')));

// Le geste coupe le comportement par defaut du navigateur : sinon un glisser
// a la souris selectionne le tapis, et un appui au doigt guette le double-tap.
remettre();
check('un appui sur une carte ne laisse pas le navigateur faire',
    doigt.appuyer(carte('9T'), 0, 0).defaut === false);
doigt.relacher(0, 0);
check('un appui sur le tapis non plus',
    doigt.appuyer(plateau, 0, 0).defaut === false);
doigt.relacher(0, 0);

// Ce qu'on ne doit pas pouvoir attraper.
remettre();
const donne = nouvellePartie(11);
etat = donne;
rendu.dessiner(etat);
const cachee = rendu.element(donne.colonnes[6][0]);
check('une carte face cachee n est pas prenable', !cachee.classes.has('prenable'));
doigt.glisser(cachee, pas, 0);
check('glisser une carte cachee ne joue rien', joues.length === 0);
check('le talon n est jamais prenable',
    !rendu.element(donne.pioche[donne.pioche.length - 1]).classes.has('prenable'));

// Mise en forme : ce que le joueur lit.
const { formaterDuree, formaterJour } = await import('../js/ui.js');
check('une duree se lit en minutes et secondes', formaterDuree(0) === '0:00' && formaterDuree(125) === '2:05');
check('les secondes gardent leurs deux chiffres', formaterDuree(61) === '1:01');
check('une longue partie ne deborde pas', formaterDuree(3725) === '62:05');
check('un jour se lit en clair', formaterJour('2026-08-18') === '18 août');
check('le jour ne glisse pas d une journee', formaterJour('2026-01-01') === '1 janvier');

report();
