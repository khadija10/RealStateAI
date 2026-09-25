// Intercepte toutes les routes API avec les fixtures par défaut
Cypress.Commands.add('mockApi', (overrides = {}) => {
  cy.intercept('GET', '/api/health', { fixture: 'health.json' }).as('health')
  cy.intercept('GET', '/api/metadata/communes', ['PARIS 15', 'VERSAILLES', 'BOULOGNE-BILLANCOURT', 'MONTREUIL']).as('communes')
  cy.intercept('GET', '/api/search-history*', { fixture: 'history.json' }).as('history')
  cy.intercept('GET', '/api/market/map', []).as('marketMap')
  cy.intercept('GET', '/api/market/trends*', []).as('marketTrends')
  cy.intercept('POST', '/api/predictions/estimate', overrides.estimation ?? { fixture: 'estimation.json' }).as('estimate')
  cy.intercept('POST', '/api/auth/login', overrides.login ?? {
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.fake',
    user: { id: 1, email: 'test@example.com' },
  }).as('login')
  cy.intercept('POST', '/api/auth/register', overrides.register ?? {
    token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJuZXdAZXhhbXBsZS5jb20ifQ.fake',
    user: { id: 2, email: 'new@example.com' },
  }).as('register')
  cy.intercept('GET', '/api/auth/me', overrides.me ?? { id: 1, email: 'test@example.com' }).as('me')

  // Nouvelles routes
  cy.intercept('POST', '/api/auth/forgot-password', overrides.forgotPassword ?? {
    message: 'Si un compte existe avec cet email, un code a été généré.',
    dev_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  }).as('forgotPassword')
  cy.intercept('POST', '/api/auth/reset-password', overrides.resetPassword ?? {
    message: 'Mot de passe réinitialisé avec succès.',
  }).as('resetPassword')
  cy.intercept('PUT', '/api/auth/me/password', overrides.changePassword ?? {
    message: 'Mot de passe modifié avec succès.',
  }).as('changePassword')
  cy.intercept('DELETE', '/api/history/*', overrides.deleteHistory ?? {
    message: 'Estimation supprimée.',
  }).as('deleteHistoryItem')
  cy.intercept('DELETE', '/api/history', overrides.clearHistory ?? {
    message: '3 estimation(s) supprimée(s).', deleted: 3,
  }).as('clearHistory')
  cy.intercept('DELETE', '/api/auth/me', overrides.deleteAccount ?? {
    message: 'Compte supprimé définitivement.',
  }).as('deleteAccount')
  cy.intercept('GET', '/api/financing/rates', overrides.financingRates ?? {
    taux_par_duree: { '15': 0.0295, '20': 0.0310, '25': 0.0330 },
    taux_assurance: 0.0034,
    derniere_verification: '2026-09-01',
    millesime: 2026,
  }).as('financingRates')
})

// Simule une session authentifiée via localStorage
Cypress.Commands.add('login', (email = 'test@example.com') => {
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.fake'
  cy.window().then((win) => {
    win.localStorage.setItem('reai_token', fakeToken)
  })
  cy.intercept('GET', '/api/auth/me', { id: 1, email }).as('me')
})
