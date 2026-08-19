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
const style = lire('css/style.css');
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
// Le numero de version vit a trois endroits, et les trois doivent s'accorder.
// Celui du cache surtout : un cache qui garde son nom garde son contenu, donc
// une version publiee sans renommer le cache ne parvient jamais aux joueurs
// qui ont installe le jeu — ils continuent de jouer l'ancienne, sans le savoir.
const version = JSON.parse(lire('package.json')).version;
check('le numero de version est un numero', /^\d+\.\d+\.\d+$/.test(version), version);
check('la page affiche la version de package.json',
    lire('js/ui.js').includes(`export const VERSION = '${version}'`), version);
check('le cache du service worker porte la version',
    worker.includes(`const VERSION = 'solitaire-${version}'`), version);

// Chaque fichier annonce dans la coquille doit exister.
const manquants = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('tous les fichiers de la coquille existent', manquants.length === 0, manquants.join(' '));

// Chaque identifiant cherche par le code doit exister dans la page : une
// faute de frappe ici ne fait rien planter, elle rend un bouton inerte.
const cherches = new Set();
for (const nom of ['ui.js', 'app.js']) {
    const source = lire(`js/${nom}`);
    for (const [, id] of source.matchAll(/getElementById\('([\w-]+)'\)/g)) cherches.add(id);
    for (const [, id] of source.matchAll(/\$\('([\w-]+)'\)/g)) cherches.add(id);
}
const inconnus = [...cherches].filter(id => !page.includes(`id="${id}"`));
check(`les ${cherches.size} identifiants cherches existent dans la page`,
    inconnus.length === 0, inconnus.join(' '));

// Ce que la feuille de style doit au geste. Rien de tout cela ne se voit dans
// le faux document des tests, ou il n'y a ni empilement ni pointeur : ce sont
// pourtant des pannes de jeu, pas des details d'habillage.
//
// Les deux calques couvrent le tapis entier. Si celui des cartes recoit les
// appuis, il avale ceux qui visaient un creux vide — et le talon vide, qui est
// le bouton de la redonne, cesse de repondre des le premier tour de pioche.
check('le calque des cartes laisse passer les appuis',
    /\.emplacements, \.cartes \{[^}]*pointer-events: none/.test(style));
check('les cartes et les creux, eux, les recoivent',
    /\.emplacement, \.carte \{[^}]*pointer-events: auto/s.test(style));

// Le plan d'une carte est pose en ligne par rendu.js : une regle de feuille de
// style ne peut pas le surpasser, et celle qui essaierait mentirait.
check('la feuille de style ne pretend pas gerer les plans', !/z-index/.test(style));

// Jouer, ce n'est ni lire ni zoomer. La regle vaut pour tout le document et
// pas seulement pour sa racine : touch-action ne s'herite pas, et Safari ne
// remonte pas toujours jusqu'a body pour decider du sort d'un appui.
check('le double-tap ne zoome pas', /\* \{ touch-action: manipulation; \}/.test(style));
check('le tapis ne se selectionne pas',
    /\.plateau \{[^}]*[^-]user-select: none/s.test(style));

// Le dernier recours contre le zoom d'iPhone, ou la regle de style ne suffit
// pas : sans cet appel, le double-tap revient et la partie part de travers.
check('la page coupe elle-meme le double-tap',
    lire('js/app.js').includes('interdireDoubleTap(document)'));

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
