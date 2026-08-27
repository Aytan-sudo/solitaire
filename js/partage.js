// Le partage : une donne se resume a une adresse, un resultat a trois lignes.
//
// Le lien ne porte jamais le resultat, seulement de quoi refabriquer la donne
// — un jour pour le defi, un numero pour une partie libre. Celui qui l'ouvre
// commence a zero, avec les memes cartes.

// '2026-08-27' se lit mal ; on le rend a l'endroit ou on le lit, sans passer
// par un Date qui reinterpreterait le fuseau au passage.
const enChiffres = jour => jour.split('-').reverse().join('/');

const formaterDuree = secondes =>
    `${Math.floor(secondes / 60)}:${String(Math.floor(secondes) % 60).padStart(2, '0')}`;

// L'adresse de la donne, batie sur celle d'ou l'on joue : le jeu est servi
// depuis GitHub Pages, mais aussi depuis un localhost pendant qu'on le
// developpe, et le lien doit rester celui du lieu.
export function lienDeLaDonne(base, { jour = null, graine }) {
    const url = new URL(base);
    url.search = '';
    if (jour) url.searchParams.set('jour', jour);
    else url.searchParams.set('donne', String(graine));
    return url.href;
}

// Les quatre familles rangees : le seul embleme honnete d'une partie de
// Klondike gagnee. Il ne code rien de plus que la victoire — un solitaire ne
// se resume pas a une grille de couleurs comme un Sutom.
const FONDATIONS = '♠️♥️♦️♣️';

export function messageDePartage({ base, jour = null, graine, ouvert = false, gagnee, secondes, coups }) {
    const lignes = [jour ? `Solitaire — défi du ${enChiffres(jour)}` : `Solitaire — donne n° ${graine}`];

    if (gagnee) {
        lignes.push(`Gagné en ${formaterDuree(secondes)} · ${coups} coups${ouvert ? ' · donne ouverte' : ''}`);
        lignes.push(FONDATIONS);
    } else {
        lignes.push('Une donne garantie gagnable. Saurez-vous la ranger ?');
    }

    lignes.push(lienDeLaDonne(base, { jour, graine }));
    return lignes.join('\n');
}
