# Solitaire

Un Klondike statique, jouable hors ligne, ou **chaque donne a une solution**.

Pioche par 1, redonnes illimitees. Pas de serveur, pas de compilation : des
fichiers, un dossier, GitHub Pages.

## Version 1.2

- **le son.** Sept timbres de synthese, pas un octet d'audio dans le depot : la
  pose, le retournement, la pioche, la redonne, le refus, la victoire — et la
  montee en fondation, dont la hauteur suit le rang de la carte. Ranger une
  famille se termine donc sur une montee de presque une octave, qu'on entend sans
  regarder la pile. Tout vit au-dessus de 300 Hz : sous ce seuil, un
  haut-parleur de telephone ne restitue a peu pres rien, et la note part sans
  arriver. `tests/test-son.mjs` joue les timbres contre un contexte audio
  factice et garde le plancher ;
- vibration breve en option, et un bouton dans le bandeau pour couper le son
  sans ouvrir les reglages ;
- **partage** d'un resultat en trois lignes et d'un lien qui refabrique la
  donne — jamais le resultat, jamais la solution ;
- le defi du jour s'ouvre par `?jour=AAAA-MM-JJ`, ce qui permet de rouvrir celui
  d'hier. `?defi` reste compris. Un defi rejoue apres coup redonne bien sa
  grille, mais hors serie : seule la partie jouee le jour meme compte ;
- **le theme se pose avant le premier pixel.** Il vivait dans `app.js`, module
  differe : la page s'affichait une fraction de seconde en vert clair avant de
  virer au tapis choisi. Un script en tete de page le lit desormais avant le
  premier rendu ;
- **le service worker passe au reseau d'abord.** Le cache d'abord laissait le
  joueur sur l'ancienne version tant qu'il ne vidait pas son navigateur, et en
  local — tous les jeux servant sur la meme origine — il finissait par servir
  ses propres fichiers a un autre jeu. Le cache ne passe plus devant que lorsque
  le reseau ne repond pas ;
- `user-scalable=no`, l'icone iOS entre dans la coquille hors ligne, et
  `.github/workflows/tests.yml` lance `npm test` et `npm run check` a chaque
  poussee ;
- la pastille du tapis choisi garde sa couleur au lieu de virer au vert
  d'accent. En theme clair l'accent est justement ce vert, ce qui cachait bien
  l'affaire.

## Version 1.1

- le plein ecran se demande depuis les reglages, utile sur tablette ;
- le double-tap ne zoome plus, iPhone compris : `js/ecran.js` coupe le second
  appui d'une paire rapprochee, boutons exclus nommement.

## Version 1.0

- le Klondike statique et ses donnes garanties gagnables ;
- le mode ouvert, toutes cartes visibles ;
- quatre pannes du geste reparees — le talon vide qui ne repondait plus, la
  carte glissee qui passait sous les colonnes, la selection tiree en travers du
  tapis, le pointeur non capture ;
- le numero de version au bas des reglages.

## Ce que la garantie promet, et ce qu'elle ne promet pas

Toutes les donnes proposees ont ete resolues avant d'etre livrees. Aucune
partie n'est perdue d'avance.

Elle ne promet pas que vous ne pouvez pas vous bloquer. Le solveur voit les
cartes retournees, vous non : il existe des coups qui condamnent une donne
pourtant gagnable. La garantie dit *une solution existe*, pas *tous les
chemins menent a la victoire*. C'est une promesse plus faible que celle d'un
demineur sans coup de des, et il vaut mieux le dire.

Elle vaut pour les regles annoncees. Une donne gagnable en pioche par 1 ne
l'est pas forcement en pioche par 3 : un autre mode demanderait son propre
catalogue.

## Le mode ouvert

Un reglage distribue les memes donnes, mais toutes faces visibles. Le Klondike
cesse alors d'etre un jeu de chance pour devenir un puzzle : une partie perdue
l'est par une faute, plus par une carte qu'on ne pouvait pas connaitre.

Le tableau s'ouvre entierement, le talon reste un talon — et c'est complet
ainsi. En pioche par 1 avec redonnes illimitees, le talon n'est pas de
l'information cachee : on peut le faire defiler autant qu'on veut avant de
decider. C'est de l'information qui coute quelques clics, pas un secret. Les
seules cartes reellement inconnues sont les faces cachees du tableau, et le
mode ouvert les decouvre toutes.

Le catalogue vaut tel quel, sans nouvelle moisson : le solveur resout
precisement cette version-la, puisqu'il voit les cartes retournees. Mieux, le
mode ouvert est strictement plus permissif — une suite enfouie devient
deplacable des lors qu'elle n'est plus cachee — donc une donne garantie en
classique l'est a plus forte raison en ouvert.

Les deux modes tiennent leurs statistiques chacun de leur cote. Un temps gagne
en donne ouverte n'a rien a voir avec un temps gagne en aveugle, et n'a rien a
faire dans le meme palmares.

Le mode se fige a la donne. Le changer avant le premier coup redistribue la
meme donne dans l'autre mode ; en cours de partie, il attend la suivante — on
ne peut pas recacher des cartes qui ont deja bouge.

## Comment la donne est garantie

Le solveur ne tourne jamais dans le navigateur. Prouver qu'une donne est
*perdue* coute cher — il faut epuiser l'arbre — alors qu'en trouver la
solution est rapide. On exploite l'asymetrie : `scripts/catalogue.mjs` fait
tourner des milliers de graines hors ligne et ne garde que celles qu'il
resout. Le jeu n'a plus qu'a piocher dans la liste.

    npm run catalogue        # ~5 000 donnes, quelques minutes

Deux simplifications rendent le solveur viable, toutes deux liees aux regles
retenues :

- **Le talon est un ensemble.** En pioche par 1 avec redonnes illimitees, on
  peut toujours faire defiler le talon jusqu'a la carte voulue. N'importe
  quelle carte du talon est donc jouable a tout instant : son ordre disparait
  de la recherche.
- **Les montees sures ne se discutent pas.** Une carte de rang r ne peut
  servir dans le tableau qu'aux deux cartes de rang r-1 de couleur opposee ;
  si ces deux familles sont deja montees jusqu'a r-1, la monter ne coute
  jamais rien. Ces coups sont joues d'office.

La recherche est une exploration en profondeur avec table de transpositions et
budget de noeuds. Le budget n'est pas un pis-aller : une donne qui resiste est
ecartee, et il y a une infinite de graines. Mieux vaut cent donnes trouvees
vite qu'une seule prouvee a grands frais.

Huit relances courtes avec un ordre de coups bouscule valent nettement mieux
qu'une seule longue recherche : a temps egal, **87 donnes resolues sur 120
contre 71**. Une exploration en profondeur qui s'engage dans une mauvaise
branche y reste jusqu'a epuiser son budget ; deux departs differents tombent
rarement dans le meme piege.

Le solveur ignore le remonte-fondation, que le jeu autorise. Il est donc
prudent : il peut echouer sur une donne gagnable, jamais reussir sur une
perdue. Pour un catalogue, c'est le bon sens de l'erreur.

## Le geste

Pointer Events, pas le glisser-deposer natif de HTML : celui-ci ne fonctionne
pas au doigt, et c'est au doigt que ce jeu se joue.

Glisser et taper partagent tout. Un appui suivi d'un mouvement est un glisser ;
le meme appui relache sur place est une tape, qui envoie la carte a la
meilleure destination legale — fondation d'abord, colonne occupee ensuite,
colonne vide en dernier. Les deux interrogent la meme liste de coups
possibles : le clic-clic n'est pas une seconde implementation des regles.

Le glisser vise avec la carte, pas avec le curseur : la cible retenue est celle
que la carte recouvre le plus. Un doigt masque justement l'endroit qu'il vise.

## L'ecran

Le navigateur croit avoir affaire a une page qu'on lit, alors qu'il s'agit d'un
tapis sur lequel on tape. Il zoome au double-tap, et il garde son bandeau.

**Le double-tap ne doit pas zoomer.** Il arrive tout seul des qu'on joue deux
cartes coup sur coup, et la partie part de travers : les cartes sortent de
l'ecran, le geste vise a cote. Trois parades empilees, parce qu'aucune ne
couvre tout le monde : `user-scalable=no` dans la balise de viewport, que la
plupart des navigateurs respectent ; `touch-action: manipulation`, qui regle la
question partout ailleurs ; et, pour iPhone, ou Safari ignore la balise et zoome
quand meme, `js/ecran.js` coupe le second appui d'une paire rapprochee.

Ce que cela coute : couper un appui supprime le clic qui l'aurait suivi. Sur le
tapis c'est sans consequence — les cartes ecoutent le pointeur, jamais le clic
— mais un bouton, lui, cesserait de repondre. Les boutons sont donc exclus,
nommement. Cela coute aussi la loupe : `user-scalable=no` retire le pincement
la ou il est respecte. C'est l'arbitrage retenu pour toute la collection — un
tapis n'est pas une page qu'on lit, et un zoom accidentel en cours de partie
coute plus cher qu'un agrandissement dont on se passe. Sur iPhone, ou la balise
est ignoree, le pincement reste possible : la parade JavaScript ne s'occupe que
du double-tap, et laisse passer tout geste ou un doigt reste sur l'ecran.

**Le plein ecran** se demande depuis les reglages, et ne se retient pas d'une
partie a l'autre : le rouvrir exige un geste du joueur, et un jeu qui s'y
jetterait au premier appui au retour serait plus surprenant qu'utile. Le bouton
suit l'etat reel, pas le dernier clic — on en sort aussi par la touche
d'echappement ou par un geste du systeme.

L'iPhone n'a pas cette API du tout. Plutot qu'un bouton qui ne ferait rien, le
reglage dit ou est le vrai plein ecran : l'ecran d'accueil, ou le manifeste
ouvre le jeu sans bandeau. Et lorsque le jeu y est deja, la section disparait —
il n'y a plus rien a masquer.

## Le son

Synthese WebAudio, pas un octet d'audio dans le depot. Sept timbres tres courts
et un volume bas par principe : une partie de Klondike, c'est deux ou trois
cents gestes, et un son qu'on remarque au dixieme est insupportable au centieme.
La pioche est le plus discret de tous — on fait defiler le talon vingt fois de
suite, cela doit rester un frottement et pas un metronome.

La seule idee de cette gamme est la fondation : **sa hauteur suit le rang de la
carte**, l'As en bas et le Roi presque une octave au-dessus. Ranger une famille
se termine donc sur une montee, et le deroule final fait entendre les piles
grimper sans qu'on ait a les regarder.

Deux pieges, tous deux invisibles depuis un ordinateur — ils ne levent aucune
erreur, le son part simplement sans arriver :

- **le plancher de 300 Hz.** Un haut-parleur de telephone ne restitue a peu pres
  rien en dessous, et l'oreille y est de surcroit bien moins sensible a faible
  volume. Le jeu se voulant mobile d'abord, c'est un defaut et pas un reglage :
  `tests/test-son.mjs` fait tourner le vrai module contre un contexte audio
  factice et releve toutes les hauteurs emises, cibles de rampes comprises. Le
  refus ne dit donc pas non par la profondeur mais par la chute — c'est le
  mouvement qui porte le sens, et le mouvement survit au haut-parleur ;
- **le deblocage au geste.** iOS ne laisse demarrer un contexte audio que depuis
  un evenement d'activation. Poser une carte comme la taper se conclut sur
  `pointerup`, qui en est un ; mais le glisser se suit dans `pointermove`, qui
  n'en est pas un, et il suffirait qu'un son y naisse un jour pour que le jeu
  devienne muet au doigt. Le contexte se prepare donc des le premier poser de
  doigt, avant que le jeu n'ait une note a demander.

Le son se coupe depuis le bandeau, sans ouvrir les reglages, et se tait tout
seul quand l'onglet passe a l'arriere-plan. La vibration est un reglage a part :
un jeu muet reste un jeu qui vibre, si on le lui a demande. Elle se tait pendant
le deroule final — entendre cinquante montees grimper est agreable, les sentir
toutes vibrer ne l'est pas.

## Le rendu

Les 52 cartes et les 13 emplacements sont crees une fois, puis deplaces par
`transform`. Rien n'est ajoute ni retire du document en cours de partie : une
carte qui change de pile glisse, elle ne disparait pas pour reapparaitre
ailleurs. L'animation vient de la, et le navigateur n'a jamais a refaire sa
mise en page.

Aucune image : les cartes sont dessinees en CSS. Cinquante-deux fichiers a
charger, a mettre en cache et a redessiner pour le theme sombre, contre
quelques regles de style.

La geometrie est calculee en JavaScript et posee en variables CSS. Le tableau
du Klondike n'a pas de hauteur bornee, alors chaque colonne resserre son
empilement quand elle deborde, plutot que de laisser des cartes sortir de
l'ecran.

Les plans de superposition sont poses en ligne, eux aussi, et par la meme
occasion : au repos, chaque carte porte son rang dans la disposition. Une carte
qui bouge est surelevee d'un palier le temps du voyage, et de deux tant qu'un
doigt la tient — sans quoi son plan d'arrivee, qui ne dit rien du chemin, la
ferait passer sous les colonnes qu'elle survole.

## Les fichiers

    js/hasard.js     graine -> melange reproductible, empreinte d'une date
    js/cartes.js     une carte est un entier de 0 a 51
    js/regles.js     ce qui se pose sur quoi
    js/partie.js     etat, coups, retournement, victoire — sans DOM
    js/donne.js      choix de la donne : catalogue, defi du jour
    js/rendu.js      geometrie et position de chaque carte
    js/geste.js      glisser et taper
    js/ecran.js      plein ecran, et le zoom du double-tap qu'on refuse
    js/son.js        sept timbres de synthese, aucun fichier audio
    js/partage.js    le lien d'une donne, le message d'un resultat
    js/ui.js         compteurs, reglages, fin de partie
    js/storage.js    preferences, statistiques, reprise
    js/themes.js     theme et couleur du tapis
    js/app.js        le cablage
    js/solveur.js    hors ligne uniquement : jamais charge par la page
    scripts/         moissonneuse du catalogue
    data/donnes.json les graines garanties
    tests/           le noyau se teste en Node, sans navigateur

Le moteur est immuable : `jouer(etat, coup)` ne modifie rien, il rend un
nouvel etat. Un etat pese une soixantaine d'entiers, alors annuler revient a
garder la copie precedente — pas de coup a inverser, donc pas de coup qu'on
inverserait mal.

Les piles portent un identifiant court, qui se relit dans un test comme dans
une URL : `P` pioche, `D` defausse, `C0..C6` colonnes, `F0..F3` fondations.

## Adresses

    ?donne=1234        ouvre une donne precise, pour partager une partie
    ?jour=2026-08-27   ouvre le defi de ce jour-la
    ?defi              ouvre le defi d'aujourd'hui (l'adresse d'origine)

Une donne demandee par son numero n'est pas forcement au catalogue : le jeu la
distribue quand meme, en annoncant qu'elle n'est pas garantie.

Un defi rouvert plus tard redonne bien sa grille — c'est tout l'interet d'un
lien qu'on partage — mais hors serie : seule la partie jouee le jour meme compte
au palmares du defi.

Le bouton **Partager** copie trois lignes et un lien :

    Solitaire — défi du 27/08/2026
    Gagné en 4:12 · 137 coups
    ♠️♥️♦️♣️
    https://aytan-sudo.github.io/solitaire/?jour=2026-08-27

Le lien porte de quoi refabriquer la donne, et rien d'autre : ni le temps, ni
les coups, ni la solution. Celui qui l'ouvre commence a zero, avec les memes
cartes. Un test le verifie, parce que c'est le genre de promesse qu'on casse
sans s'en apercevoir.

## Developpement

    npm test         304 verifications
    npm run check    node --check sur chaque module
    npm run serve    http://localhost:8769
    npm run catalogue  regenere data/donnes.json

Un port par jeu, et pas le meme pour tous : servis sur une origine commune, les
jeux partageraient leur `localStorage`, la portee de leur service worker et
leurs caches — de quoi voir un jeu servir ses propres fichiers a un autre.

Le noyau ne touche pas au DOM et se teste en Node. Le rendu et le geste, eux,
tournent contre un faux document minimal (`tests/dom.mjs`) qui recoit de vrais
gestes — appuyer, glisser, relacher. C'est la couche ou une faute ne leve
aucune exception : une carte qu'on ne peut pas attraper ne fait rien, elle ne
bouge simplement pas.

Le numero de version vit a trois endroits — `package.json`, `js/ui.js` (ou le
joueur le lit, au bas des reglages) et le nom du cache dans `sw.js`. Un test
les compare : un cache qui garde son nom garde son contenu, donc une version
publiee sans renommer le cache ne parviendrait jamais aux joueurs qui ont
installe le jeu.

`tests/test-catalogue.mjs` tire quinze graines au sort dans le fichier livre,
les resout a nouveau et rejoue chaque solution dans le moteur. Un catalogue qui
mentirait serait la pire panne possible : la promesse du jeu tient a lui.
