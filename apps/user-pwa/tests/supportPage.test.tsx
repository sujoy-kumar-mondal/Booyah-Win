import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Support } from '../src/pages/Support.js';
import * as supportApi from '../src/api/support.js';
import { userSupportInfoResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement Support: Customer Support Screen', () => {
  const configuredSupport = loadContractFixture(
    'GET_api_v1_support__configured.json',
    userSupportInfoResponseGuard,
    'GET /api/v1/support'
  );

  const unconfiguredSupport = loadContractFixture(
    'GET_api_v1_support__not_configured.json',
    userSupportInfoResponseGuard,
    'GET /api/v1/support'
  );

  it('Requirement Support: renders configured contact details with tel and mailto links', async () => {
    vi.spyOn(supportApi, 'fetchSupportInfo').mockResolvedValueOnce(configuredSupport);

    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('support-configured-state')).toBeInTheDocument();

      const phoneLink = screen.getByTestId('support-phone-link');
      expect(phoneLink.textContent).toContain('+91 9999999999');
      expect(phoneLink.getAttribute('href')).toBe('tel:+91 9999999999');

      const emailLink = screen.getByTestId('support-email-link');
      expect(emailLink.textContent).toContain('support@booyahwin.com');
      expect(emailLink.getAttribute('href')).toBe('mailto:support@booyahwin.com');

      const hoursEl = screen.getByTestId('support-hours-text');
      expect(hoursEl.textContent).toContain('10:00 AM - 10:00 PM IST');
    });
  });

  it('Requirement Support: renders friendly message when support details are unconfigured', async () => {
    vi.spyOn(supportApi, 'fetchSupportInfo').mockResolvedValueOnce(unconfiguredSupport);

    render(
      <MemoryRouter>
        <Support />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('support-not-configured-state')).toBeInTheDocument();
      expect(screen.getByText('Support Not Yet Configured')).toBeInTheDocument();
      expect(
        screen.getByText(/Our customer support channels are currently being updated/i)
      ).toBeInTheDocument();
    });
  });
});
