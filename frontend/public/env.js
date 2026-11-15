// Runtime environment configuration for EcoUrba
// In local development this is empty; on Render it resolves to the public API domain.
if (!window.__API_BASE__ || window.__API_BASE__.includes('://eco-urba-api/') || window.__API_BASE__.endsWith('://eco-urba-api')) {
  if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('onrender.com')) {
    window.__API_BASE__ = 'https://eco-urba-api.onrender.com/api/v1';
  } else {
    window.__API_BASE__ = window.__API_BASE__ || '';
  }
}
