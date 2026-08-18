// Themes et tapis.
//
// Le joueur choisit une couleur de tapis ; le bandeau, le fond et les creux
// s'en deduisent. Le theme, lui, ne fait qu'assombrir l'ensemble et adoucir le
// blanc des cartes — un jeu de cartes reste un jeu de cartes, il n'a pas de
// version nocturne.

export const THEMES = [
    { id: 'auto', libelle: 'Système' },
    { id: 'clair', libelle: 'Clair' },
    { id: 'sombre', libelle: 'Sombre' }
];

export const TAPIS = [
    { id: 'vert', libelle: 'Vert', couleur: '#1d6b4a' },
    { id: 'bleu', libelle: 'Bleu', couleur: '#2b5580' },
    { id: 'prune', libelle: 'Prune', couleur: '#63304f' },
    { id: 'ardoise', libelle: 'Ardoise', couleur: '#41474f' },
    { id: 'brique', libelle: 'Brique', couleur: '#8a3a2c' }
];

export const tapisDe = id => TAPIS.find(tapis => tapis.id === id) ?? TAPIS[0];

export function appliquer({ theme, tapis }) {
    const racine = document.documentElement;

    // 'auto' ne pose rien : c'est l'absence d'attribut qui laisse la main a
    // prefers-color-scheme.
    if (theme === 'auto') racine.removeAttribute('data-theme');
    else racine.setAttribute('data-theme', theme);

    racine.style.setProperty('--tapis-choisi', tapisDe(tapis).couleur);

    // La barre d'adresse du telephone se met a la couleur du bandeau.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = tapisDe(tapis).couleur;
}
