/**
 * Tests E2E — Historique des estimations
 *
 * Golden paths :
 *   - Affichage de la liste paginée (5 par page)
 *   - Sélection de 2 biens → bloc comparaison visible
 *   - Désélection efface la comparaison
 */

describe('Historique', () => {
  beforeEach(() => {
    cy.mockApi()
    cy.login()
    cy.visit('/')
    cy.wait('@health')
    cy.wait('@me')
    cy.contains('Historique').click()
    cy.wait('@history')
  })

  it('affiche les estimations récentes', () => {
    cy.contains('12 Rue de la Paix').should('be.visible')
    cy.contains('Versailles').should('be.visible')
  })

  it('affiche le prix et le prix/m² de chaque estimation', () => {
    cy.contains('525').should('be.visible')   // 525 000 €
    cy.contains('720').should('be.visible')   // 720 000 €
  })

  it('affiche le type et la surface', () => {
    cy.contains(/appartement/i).should('be.visible')
    cy.contains(/maison/i).should('be.visible')
    cy.contains('60 m²').should('be.visible')
  })

  it('sélectionner 2 biens affiche la comparaison', () => {
    // Clique sur les 2 premiers items
    cy.get('[data-testid="history-item"], .cursor-pointer').eq(0).click()
    cy.get('[data-testid="history-item"], .cursor-pointer').eq(1).click()

    cy.contains(/comparaison/i).should('be.visible')
    cy.contains(/écart de prix/i).should('be.visible')
  })

  it('effacer la comparaison masque le bloc', () => {
    cy.get('[data-testid="history-item"], .cursor-pointer').eq(0).click()
    cy.get('[data-testid="history-item"], .cursor-pointer').eq(1).click()
    cy.contains(/comparaison/i).should('be.visible')

    cy.contains('Effacer').click()
    cy.contains(/écart de prix/i).should('not.exist')
  })

  it('affiche un message si l\'historique est vide', () => {
    cy.intercept('GET', '/api/search-history*', []).as('historyVide')
    cy.reload()
    cy.wait('@me')
    cy.contains('Historique').click()
    cy.wait('@historyVide')

    cy.contains(/aucune estimation/i).should('be.visible')
  })
})
