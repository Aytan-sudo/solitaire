// L'interface autour du tapis : compteurs, reglages, fin de partie.
//
// Ce module ne connait pas les regles. Il recoit des valeurs a afficher et
// rend des intentions ; c'est app.js qui decide ce qu'elles declenchent.

import { THEMES, TAPIS } from './themes.js';

// Le numero que le joueur lit au bas des reglages. Il vit a trois endroits qui
// doivent s'accorder — ici, dans package.json et dans le nom du cache du
// service worker — et un test s'en assure : une version publiee sous un cache
// deja nomme ne parviendrait jamais aux joueurs qui ont installe le jeu.
export const VERSION = '1.2.1';

export const MODES = [
    {
        id: 'classique',
        libelle: 'Classique',
        aide: 'Les cartes se retournent au fur et à mesure, comme au Klondike de toujours.'
    },
    {
        id: 'ouvert',
        libelle: 'Ouvert',
        aide: 'Toutes les cartes visibles dès le début : la donne devient un puzzle, '
            + 'et une partie perdue l’est par une faute plutôt que par malchance. '
            + 'Les statistiques sont comptées à part.'
    }
];

export function formaterDuree(secondes) {
    const minutes = Math.floor(secondes / 60);
    return `${minutes}:${String(secondes % 60).padStart(2, '0')}`;
}

// '2026-08-18' se lit mal dans une annonce. On le rend en clair, sans passer
// par un Date qui reinterpreterait le fuseau au passage.
export function formaterJour(jour) {
    const [annee, mois, numero] = jour.split('-').map(Number);
    return new Date(annee, mois - 1, numero)
        .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

const pourcent = (part, total) => (total === 0 ? '—' : `${Math.round(part / total * 100)} %`);

export function creerInterface({ surMode, surTheme, surTapis, surSensation, surPlein, surNouvelle, surDefi, surRejouer, surTerminer, surPartager }) {
    const $ = id => document.getElementById(id);

    const chrono = $('chrono');
    const coups = $('coups');
    const annonce = $('annonce');
    const reglages = $('reglages');
    const victoire = $('victoire');
    const terminer = $('terminer');
    const defi = $('defi');
    const ecran = $('ecran');
    const aideEcran = $('aide-ecran');
    const sonBouton = $('son-basculer');
    const optionSons = $('option-sons');
    const optionVibration = $('option-vibration');

    // Choix de theme et de tapis, construits depuis les listes : ajouter une
    // couleur ne demande pas de toucher au document.
    const choixMode = $('choix-mode');
    const aideMode = $('aide-mode');
    const choixTheme = $('choix-theme');

    for (const mode of MODES) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = mode.libelle;
        bouton.dataset.valeur = mode.id;
        bouton.addEventListener('click', () => surMode(mode.id === 'ouvert'));
        choixMode.append(bouton);
    }

    const choixTapis = $('choix-tapis');

    for (const theme of THEMES) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = theme.libelle;
        bouton.dataset.valeur = theme.id;
        bouton.addEventListener('click', () => surTheme(theme.id));
        choixTheme.append(bouton);
    }

    for (const tapis of TAPIS) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.dataset.valeur = tapis.id;
        bouton.style.setProperty('--pastille', tapis.couleur);
        bouton.setAttribute('aria-label', tapis.libelle);
        bouton.addEventListener('click', () => surTapis(tapis.id));
        choixTapis.append(bouton);
    }

    // Les sensations. Le bouton de la barre et la case des reglages disent la
    // meme chose : couper le son ne doit pas demander d'ouvrir un panneau au
    // milieu d'une partie, mais il faut bien pouvoir le retrouver ou tout le
    // reste se regle.
    sonBouton.addEventListener('click', () => surSensation('sons', sonBouton.getAttribute('aria-pressed') === 'false'));
    optionSons.addEventListener('change', () => surSensation('sons', optionSons.checked));
    optionVibration.addEventListener('change', () => surSensation('vibration', optionVibration.checked));

    // Le plein ecran n'est pas un choix parmi d'autres mais une bascule : un
    // seul bouton, qui se met en creux quand il est actif.
    const boutonPlein = document.createElement('button');
    boutonPlein.type = 'button';
    boutonPlein.textContent = 'Plein écran';
    boutonPlein.addEventListener('click', () => surPlein());
    $('choix-ecran').append(boutonPlein);

    const cocher = (conteneur, valeur) => {
        for (const bouton of conteneur.children) {
            bouton.setAttribute('aria-pressed', String(bouton.dataset.valeur === valeur));
        }
    };

    $('version').textContent = `Solitaire ${VERSION}`;

    $('reglages-ouvrir').addEventListener('click', () => reglages.showModal());
    $('nouvelle').addEventListener('click', () => surNouvelle());
    terminer.addEventListener('click', () => surTerminer());
    defi.addEventListener('click', () => { reglages.close(); surDefi(); });

    // Partager ne ferme pas la feuille : sur telephone, le systeme pose sa
    // propre feuille par-dessus, et la refermer doit ramener la ou on etait.
    $('partager').addEventListener('click', () => surPartager());
    $('victoire-partager').addEventListener('click', () => surPartager());
    victoire.addEventListener('close', () => {
        if (victoire.returnValue === 'rejouer') surRejouer();
        else if (victoire.returnValue === 'nouvelle') surNouvelle();
    });

    let minuterieAnnonce = null;

    return {
        majCompteurs(secondes, nombreCoups) {
            chrono.textContent = formaterDuree(secondes);
            coups.textContent = String(nombreCoups);
        },

        majPreferences(preferences) {
            const mode = preferences.ouvert ? 'ouvert' : 'classique';
            cocher(choixMode, mode);
            cocher(choixTheme, preferences.theme);
            cocher(choixTapis, preferences.tapis);
            aideMode.textContent = MODES.find(entree => entree.id === mode).aide;

            optionSons.checked = preferences.sons;
            optionVibration.checked = preferences.vibration;
            // Le glyphe ne change pas : c'est la feuille de style qui le
            // barre. Une note barree en Unicode se compose d'un signe
            // combinant, que la moitie des telephones dessine de travers.
            sonBouton.setAttribute('aria-pressed', String(preferences.sons));
        },

        // Trois situations, trois discours. Le navigateur sait le faire ; il ne
        // sait pas le faire, et le joueur peut s'en passer par l'ecran
        // d'accueil ; ou le jeu y est deja, et le reglage n'a plus lieu d'etre.
        majEcran({ disponible, actif, installe }) {
            ecran.hidden = installe;
            boutonPlein.hidden = !disponible;
            boutonPlein.setAttribute('aria-pressed', String(actif));
            aideEcran.textContent = disponible
                ? 'Masque le bandeau du navigateur : le jeu prend tout l’écran.'
                : 'Ce navigateur n’a pas le plein écran. Sur iPhone, il passe par '
                    + 'l’écran d’accueil : Partager, puis « Sur l’écran d’accueil ».';
        },

        majStats(stats, jourFait, ouvert = false) {
            $('stats-titre').textContent = ouvert ? 'Parties — mode ouvert' : 'Parties — mode classique';
            const liste = [
                ['Parties jouées', stats.jouees],
                ['Gagnées', `${stats.gagnees} (${pourcent(stats.gagnees, stats.jouees)})`],
                ['Série en cours', stats.serie],
                ['Meilleure série', stats.meilleureSerie],
                ['Meilleur temps', stats.meilleurTemps === null ? '—' : formaterDuree(stats.meilleurTemps)]
            ];
            document.getElementById('stats').innerHTML = liste
                .map(([nom, valeur]) => `<dt>${nom}</dt><dd>${valeur}</dd>`)
                .join('');

            defi.textContent = jourFait ? 'Défi du jour ✓' : 'Défi du jour';
        },

        // Le bouton n'apparait que lorsqu'il ne reste plus rien a decider :
        // toutes les cartes retournees, le talon vide.
        majTerminer(possible) {
            terminer.hidden = !possible;
        },

        montrerVictoire({ secondes, nombreCoups, defi: jour, record }) {
            document.getElementById('victoire-titre').textContent = jour ? 'Défi du jour réussi' : 'Gagné';
            document.getElementById('victoire-detail').textContent =
                `${formaterDuree(secondes)} et ${nombreCoups} coups.` + (record ? ' Nouveau record.' : '');
            document.getElementById('victoire-rejouer').hidden = Boolean(jour);
            victoire.showModal();
        },

        annoncer(texte) {
            annonce.textContent = texte;
            annonce.classList.add('visible');
            clearTimeout(minuterieAnnonce);
            minuterieAnnonce = setTimeout(() => annonce.classList.remove('visible'), 2200);
        },

        fermerFeuilles() {
            if (reglages.open) reglages.close();
            if (victoire.open) victoire.close();
        }
    };
}
