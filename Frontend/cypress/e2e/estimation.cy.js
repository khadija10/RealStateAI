/**
 * Tests E2E — Formulaire d'estimation et panneau de résultat
 *
 * Golden paths :
 *   - Remplir le formulaire et obtenir un résultat
 *   - Voir le prix, prix/m², badge modèle, fiabilité
 *   - Ouvrir/fermer l'accordéon "Détails du modèle"
 *   - Exporter PDF (déclenche window.print)
 *   - Teaser connexion pour Financement et Valorisation si non connecté
 */

describe('Estimation — formulaire et résultat', () => {
  beforeEach(() => {
    cy.mockApi()
    cy.visit('/')
    cy.wait('@health')
  })

  it('affiche le titre principal', () => {
    cy.contains('Estimez la valeur de votre bien').should('be.visible')
  })

  it('soumet le formulaire et affiche le prix estimé', () => {
    cy.get('select[name="property_type"], select').first().select('apartment')
    cy.get('input[placeholder*="surface"], input[type="number"]').first().clear().type('60')

    // Sélectionne une commune dans le datalist ou l'input
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first()
      .clear()
      .type('PARIS 15')

    cy.get('button[type="submit"], button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.contains('525').should('be.visible')        // 525 000 €
    cy.contains('8 750').should('be.visible')      // prix/m²
  })

  it('affiche le badge modèle et la pill fiabilité', () => {
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.contains(/ML|Machine Learning|Géolocalisé/i).should('be.visible')
    cy.contains(/fiabilité/i).should('be.visible')
  })

  it('accordéon Détails du modèle est fermé par défaut puis s\'ouvre', () => {
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    // Détails non visibles au départ
    cy.contains(/méthode|erreur médiane|entraîné/i).should('not.exist')

    // Clic sur le bouton accordéon
    cy.contains('Détails du modèle').click()
    cy.contains(/méthode|erreur médiane|entraîné/i).should('be.visible')

    // Refermer
    cy.contains('Détails du modèle').click()
    cy.contains(/méthode|erreur médiane|entraîné/i).should('not.exist')
  })

  it('bouton Exporter PDF déclenche l\'impression', () => {
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.window().then((win) => {
      cy.stub(win, 'print').as('print')
    })
    cy.contains('Exporter PDF').click()
    cy.get('@print').should('have.been.called')
  })

  it('affiche le teaser Financement si non connecté', () => {
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.contains(/connexion pour simuler/i).should('be.visible')
    cy.contains('Simuler mon financement').should('not.exist')
  })

  it('affiche le teaser Valorisation si non connecté', () => {
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.contains(/valorisation à terme/i).should('be.visible')
  })

  it('affiche le bouton Financement après connexion', () => {
    cy.login()
    cy.reload()
    cy.wait('@me')

    cy.mockApi()
    cy.get('input[list], input[placeholder*="commune"], input[placeholder*="Commune"]')
      .first().clear().type('PARIS 15')
    cy.get('input[type="number"]').first().clear().type('60')
    cy.get('button').contains(/estimer|calculer/i).click()
    cy.wait('@estimate')

    cy.contains('Simuler mon financement').should('be.visible')
  })
})
