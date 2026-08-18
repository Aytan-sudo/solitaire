// L'interface autour du tapis : compteurs, reglages, fin de partie.
//
// Ce module ne connait pas les regles. Il recoit des valeurs a afficher et
// rend des intentions ; c'est app.js qui decide ce qu'elles declenchent.

import { THEMES, TAPIS } from './themes.js';

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

export function creerInterface({ surTheme, surTapis, surNouvelle, surDefi, surRejouer, surTerminer }) {
    const $ = id => document.getElementById(id);

    const chrono = $('chrono');
    const coups = $('coups');
    const annonce = $('annonce');
    const reglages = $('reglages');
    const victoire = $('victoire');
    const terminer = $('terminer');
    const defi = $('defi');

    // Choix de theme et de tapis, construits depuis les listes : ajouter une
    // couleur ne demande pas de toucher au document.
    const choixTheme = $('choix-theme');
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

    const cocher = (conteneur, valeur) => {
        for (const bouton of conteneur.children) {
            bouton.setAttribute('aria-pressed', String(bouton.dataset.valeur === valeur));
        }
    };

    $('reglages-ouvrir').addEventListener('click', () => reglages.showModal());
    $('nouvelle').addEventListener('click', () => surNouvelle());
    terminer.addEventListener('click', () => surTerminer());
    defi.addEventListener('click', () => { reglages.close(); surDefi(); });
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
            cocher(choixTheme, preferences.theme);
            cocher(choixTapis, preferences.tapis);
        },

        majStats(stats, jourFait) {
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
