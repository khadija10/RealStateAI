/**
 * Tests E2E — Authentification et protection des onglets
 *
 * Golden paths :
 *   - Onglets protégés masqués si non connecté
 *   - Ouverture de la modale auth via "Connexion"
 *   - Inscription et login affichent l'email dans le header
 *   - Onglets Financement et Historique visibles après connexion
 *   - Déconnexion masque à nouveau les onglets protégés
 */

describe('Authentification', () => {
  beforeEach(() => {
    cy.mockApi()
    cy.visit('/')
    cy.wait('@health')
  })

  context('Non connecté', () => {
    it('masque les onglets Financement et Historique', () => {
      cy.contains('Financement').should('not.exist')
      cy.contains('Historique').should('not.exist')
    })

    it('affiche le bouton Connexion dans le header', () => {
      cy.contains('Connexion').should('be.visible')
    })

    it('ouvre la modale d\'authentification au clic sur Connexion', () => {
      cy.contains('Connexion').click()
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
    })

    it('la modale se ferme avec Échap ou le bouton fermer', () => {
      cy.contains('Connexion').click()
      cy.get('input[type="email"]').should('be.visible')
      cy.get('body').type('{esc}')
      cy.get('input[type="email"]').should('not.exist')
    })
  })

  context('Inscription', () => {
    it('crée un compte et affiche l\'email dans le header', () => {
      cy.contains('Connexion').click()
      // Bascule vers inscription si besoin
      cy.contains(/créer|s'inscrire|inscription/i).click()
      cy.get('input[type="email"]').type('new@example.com')
      cy.get('input[type="password"]').type('motdepasse123')
      cy.get('button[type="submit"]').click()
      cy.wait('@register')

      cy.contains('new@example.com').should('be.visible')
      cy.contains('Déconnexion').should('be.visible')
    })

    it('affiche les onglets protégés après inscription', () => {
      cy.contains('Connexion').click()
      cy.contains(/créer|s'inscrire|inscription/i).click()
      cy.get('input[type="email"]').type('new@example.com')
      cy.get('input[type="password"]').type('motdepasse123')
      cy.get('button[type="submit"]').click()
      cy.wait('@register')

      cy.contains('Financement').should('be.visible')
      cy.contains('Historique').should('be.visible')
    })
  })

  context('Connexion', () => {
    it('connecte l\'utilisateur et affiche son email', () => {
      cy.contains('Connexion').click()
      cy.get('input[type="email"]').type('test@example.com')
      cy.get('input[type="password"]').type('motdepasse')
      cy.get('button[type="submit"]').click()
      cy.wait('@login')

      cy.contains('test@example.com').should('be.visible')
    })

    it('affiche une erreur si mauvais mot de passe', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: { detail: 'Email ou mot de passe incorrect.' },
      }).as('loginFail')

      cy.contains('Connexion').click()
      cy.get('input[type="email"]').type('test@example.com')
      cy.get('input[type="password"]').type('mauvais')
      cy.get('button[type="submit"]').click()
      cy.wait('@loginFail')

      cy.contains(/incorrect|invalide/i).should('be.visible')
    })
  })

  context('Déconnexion', () => {
    beforeEach(() => {
      cy.login()
      cy.reload()
      cy.wait('@me')
    })

    it('masque les onglets protégés après déconnexion', () => {
      cy.contains('Financement').should('be.visible')
      cy.contains('Déconnexion').click()
      cy.contains('Financement').should('not.exist')
      cy.contains('Historique').should('not.exist')
    })

    it('redirige vers Estimation si on était sur un onglet protégé', () => {
      cy.mockApi()
      cy.contains('Historique').click()
      cy.wait('@history')
      cy.contains('Déconnexion').click()
      cy.contains('Estimez la valeur').should('be.visible')
    })
  })

  context('Session persistante', () => {
    it('restaure la session depuis le token localStorage au rechargement', () => {
      cy.login()
      cy.reload()
      cy.wait('@me')
      cy.contains('test@example.com').should('be.visible')
      cy.contains('Financement').should('be.visible')
    })
  })
})
