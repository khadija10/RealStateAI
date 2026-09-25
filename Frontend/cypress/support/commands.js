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
})

// Simule une session authentifiée via localStorage
Cypress.Commands.add('login', (email = 'test@example.com') => {
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.fake'
  cy.window().then((win) => {
    win.localStorage.setItem('reai_token', fakeToken)
  })
  cy.intercept('GET', '/api/auth/me', { id: 1, email }).as('me')
})
