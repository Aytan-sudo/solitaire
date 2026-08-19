// L'ecran : le plein ecran, et le zoom qu'il ne faut pas.
//
// Deux ennuis de la meme famille. Le navigateur croit avoir affaire a une page
// qu'on lit, alors qu'il s'agit d'un tapis sur lequel on tape : il garde son
// bandeau, et il zoome des qu'on joue deux cartes coup sur coup.

// Ce qui separe deux appuis pour que le navigateur y voie un double-tap. Le
// sien tourne autour de 300 ms ; on prend un peu large.
const DOUBLE_TAP = 350;

// Ce qui doit rester cliquable, quoi qu'il arrive. Couper le comportement par
// defaut d'un appui supprime le clic qui le suivait : sur le tapis c'est sans
// consequence — les cartes ecoutent le pointeur, jamais le clic — mais un
// bouton du bandeau ou des reglages, lui, cesserait de repondre au second
// appui d'une paire rapide.
const CLIQUABLES = 'button, a, input, select, textarea, label, summary';

// `touch-action: manipulation` devrait suffire, et suffit partout ailleurs.
// Safari sur iPhone laisse passer le double-tap malgre tout : la page zoome au
// milieu d'une partie, les cartes sortent de l'ecran et le geste vise a cote.
// On lui coupe donc le second appui d'une paire rapide.
//
// Le pincement n'est pas touche : il reste un doigt sur l'ecran, et on ne
// prive personne de la loupe.
export function interdireDoubleTap(cible) {
    let dernier = -Infinity;

    cible.addEventListener('touchend', evenement => {
        // L'horodatage de l'evenement, pas l'heure qu'il est : c'est celui sur
        // lequel le navigateur se fonde lui-meme pour reconnaitre la paire.
        const maintenant = evenement.timeStamp;
        const rapproche = maintenant - dernier < DOUBLE_TAP;
        dernier = maintenant;

        if (!rapproche) return;
        if (evenement.touches?.length) return;              // pincement en cours
        if (evenement.target?.closest?.(CLIQUABLES)) return;
        evenement.preventDefault();
    }, { passive: false });
}

// Plein ecran ----------------------------------------------------------
//
// Safari a longtemps prefixe l'API, et l'iPhone ne l'a pas du tout : la, le
// plein ecran passe par l'ecran d'accueil, ou le manifeste ouvre le jeu sans
// bandeau. Le reglage se tait plutot que d'offrir un bouton qui ne ferait rien.

export const pleinDisponible = () =>
    Boolean(document.fullscreenEnabled ?? document.webkitFullscreenEnabled);

export const estPlein = () =>
    Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);

// Le jeu tourne-t-il deja sans bandeau ? Ajoute a l'ecran d'accueil, il n'a
// plus rien a masquer.
export const estInstalle = () =>
    Boolean(navigator.standalone)
    || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(window.matchMedia?.('(display-mode: fullscreen)').matches);

// Rend false si rien n'a eu lieu : soit le navigateur n'a pas l'API, soit il a
// refuse — la demande exige un geste du joueur, et meme la elle peut echouer
// pour une page embarquee ou un reglage du systeme. Un faux succes ferait
// mentir le bouton, qui se mettrait en creux devant un ecran inchange.
export async function basculerPlein() {
    const racine = document.documentElement;
    try {
        if (estPlein()) {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else return false;
        } else {
            if (racine.requestFullscreen) await racine.requestFullscreen({ navigationUI: 'hide' });
            else if (racine.webkitRequestFullscreen) racine.webkitRequestFullscreen();
            else return false;
        }
        return true;
    } catch {
        return false;
    }
}

// Le plein ecran se quitte aussi par la touche d'echappement ou par un geste du
// systeme : l'etat du bouton ne se deduit pas du dernier clic.
export function surChangementPlein(quand) {
    document.addEventListener('fullscreenchange', quand);
    document.addEventListener('webkitfullscreenchange', quand);
}
