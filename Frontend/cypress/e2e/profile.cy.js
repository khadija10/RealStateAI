/**
 * Tests E2E — Onglet Profil
 *
 * Golden paths :
 *   - Affichage de l'email utilisateur
 *   - Changement de mot de passe (succès + erreur)
 *   - Suppression de compte avec confirmation en deux étapes
 */

describe('Profil', () => {
  beforeEach(() => {
    cy.mockApi()
    cy.login()
    cy.visit('/')
    cy.wait('@me')
    cy.contains('Profil').click()
  })

  context('Informations compte', () => {
    it('affiche l\'email de l\'utilisateur connecté', () => {
      cy.contains('test@example.com').should('be.visible')
    })

    it('affiche la section Mon compte', () => {
      cy.contains(/mon compte/i).should('be.visible')
    })
  })

  context('Changer le mot de passe', () => {
    it('affiche le formulaire de changement de mot de passe', () => {
      cy.contains(/changer le mot de passe/i).should('be.visible')
      cy.get('#pw-current').should('exist')
      cy.get('#pw-next').should('exist')
      cy.get('#pw-confirm').should('exist')
    })

    it('soumet le formulaire et affiche le message de succès', () => {
      cy.get('#pw-current').type('ancien123')
      cy.get('#pw-next').type('nouveau123')
      cy.get('#pw-confirm').type('nouveau123')
      cy.contains('Modifier le mot de passe').click()
      cy.wait('@changePassword')
      cy.contains(/modifié avec succès/i).should('be.visible')
    })

    it('affiche une erreur si les mots de passe ne correspondent pas', () => {
      cy.get('#pw-current').type('ancien123')
      cy.get('#pw-next').type('nouveau123')
      cy.get('#pw-confirm').type('different456')
      cy.contains('Modifier le mot de passe').click()
      cy.contains(/ne correspondent pas/i).should('be.visible')
    })

    it('affiche une erreur si le mot de passe actuel est incorrect', () => {
      cy.intercept('PUT', '/api/auth/me/password', {
        statusCode: 400,
        body: { detail: 'Mot de passe actuel incorrect.' },
      }).as('changePasswordFail')
      cy.get('#pw-current').type('mauvais')
      cy.get('#pw-next').type('nouveau123')
      cy.get('#pw-confirm').type('nouveau123')
      cy.contains('Modifier le mot de passe').click()
      cy.wait('@changePasswordFail')
      cy.contains(/incorrect/i).should('be.visible')
    })

    it('affiche/masque le mot de passe via l\'icône oeil', () => {
      cy.get('#pw-current').should('have.attr', 'type', 'password')
      cy.get('#pw-current').parent().find('button[aria-label]').click()
      cy.get('#pw-current').should('have.attr', 'type', 'text')
    })
  })

  context('Suppression de compte', () => {
    it('affiche le bouton de suppression dans la zone de danger', () => {
      cy.contains(/zone de danger/i).should('be.visible')
      cy.contains(/supprimer mon compte/i).should('be.visible')
    })

    it('demande une confirmation avant de supprimer', () => {
      cy.contains(/supprimer mon compte/i).click()
      cy.contains(/confirmer la suppression/i).should('be.visible')
      cy.contains(/annuler/i).should('be.visible')
    })

    it('annule la suppression au clic sur Annuler', () => {
      cy.contains(/supprimer mon compte/i).click()
      cy.contains(/annuler/i).click()
      cy.contains(/supprimer mon compte/i).should('be.visible')
      cy.contains(/confirmer/i).should('not.exist')
    })

    it('supprime le compte après confirmation et déconnecte', () => {
      cy.contains(/supprimer mon compte/i).click()
      cy.contains(/confirmer la suppression/i).click()
      cy.wait('@deleteAccount')
      // Après suppression → déconnexion → onglets protégés masqués
      cy.contains('Historique').should('not.exist')
      cy.contains('Connexion').should('be.visible')
    })
  })
})
