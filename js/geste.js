// Le geste : glisser une carte, ou la taper.
//
// Pointer Events plutot que le glisser-deposer natif de HTML : celui-ci ne
// fonctionne pas au doigt, et c'est au doigt que ce jeu se joue.
//
// Les deux gestes partagent tout. Un appui suivi d'un mouvement est un
// glisser ; le meme appui relache sur place est une tape, qui envoie la carte
// a la meilleure destination legale. C'est la meme liste de coups possibles
// qui repond dans les deux cas — le clic-clic n'est pas une seconde
// implementation des regles, seulement une autre facon de choisir la cible.

import { destinationsPour, paquetDeplace, PIOCHE, DEFAUSSE } from './partie.js';

const SEUIL = 6;   // pixels au-dela desquels une tape devient un glisser

// Ou envoyer une carte tapee. Les fondations d'abord — c'est ce que le joueur
// veut neuf fois sur dix — puis une colonne deja peuplee, et seulement en
// dernier une colonne vide, qu'on ne gaspille pas sans raison.
export function meilleureDestination(etat, de, index) {
    const cibles = destinationsPour(etat, de, index);
    return cibles.find(id => id[0] === 'F')
        ?? cibles.find(id => id[0] === 'C' && etat.colonnes[Number(id.slice(1))].length > 0)
        ?? cibles.find(id => id[0] === 'C')
        ?? null;
}

// Recouvrement de deux rectangles. Le glisser vise avec la carte, pas avec le
// curseur : on depose la ou la carte se trouve, ce qui pardonne un doigt qui
// masque justement l'endroit qu'il vise.
function recouvrement(a, b) {
    const l = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return l > 0 && h > 0 ? l * h : 0;
}

export function creerGestes({ plateau, rendu, lire, jouer, annoncer }) {
    let saisie = null;

    // La capture garde le pointeur meme si le doigt sort du tapis : sans elle,
    // un relachement au-dessus du bandeau ne revient jamais au plateau, et la
    // saisie en cours ne se termine pas — plus un geste ne passe ensuite. Elle
    // echoue sur un evenement synthetique, ou il n'y a pas de pointeur a
    // capturer : ce n'est pas une raison pour renoncer au geste.
    const capturer = pointerId => {
        try { plateau.setPointerCapture(pointerId); } catch { /* sans capture */ }
    };

    const fin = () => {
        if (!saisie) return;
        for (const element of saisie.elements) element.classList.remove('saisie');
        if (saisie.glisse) rendu.reposer();
        rendu.surbrillance(new Set());
        saisie = null;
    };

    plateau.addEventListener('pointerdown', evenement => {
        if (saisie || evenement.button > 0) return;

        // Le tapis n'est pas un texte : sans cela, un glisser a la souris tire
        // une selection en travers du plateau et surligne le coin des cartes,
        // et un appui au doigt reste un candidat au zoom du double-tap.
        evenement.preventDefault();

        const etat = lire();

        const creux = evenement.target.closest('.emplacement');
        if (creux?.dataset.role === 'pioche') {
            saisie = { talon: true, pointerId: evenement.pointerId, elements: [] };
            capturer(evenement.pointerId);
            return;
        }

        const element = evenement.target.closest('.carte');
        if (!element) return;

        const de = element.dataset.pile;
        const index = Number(element.dataset.index);
        if (de === PIOCHE) {
            saisie = { talon: true, pointerId: evenement.pointerId, elements: [] };
            capturer(evenement.pointerId);
            return;
        }
        if (!element.classList.contains('prenable')) return;

        const cartes = paquetDeplace(etat, de, index);
        if (!cartes) return;

        const positions = rendu.disposition().positions;
        saisie = {
            pointerId: evenement.pointerId,
            de,
            index,
            cartes,
            elements: cartes.map(carte => rendu.element(carte)),
            departs: cartes.map(carte => ({ ...positions.get(carte) })),
            x: evenement.clientX,
            y: evenement.clientY,
            glisse: false,
            legales: null
        };
        capturer(evenement.pointerId);
    });

    plateau.addEventListener('pointermove', evenement => {
        if (!saisie || saisie.talon || evenement.pointerId !== saisie.pointerId) return;

        const dx = evenement.clientX - saisie.x;
        const dy = evenement.clientY - saisie.y;

        if (!saisie.glisse) {
            if (Math.hypot(dx, dy) < SEUIL) return;
            saisie.glisse = true;
            saisie.legales = new Set(destinationsPour(lire(), saisie.de, saisie.index));
            rendu.surbrillance(saisie.legales);
            rendu.saisir(saisie.cartes);
            for (const element of saisie.elements) element.classList.add('saisie');
        }

        saisie.elements.forEach((element, rang) => {
            element.style.setProperty('--x', `${saisie.departs[rang].x + dx}px`);
            element.style.setProperty('--y', `${saisie.departs[rang].y + dy}px`);
        });
    });

    plateau.addEventListener('pointerup', evenement => {
        if (!saisie || evenement.pointerId !== saisie.pointerId) return;
        const etat = lire();

        if (saisie.talon) {
            const type = etat.pioche.length ? 'piocher' : 'redonner';
            fin();
            if (!jouer({ type })) annoncer('Le talon est vide.');
            return;
        }

        const { de, index, cartes, glisse, legales } = saisie;

        // Tape : le jeu choisit la destination.
        if (!glisse) {
            fin();
            const vers = meilleureDestination(etat, de, index);
            if (vers) jouer({ type: 'deplacer', de, index, vers });
            else rendu.refuser(cartes[0]);
            return;
        }

        // Glisser : la carte choisit, par recouvrement.
        const { l, h } = { l: rendu.geometrie().carteL, h: rendu.geometrie().carteH };
        const style = saisie.elements[0].style;
        const posee = {
            x: parseFloat(style.getPropertyValue('--x')),
            y: parseFloat(style.getPropertyValue('--y')),
            l, h
        };

        let vers = null;
        let meilleur = 0;
        for (const zone of rendu.disposition().zones) {
            if (!legales.has(zone.id)) continue;
            const aire = recouvrement(posee, zone);
            if (aire > meilleur) { meilleur = aire; vers = zone.id; }
        }

        fin();
        // Sans cible, les cartes reprennent leur place : le prochain dessin
        // s'en charge, et la transition fait le voyage de retour.
        if (vers) jouer({ type: 'deplacer', de, index, vers });
        else rendu.dessiner(etat);
    });

    plateau.addEventListener('pointercancel', () => {
        const etat = lire();
        const glissait = saisie && !saisie.talon && saisie.glisse;
        fin();
        if (glissait) rendu.dessiner(etat);
    });

    // Un glisser hors de la fenetre ne doit pas laisser une carte accrochee au
    // curseur.
    window.addEventListener('blur', () => {
        if (!saisie) return;
        const etat = lire();
        const glissait = !saisie.talon && saisie.glisse;
        fin();
        if (glissait) rendu.dessiner(etat);
    });
}
