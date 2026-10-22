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

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Sans clé API, l'exemple « lavage auto en Pologne » et toute la partie simulation fonctionnent ; seules la génération et l'assistant nécessitent Claude.

### Mise en ligne (accès depuis le téléphone)

Le plus simple : importer le dépôt sur [Vercel](https://vercel.com/new), ajouter la variable d'environnement `ANTHROPIC_API_KEY`, puis déployer.
La clé reste côté serveur (routes `/api/generate` et `/api/ask`), elle n'est jamais envoyée au navigateur.

## Données

Les plans sont enregistrés dans le navigateur (localStorage). Utilisez **Exporter (.json)** pour sauvegarder ou transférer un plan, et **Importer** sur la page d'accueil pour le recharger. **Imprimer / PDF** produit une version papier.

## Hypothèses de calcul

- Montants hors taxes ; la TVA collectée/déductible n'est pas modélisée en trésorerie.
- Investissements décaissés au 1er mois, amortis en linéaire (durée 0 = non amortissable : BFR, dépôts, terrain).
- Prêts à mensualités constantes, avec différé d'amortissement possible (intérêts seuls).
- Impôt sur les sociétés calculé par exercice avec report des déficits, payé en fin d'exercice.
- Prix, charges et salaires indexés sur l'inflation ; volumes : saisonnalité × montée en charge × croissance annuelle.
- Point mort = (charges fixes + personnel + amortissements + intérêts) / taux de marge sur coûts variables.

## Technique

Next.js (App Router) + TypeScript, SDK `@anthropic-ai/sdk` (modèle `claude-opus-5-5`, sorties structurées validées par Zod), graphiques Recharts.

```bash
npm test        # tests du moteur de calcul (lib/finance.ts)
npm run build
```
