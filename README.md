# Simulateur de business plan (avec Claude)

Web app pour simuler un business plan pour n'importe quelle activité (lavage auto, pizzeria, boulangerie…) dans n'importe quel pays.
Claude génère une première version complète : hypothèses chiffrées, synthèse, juridique, SWOT, risques et liste des devis à obtenir.
Vous ajustez ensuite chaque paramètre, et **tout le document se recalcule** : sommaire, résultats d'exploitation, trésorerie, point mort.

## Onglets

| Onglet | Contenu |
|---|---|
| **Sommaire** | Vue macro : alertes, indicateurs clés (investissement, CA, EBE, résultat net, point mort, trésorerie min., retour sur investissement, VAN/TRI), graphiques, synthèse, SWOT résumé |
| **Paramètres** | Toutes les hypothèses modifiables : généraux (TVA, IS, charges sociales, inflation), saisonnalité, montée en charge, lignes de chiffre d'affaires, charges fixes, personnel, investissements, financement (apport, subventions, prêts avec différé) |
| **Résultats d'exploitation** | Compte de résultat prévisionnel annuel + détail mensuel |
| **Trésorerie** | Plan de financement initial, courbe de trésorerie, tableaux annuel et mensuel des encaissements / décaissements |
| **Point mort** | Seuil de rentabilité, point mort en jours et date, marge de sécurité, volumes nécessaires par jour |
| **Juridique** | Forme juridique, autorisations, fiscalité… propres au pays (éditable, approfondissable avec Claude) |
| **SWOT & risques** | Forces, faiblesses, opportunités, menaces, matrice des risques avec mitigation, marché, hypothèses clés |
| **Devis** | Devis à obtenir, enregistrement des offres reçues, comparatif. Un devis **retenu** lié à une ligne du plan remplace automatiquement son montant dans tous les calculs |
| **Démarches** | Agent fournisseurs : Claude cherche des fournisseurs (recherche web) pour chaque devis à obtenir, rédige les demandes de devis dans la langue du pays, vous validez puis l'e-mail part depuis votre Gmail ; les réponses sont relevées, analysées par Claude et enregistrables comme devis ; relances proposées après le délai choisi |
| **Assistant Claude** | Conversation avec Claude, qui voit toutes les hypothèses et les résultats calculés |

Le **convertisseur de devises**, en haut de chaque plan, affiche tous les rapports (sommaire, résultats, trésorerie, point mort)
dans la devise de votre choix au taux du jour (sources : open.er-api.com, puis jsDelivr `currency-api` en secours ; taux mis en cache 12 h).
Tous les montants suivent la devise choisie, **y compris les champs de saisie** (Paramètres, Devis) : un montant saisi en EUR
est enregistré dans la devise du plan au taux du jour. Le choix est aussi disponible dans Paramètres (« Devise des montants »). Le bouton **Convertir le plan en …**
change définitivement la devise du plan et convertit tous les montants (prix, charges, salaires, investissements, financement, devis).

Le **scénario** (curseurs volumes / prix / coûts, préréglages pessimiste / réaliste / optimiste) permet de tester la sensibilité sans toucher aux hypothèses de base.

## Utilisation

L'app est publiée automatiquement sur **GitHub Pages** à chaque mise à jour de `main` :
https://highlife1074.github.io/Business-plan/

Au premier lancement, ouvrez **Réglages** sur la page d'accueil :
1. **Se connecter avec Google** : vos plans et votre clé Claude sont sauvegardés dans Firebase (Firestore)
   et retrouvés automatiquement sur tous vos appareils (PC, téléphone…).
2. Collez votre **clé API Claude** (créée sur [console.anthropic.com](https://console.anthropic.com), rubrique *API Keys*).
   Elle n'est jamais écrite dans le code ni sur GitHub ; elle est stockée dans le navigateur et dans votre espace Firestore privé.

Sans connexion, l'app fonctionne aussi : les données restent alors dans le navigateur de l'appareil.

Sans clé, l'exemple « lavage auto en Pologne » et toute la partie simulation fonctionnent ; seules la génération et l'assistant nécessitent Claude.

### En local

```bash
npm install
npm run dev     # http://localhost:3000
```

## Firebase

Configuration du projet dans `lib/firebase-config.ts` (valeurs publiques par nature).
Les règles de sécurité Firestore sont dans `firestore.rules` : chaque utilisateur connecté n'accède qu'à `users/{son uid}/…`.
Dans la console Firebase : activer **Authentication → Google**, ajouter `highlife1074.github.io` aux domaines autorisés,
créer la base **Firestore** et y coller les règles.

## Gmail (onglet Démarches)

L'envoi et la lecture des e-mails passent par l'API Gmail, avec votre compte Google (autorisation demandée au premier envoi, valable 1 heure).
À faire une fois dans la [console Google Cloud](https://console.cloud.google.com) du projet Firebase (`business-plan-708ce`) :
1. **API et services → Bibliothèque → Gmail API → Activer**.
2. **Google Auth Platform → Audience** : si l'application est « En test », ajoutez votre adresse Gmail dans **Utilisateurs test**.
   Google affichera « application non validée » : **Paramètres avancés → Accéder à l'application**, c'est normal pour un usage personnel.

Rien n'est envoyé sans votre confirmation. Les relances sont proposées à l'ouverture de l'app (pas d'envoi automatique en arrière-plan).

## Données

Les plans sont enregistrés dans le navigateur (localStorage) et, une fois connecté, synchronisés dans Firestore
(la version la plus récente de chaque plan l'emporte). Utilisez **Exporter (.json)** pour sauvegarder ou transférer un plan, et **Importer** sur la page d'accueil pour le recharger. **Imprimer / PDF** produit une version papier.

## Hypothèses de calcul

- Montants hors taxes ; la TVA collectée/déductible n'est pas modélisée en trésorerie.
- Investissements décaissés au 1er mois, amortis en linéaire (durée 0 = non amortissable : BFR, dépôts, terrain).
- Prêts à mensualités constantes, avec différé d'amortissement possible (intérêts seuls).
- Impôt sur les sociétés calculé par exercice avec report des déficits, payé en fin d'exercice.
- Prix, charges et salaires indexés sur l'inflation ; volumes : saisonnalité × montée en charge × croissance annuelle.
- Point mort = (charges fixes + personnel + amortissements + intérêts) / taux de marge sur coûts variables.

## Technique

Next.js (App Router, export statique) + TypeScript, SDK `@anthropic-ai/sdk` appelé depuis le navigateur (modèle `claude-opus-5-5`, sorties structurées validées par Zod), graphiques Recharts. Publication : `.github/workflows/pages.yml`.

```bash
npm test        # tests du moteur de calcul, de la synchronisation, des relances et de la conversion
npm run build
```
