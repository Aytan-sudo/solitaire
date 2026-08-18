// Verifications structurelles de la page. Les erreurs attrapees ici ne
// provoquent aucune exception : elles laissent un bouton muet, une ressource
// absente du cache hors ligne, ou — le pire pour ce projet — le solveur
// embarque dans le navigateur alors qu'il n'a rien a y faire.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nPage\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

const page = lire('index.html');
const worker = lire('sw.js');
const manifeste = JSON.parse(lire('manifest.webmanifest'));

// Ce que la page charge vraiment : on suit les imports depuis app.js, plutot
// que de se fier a une liste tenue a la main.
function moduleCharges(depart) {
    const vus = new Set();
    const aVoir = [depart];
    while (aVoir.length) {
        const nom = aVoir.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) {
            aVoir.push(cible);
        }
    }
    return vus;
}

const charges = moduleCharges('app.js');
const tous = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));

// L'invariant du projet : la garantie des donnes est payee hors ligne, une
// fois. Si le solveur revenait dans le graphe des imports, la page grossirait
// et se mettrait a chercher pendant que le joueur attend.
check('le solveur ne part pas dans le navigateur', !charges.has('solveur.js'),
    [...charges].join(' '));
check('la page charge bien le moteur et le rendu',
    ['partie.js', 'regles.js', 'cartes.js', 'rendu.js', 'geste.js', 'donne.js'].every(nom => charges.has(nom)));
check('aucun module charge n est orphelin', [...charges].every(nom => tous.includes(nom)));

// La coquille : ce que le service worker met en cache. On lit la liste, pas le
// fichier — un commentaire qui cite un chemin n'est pas une mise en cache.
const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);

// Cache hors ligne : un module absent de la coquille ne manque qu'aux joueurs
// hors reseau, c'est-a-dire a ceux qui comptaient dessus.
const absents = [...charges].filter(nom => !coquille.includes(`js/${nom}`));
check('le service worker connait tous les modules charges', absents.length === 0, absents.join(' '));
check('le service worker ignore le solveur', !coquille.includes('js/solveur.js'));
check('le service worker met en cache la feuille de style', coquille.includes('css/style.css'));
check('le service worker met en cache le catalogue', coquille.includes('data/donnes.json'));
check('le service worker porte un numero de version', /const VERSION = 'solitaire-v\d+'/.test(worker));

// Chaque fichier annonce dans la coquille doit exister.
const manquants = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('tous les fichiers de la coquille existent', manquants.length === 0, manquants.join(' '));

// Chaque identifiant cherche par le code doit exister dans la page : une
// faute de frappe ici ne fait rien planter, elle rend un bouton inerte.
const cherches = new Set();
for (const nom of ['ui.js', 'app.js']) {
    for (const [, id] of lire(`js/${nom}`).matchAll(/getElementById\('([\w-]+)'\)/g)) cherches.add(id);
}
const inconnus = [...cherches].filter(id => !page.includes(`id="${id}"`));
check(`les ${cherches.size} identifiants cherches existent dans la page`,
    inconnus.length === 0, inconnus.join(' '));

// Manifeste et icones.
check('la page declare le manifeste', page.includes('rel="manifest"'));
check('la page declare la feuille de style', page.includes('css/style.css'));
check('la page charge app.js en module', page.includes('type="module"') && page.includes('js/app.js'));
check('la page fixe la langue', page.includes('lang="fr"'));
check('la page tient compte des encoches', page.includes('viewport-fit=cover'));
check('toutes les icones du manifeste existent',
    manifeste.icons.every(icone => existsSync(join(racine, icone.src))),
    manifeste.icons.map(i => i.src).join(' '));
check('le manifeste demarre a la racine relative',
    manifeste.start_url === './' && manifeste.scope === './');

report();
