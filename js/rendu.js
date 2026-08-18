// Rendu : ou se trouve chaque carte, et comment elle y va.
//
// Les 52 cartes et les 13 emplacements sont crees une seule fois, puis
// deplaces par transform. Rien n'est jamais ajoute ni retire du document en
// cours de partie : une carte qui change de pile glisse, elle ne disparait pas
// d'un endroit pour reapparaitre a un autre. C'est ce qui donne l'animation
// gratuitement, et ce qui evite au navigateur de refaire sa mise en page a
// chaque coup.
//
// La geometrie est calculee ici, en pixels, et posee en variables CSS. Le
// tableau du Klondike n'a pas de hauteur bornee — une colonne peut recevoir
// treize cartes — alors chaque colonne resserre son empilement quand elle
// deborde, plutot que de laisser des cartes sortir de l'ecran.

import { RANGS, SYMBOLES, famille, valeur, rouge, nom, TAILLE_PAQUET } from './cartes.js';
import { COLONNES, FONDATIONS, debutSuite } from './regles.js';
import { PIOCHE, DEFAUSSE, colonneId, fondationId } from './partie.js';

const RATIO = 1.4;              // hauteur d'une carte pour une largeur
const ECART = 0.14;             // entre deux colonnes, en largeurs de carte
const OFF_CACHEE = 0.13;        // decalage d'une carte face cachee, en hauteurs
const OFF_VISIBLE = 0.26;
const RANGEE_MIN = 2.4;         // hauteurs de carte reservees au tableau
const CARTE_MAX = 106;          // px : au-dela, un jeu de cartes fait affiche

// Plans de superposition. Au repos, chaque carte porte le rang qu'elle occupe
// dans la disposition — cinquante-deux valeurs, de zero a cinquante et un. Une
// carte qui bouge doit passer par-dessus tout le reste : son plan d'arrivee ne
// dit rien du chemin, et une carte qui traverse le tableau pour rejoindre une
// fondation se glisserait sous les colonnes qu'elle survole. On la sureleve
// donc d'un palier, le temps du voyage, et de deux tant qu'un doigt la tient.
const EN_VOL = 100;
const AU_DOIGT = 200;
const VOL_MS = 400;             // un peu plus que --duree, transition comprise

export function creerRendu({ plateau, emplacements, cartes }) {
    const elements = new Map();
    let g = null;               // geometrie courante

    // Emplacements : les creux du tapis. Ils ne bougent qu'au redimensionnement.
    const creux = new Map();
    const ajouterCreux = (id, role, famille) => {
        const element = document.createElement('div');
        element.className = 'emplacement';
        element.dataset.pile = id;
        element.dataset.role = role;
        if (famille !== undefined) {
            element.dataset.famille = famille;
            element.dataset.symbole = SYMBOLES[famille];
        }
        emplacements.append(element);
        creux.set(id, element);
    };

    ajouterCreux(PIOCHE, 'pioche');
    ajouterCreux(DEFAUSSE, 'defausse');
    for (let i = 0; i < FONDATIONS; i++) ajouterCreux(fondationId(i), 'fondation', i);
    for (let i = 0; i < COLONNES; i++) ajouterCreux(colonneId(i), 'colonne');

    // Cartes : creees une fois pour toutes, avec leurs deux faces.
    for (let carte = 0; carte < TAILLE_PAQUET; carte++) {
        const element = document.createElement('div');
        element.className = `carte${rouge(carte) ? ' rouge' : ''}`;
        element.dataset.carte = carte;
        element.innerHTML =
            `<div class="pivot">` +
            `<div class="face"><span class="coin">${RANGS[valeur(carte)]}<small>${SYMBOLES[famille(carte)]}</small></span>` +
            `<span class="centre">${SYMBOLES[famille(carte)]}</span></div>` +
            `<div class="dos"></div></div>`;
        cartes.append(element);
        elements.set(carte, element);
    }

    function mesurer() {
        const largeur = plateau.clientWidth;
        const hauteur = plateau.clientHeight;

        // Sept colonnes, six intervalles, deux marges : la largeur decide...
        // jusqu'a un plafond. Sur un grand ecran, des cartes de quinze
        // centimetres ne rendent le jeu ni plus lisible ni plus agreable.
        let carteL = Math.min(largeur / (COLONNES + ECART * (COLONNES + 1)), CARTE_MAX);
        let carteH = carteL * RATIO;

        // ... sauf si la hauteur ne suit pas, en paysage notamment.
        const besoin = carteH * (1 + RANGEE_MIN) + carteL * ECART * 3;
        if (besoin > hauteur) {
            carteL *= hauteur / besoin;
            carteH = carteL * RATIO;
        }

        const ecart = carteL * ECART;
        const bord = (largeur - (COLONNES * carteL + (COLONNES - 1) * ecart)) / 2;
        const hautRangee = ecart;
        const hautTableau = hautRangee + carteH + ecart * 2;

        g = {
            carteL, carteH, ecart, bord, hautTableau,
            colonneX: i => bord + i * (carteL + ecart),
            hauteurTableau: hauteur - hautTableau,
            hautRangee
        };

        plateau.style.setProperty('--carte-l', `${carteL}px`);
        plateau.style.setProperty('--carte-h', `${carteH}px`);
        plateau.style.setProperty('--rayon', `${Math.max(4, carteL * 0.09)}px`);

        for (const [id, element] of creux) placer(element, ancre(id));
        return g;
    }

    // Coin haut-gauche d'une pile. Le talon et la defausse occupent les deux
    // premieres colonnes, les fondations les quatre dernieres : la troisieme
    // reste vide, c'est elle qui separe la reserve du jeu.
    function ancre(id) {
        if (id === PIOCHE) return { x: g.colonneX(0), y: g.hautRangee };
        if (id === DEFAUSSE) return { x: g.colonneX(1), y: g.hautRangee };
        if (id[0] === 'F') return { x: g.colonneX(3 + Number(id.slice(1))), y: g.hautRangee };
        return { x: g.colonneX(Number(id.slice(1))), y: g.hautTableau };
    }

    // Decalages d'une colonne. Une colonne qui deborde se resserre : mieux
    // vaut un empilement serre que des cartes hors de l'ecran.
    function decalages(longueur, cachees) {
        const cache = g.carteH * OFF_CACHEE;
        const visible = g.carteH * OFF_VISIBLE;
        const visibles = Math.max(0, longueur - cachees - 1);
        const etendue = cachees * cache + visibles * visible;
        const place = g.hauteurTableau - g.carteH - g.ecart;
        const k = etendue > place && etendue > 0 ? place / etendue : 1;
        return { cache: cache * k, visible: visible * k };
    }

    const placer = (element, { x, y }) => {
        element.style.setProperty('--x', `${x}px`);
        element.style.setProperty('--y', `${y}px`);
    };

    // Position de chaque carte, pile par pile. Rendue aussi a l'appelant : le
    // glisser en a besoin pour savoir d'ou une carte est partie.
    function disposer(etat) {
        const positions = new Map();
        const zones = [];
        let plan = 0;

        const empiler = (id, cartesPile, decalage = () => 0) => {
            const debut = ancre(id);
            let bas = debut.y;
            cartesPile.forEach((carte, index) => {
                const y = debut.y + decalage(index);
                positions.set(carte, { x: debut.x, y, plan: plan++, pile: id, index });
                bas = y;
            });
            zones.push({ id, x: debut.x, y: debut.y, l: g.carteL, h: bas - debut.y + g.carteH });
        };

        empiler(PIOCHE, etat.pioche);
        empiler(DEFAUSSE, etat.defausse);
        etat.fondations.forEach((pile, i) => empiler(fondationId(i), pile));

        etat.colonnes.forEach((colonne, i) => {
            const { cache, visible } = decalages(colonne.length, etat.cachees[i]);
            empiler(colonneId(i), colonne, index =>
                Math.min(index, etat.cachees[i]) * cache + Math.max(0, index - etat.cachees[i]) * visible);
        });

        return { positions, zones };
    }

    let derniere = null;
    let atterrissage = null;    // minuteur qui redescend les cartes arrivees

    // Fin du voyage : chacun retrouve son plan, pour que le coup suivant reparte
    // d'un tapis a plat.
    function reposer() {
        clearTimeout(atterrissage);
        if (!derniere) return;
        for (const [carte, element] of elements) {
            const position = derniere.positions.get(carte);
            if (position) element.style.zIndex = position.plan;
        }
    }

    // Les cartes que le joueur tient : au-dessus de toutes les autres, et dans
    // leur ordre a elles, pour qu'une suite transportee reste lisible.
    function saisir(cartes) {
        reposer();
        cartes.forEach((carte, rang) => { elements.get(carte).style.zIndex = AU_DOIGT + rang; });
    }

    function dessiner(etat, { anime = true } = {}) {
        const avant = derniere?.positions ?? null;
        const { positions, zones } = disposer(etat);
        derniere = { positions, zones };

        // Cartes qu'on peut saisir : le sommet du talon retourne, celui d'une
        // fondation, et tout ce qui forme une suite en regle dans une colonne.
        const prenables = new Set();
        if (etat.defausse.length) prenables.add(etat.defausse[etat.defausse.length - 1]);
        for (const pile of etat.fondations) if (pile.length) prenables.add(pile[pile.length - 1]);
        etat.colonnes.forEach((colonne, i) => {
            for (let index = debutSuite(colonne, etat.cachees[i]); index >= 0 && index < colonne.length; index++) {
                prenables.add(colonne[index]);
            }
        });

        let envol = false;

        for (const [carte, element] of elements) {
            const position = positions.get(carte);
            if (!position) continue;

            const depart = avant?.get(carte);
            const vole = anime && Boolean(depart) && (depart.x !== position.x || depart.y !== position.y);
            envol ||= vole;

            const cachee = position.pile === PIOCHE
                || (position.pile[0] === 'C' && position.index < etat.cachees[Number(position.pile.slice(1))]);

            element.classList.toggle('posee', !anime);
            element.classList.toggle('cachee', cachee);
            element.classList.toggle('prenable', !cachee && prenables.has(carte));
            element.style.zIndex = position.plan + (vole ? EN_VOL : 0);
            element.dataset.pile = position.pile;
            element.dataset.index = position.index;
            element.setAttribute('aria-label', cachee ? 'carte face cachée' : nom(carte));
            placer(element, position);
        }

        creux.get(PIOCHE).classList.toggle('vide', etat.pioche.length === 0);

        clearTimeout(atterrissage);
        if (envol) {
            atterrissage = setTimeout(reposer, VOL_MS);
            atterrissage?.unref?.();       // en test, un minuteur ne retient pas Node
        }
        return derniere;
    }

    // La donne : toutes les cartes partent du talon et s'envolent vers leur
    // place. Deux images suffisent — poser sans transition, puis dessiner.
    function distribuer(etat) {
        const depart = ancre(PIOCHE);
        for (const element of elements.values()) {
            element.classList.add('posee', 'cachee');
            placer(element, depart);
        }
        void plateau.offsetHeight;                 // force le navigateur a prendre acte
        requestAnimationFrame(() => dessiner(etat));
    }

    const surbrillance = ids => {
        for (const [id, element] of creux) element.classList.toggle('cible', ids.has(id));
    };

    const refuser = carte => {
        const element = elements.get(carte);
        element.classList.remove('refus');
        void element.offsetWidth;
        element.classList.add('refus');
    };

    return {
        mesurer, dessiner, distribuer, surbrillance, refuser, disposer, saisir, reposer,
        element: carte => elements.get(carte),
        disposition: () => derniere,
        creux: id => creux.get(id),
        geometrie: () => g
    };
}
