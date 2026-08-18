// Un DOM juste assez grand pour rendu.js et geste.js.
//
// Ces deux modules sont les seuls a toucher au document, et ce sont ceux ou
// les fautes coutent le plus cher : une carte qu'on ne peut pas attraper ne
// leve aucune exception, elle ne bouge simplement pas. Les faire tourner en
// Node contre ce faux document permet de leur envoyer de vrais gestes —
// appuyer, glisser, relacher — et de verifier ce qu'ils en font.
//
// On n'imite ici que ce qui est reellement utilise : pas de mise en page, pas
// de cascade, pas de selecteurs au-dela de la classe.

class Element {
    constructor(tag) {
        this.tag = tag;
        this.classes = new Set();
        this.dataset = {};
        this.children = [];
        this.parent = null;
        this.attributs = {};
        this.innerHTML = '';
        this.offsetWidth = 0;
        this.offsetHeight = 0;
        this.ecouteurs = new Map();

        const variables = new Map();
        this.style = {
            setProperty: (nom, valeur) => variables.set(nom, valeur),
            getPropertyValue: nom => variables.get(nom) ?? '',
            removeProperty: nom => variables.delete(nom)
        };
    }

    get className() { return [...this.classes].join(' '); }
    set className(valeur) { this.classes = new Set(String(valeur).split(/\s+/).filter(Boolean)); }

    get classList() {
        const classes = this.classes;
        return {
            add: (...noms) => noms.forEach(nom => classes.add(nom)),
            remove: (...noms) => noms.forEach(nom => classes.delete(nom)),
            contains: nom => classes.has(nom),
            toggle: (nom, force) => {
                const actif = force === undefined ? !classes.has(nom) : force;
                if (actif) classes.add(nom); else classes.delete(nom);
                return actif;
            }
        };
    }

    append(...enfants) {
        for (const enfant of enfants) {
            enfant.parent = this;
            this.children.push(enfant);
        }
    }

    setAttribute(nom, valeur) { this.attributs[nom] = String(valeur); }
    getAttribute(nom) { return this.attributs[nom] ?? null; }

    // Un seul type de selecteur : la classe, seule forme que le code emploie.
    closest(selecteur) {
        const classes = selecteur.split(',').map(part => part.trim().replace(/^\./, ''));
        let noeud = this;
        while (noeud) {
            if (classes.some(classe => noeud.classes?.has(classe))) return noeud;
            noeud = noeud.parent;
        }
        return null;
    }

    addEventListener(type, fonction) {
        if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []);
        this.ecouteurs.get(type).push(fonction);
    }

    // Declenche un evenement comme le ferait le navigateur.
    envoyer(type, evenement) {
        for (const fonction of this.ecouteurs.get(type) ?? []) fonction(evenement);
    }

    setPointerCapture() { /* rien a capturer hors navigateur */ }
    releasePointerCapture() { }
}

export function installerDom({ largeur = 800, hauteur = 640 } = {}) {
    const plateau = new Element('main');
    plateau.classes.add('plateau');
    plateau.clientWidth = largeur;
    plateau.clientHeight = hauteur;

    const emplacements = new Element('div');
    const cartes = new Element('div');
    plateau.append(emplacements, cartes);

    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.requestAnimationFrame = fonction => fonction();
    globalThis.window = { addEventListener: () => {} };

    return { plateau, emplacements, cartes };
}

// Gestes, ecrits comme on les decrirait : appuyer ici, glisser la, relacher.
export function geste(plateau) {
    let pointeur = 0;
    return {
        appuyer(cible, x = 0, y = 0) {
            pointeur++;
            plateau.envoyer('pointerdown', { target: cible, clientX: x, clientY: y, pointerId: pointeur, button: 0 });
            return { x, y };
        },
        bouger(x, y) {
            plateau.envoyer('pointermove', { target: plateau, clientX: x, clientY: y, pointerId: pointeur, button: 0 });
        },
        relacher(x = 0, y = 0) {
            plateau.envoyer('pointerup', { target: plateau, clientX: x, clientY: y, pointerId: pointeur, button: 0 });
        },
        // Un appui relache sur place : le clic-clic.
        taper(cible) {
            this.appuyer(cible, 0, 0);
            this.relacher(0, 0);
        },
        // Un appui, un mouvement franc, un relachement : le glisser.
        glisser(cible, dx, dy) {
            this.appuyer(cible, 0, 0);
            this.bouger(dx / 2, dy / 2);
            this.bouger(dx, dy);
            this.relacher(dx, dy);
        }
    };
}
