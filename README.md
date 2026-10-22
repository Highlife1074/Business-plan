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
| **Assistant Claude** | Conversation avec Claude, qui voit toutes les hypothèses et les résultats calculés |

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
npm test        # tests du moteur de calcul (lib/finance.ts)
npm run build
```
