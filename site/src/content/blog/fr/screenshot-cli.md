---
title: Faire des captures de sites web en ligne de commande
description: Utilisez la CLI OpenScreenShot pour enregistrer des captures PNG avec une zone d’affichage fixe, une capture de page entière ou une sortie binaire sur stdout.
audience: developers
order: 4
published: 2026-09-18
updated: 2026-10-21
---

La CLI OpenScreenShot capture une page web en PNG avec un navigateur compatible Chrome installé en local. C’est un paquet séparé de l’extension de navigateur. Avec Node.js, pnpm et Chrome installés, exécutez :

```sh
pnpm dlx openscreenshot shot https://example.com --out screenshot.png --full
```

La commande démarre un navigateur headless séparé, ouvre l’URL, écrit l’image et ferme le navigateur. Elle ne se connecte ni aux onglets ni au profil connecté de votre navigateur habituel.

## Définir la zone d’affichage explicitement

Pour une capture de la zone d’affichage, omettez `--full`. La largeur par défaut est de 1280 pixels et la hauteur par défaut de 800 pixels. Définissez les deux quand une mise en page demande une taille précise :

```sh
pnpm dlx openscreenshot shot https://example.com --out desktop.png --width 1440 --height 900
pnpm dlx openscreenshot shot https://example.com --out narrow.png --width 390 --height 844
```

La largeur accepte des entiers de 200 à 3840 ; la hauteur accepte des entiers de 200 à 2160. Une zone d’affichage étroite teste la mise en page responsive à cette largeur. Elle n’émule pas la saisie tactile d’un téléphone, son ratio de pixels ni un navigateur mobile : la CLI utilise un user agent d’ordinateur.

Ajoutez `--full` pour capturer au-delà de la zone d’affichage. La capture de page entière du navigateur headless diffère de la méthode de l’extension, qui fait défiler puis assemble ; ne supposez pas que chaque page dynamique aura exactement le même rendu dans les deux.

## Enregistrer un fichier ou écrire sur stdout

Sans `--out`, la commande écrit `screenshot.png` dans le dossier courant. Utilisez un nom de fichier explicite pour que les artefacts soient faciles à identifier. Créez le dossier de sortie parent avant d’exécuter la commande.

`--out -` écrit les octets PNG sur stdout :

```sh
pnpm dlx openscreenshot shot https://example.com --out - > screenshot.png
```

Utilisez une redirection compatible avec les données binaires. Une capture locale produit toujours du PNG ; nommer la sortie `capture.jpg` ou `capture.pdf` ne la convertit pas. Pour des images annotées ou une sortie PDF, utilisez l’[éditeur de l’extension](/fr/docs/#export). Pour obtenir d’autres formats depuis la CLI, utilisez `--cloud` avec `--format`, comme décrit plus bas.

## Masquer avant d’enregistrer

Trois options couvrent des données par des rectangles noirs dans la page avant la capture : les pixels non masqués n’atteignent donc jamais le PNG. Répétez chaque option pour ajouter des cibles :

```sh
pnpm dlx openscreenshot shot https://example.com --out safe.png \
  --redact "#account-menu" --redact-pattern email,secret --redact-rect 0,0,200,40
```

`--redact` couvre chaque élément qui correspond à un sélecteur CSS, avec tous ses enfants. `--redact-pattern` couvre le texte et les valeurs de formulaire qui correspondent à `email`, `phone` (de 9 à 15 chiffres) ou `secret` (formes courantes de clés d’API et de jetons, et longs hachages). `--redact-rect x,y,w,h` couvre un rectangle en pixels de l’image de sortie ; utilisez-le pour les canevas, les images et les iframes d’une autre origine.

La capture échoue avec le code de sortie 1 et n’écrit aucun fichier si un sélecteur ne correspond à rien, si un rectangle sort de l’image ou si la page déplace une cible pendant la capture. Les motifs peuvent manquer du texte réparti sur plusieurs éléments ou dessiné dans une image : examinez donc le PNG avant de le partager.

## Rendre la page sur OpenScreenShot Cloud

[OpenScreenShot Cloud](https://cloud.openscreenshot.app) est une API de capture hébergée et facultative. Avec `--cloud`, la page est rendue sur les serveurs de Cloud : la machine n’a donc pas besoin de Chrome. Le mode local reste le mode par défaut et ne demande aucun compte.

Connectez-vous une fois :

```sh
pnpm dlx openscreenshot auth login
```

La commande affiche un code, par exemple `ABCD-EFGH`, et ouvre `https://cloud.openscreenshot.app/device` dans votre navigateur. Connectez-vous avec le code que Cloud envoie à votre adresse e-mail, puis approuvez le code. La CLI enregistre une clé d’API dans `~/.openscreenshot.json`.

Ajoutez ensuite `--cloud` à une capture :

```sh
pnpm dlx openscreenshot shot https://example.com --out page.png --full --cloud
pnpm dlx openscreenshot shot https://example.com --out page.pdf --cloud --format pdf
```

Avec `--cloud`, `--format` accepte `png`, `jpeg`, `webp`, `pdf`, `html` et `markdown`. `--full`, `--width` et `--height` fonctionnent comme en mode local. La CLI prend la clé d’API d’abord dans `--key osc_live_…`, puis dans la variable d’environnement `OPENSCREENSHOT_API_KEY`, puis dans la clé enregistrée par `auth login`. `--cloud <url>` ou `OPENSCREENSHOT_CLOUD_URL` définit une autre URL de base.

Les options de masquage fonctionnent aussi avec `--cloud`. Le serveur de Cloud dessine les rectangles noirs avant de renvoyer l’image. Le masquage exige une sortie PNG, et un sélecteur qui ne correspond à rien fait échouer la capture, sans image.

En mode Cloud, l’URL et les options sont envoyées à OpenScreenShot Cloud, et la page est rendue sur ses serveurs ; consultez la [politique de confidentialité de Cloud](https://cloud.openscreenshot.app/privacy). Le mode local n’envoie rien à OpenScreenShot. L’offre gratuite donne 100 captures par mois sans carte bancaire, et les captures échouées sont gratuites. La [page des tarifs](https://cloud.openscreenshot.app/pricing) présente les autres offres, et la [documentation de l’API](https://cloud.openscreenshot.app/docs) décrit chaque option.

## Résoudre les échecs courants

Si Chrome est introuvable, installez-le ou définissez `CHROME_PATH` sur l’exécutable du navigateur. Par exemple, sur un système Linux où Chromium est installé à cet emplacement :

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx openscreenshot shot https://example.com --out screenshot.png
```

La navigation attend `networkidle2` avec un délai d’expiration de 30 secondes. La commande actuelle n’a pas d’option d’attente personnalisée, d’attente de sélecteur, de cookie ni de connexion. Une capture réussie ne prouve pas non plus que l’application s’est chargée correctement : examinez le PNG à la recherche de pages d’erreur, d’états de chargement et de ressources manquantes.

Le code de sortie 0 indique que la commande de capture s’est terminée, 1 indique un échec de capture et 2 indique un usage invalide ou des arguments refusés à la validation. Utilisez ces codes pour enchaîner des commandes, puis examinez l’image elle-même.

Pour des artefacts reproductibles, lisez [le guide de capture en CI](/fr/blog/screenshots-for-ci/). Pour un processus piloté par un agent, consultez [le guide de configuration MCP](/fr/blog/screenshot-mcp-server/). Le [code source de la CLI](https://github.com/pghqdev/OpenScreenShot/tree/main/mcp/src) fait référence pour les options disponibles.
