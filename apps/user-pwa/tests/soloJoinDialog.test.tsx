import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SoloJoinDialog } from '../src/components/matches/SoloJoinDialog.js';
import * as matchesApi from '../src/api/matches.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import { userMatchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Requirement 2: Solo Join Dialog', () => {
  let queryClient: QueryClient;

  const mockMatch = loadContractFixture(
    'GET_api_v1_matches_id__upcoming.json',
    userMatchDetailResponseGuard,
    'GET /api/v1/matches/:id'
  ).match;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    } as any);
    vi.clearAllMocks();
  });

  it('Requirement 2: solo join dialog shows entry fee and exact rule text without computing wallet breakdown in browser', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SoloJoinDialog
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Shows entry fee formatted in rupees
    const feeEl = screen.getByTestId('join-dialog-fee');
    expect(feeEl.textContent).toContain('Rs20.00');

    // Shows the exact rule text
    const ruleEl = screen.getByTestId('join-dialog-rule-text');
    expect(ruleEl.textContent).toContain(
      'Up to 5% can come from cashback; the rest from Add Money, then Winning'
    );

    // Browser does NOT render any computed wallet breakdown before server response
    expect(screen.queryByTestId('join-charge-breakdown')).toBeNull();
  });

  it('Requirement 2: renders server charge breakdown after joining if returned by API', async () => {
    vi.spyOn(matchesApi, 'joinMatchSolo').mockResolvedValueOnce({
      message: 'Joined match successfully',
      matchId: mockMatch.id,
      joinedAt: '2026-10-11T12:00:00Z',
      chargeBreakdown: {
        cashback: '1.00',
        addMoney: '19.00',
        winning: '0.00',
      },
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SoloJoinDialog
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const confirmBtn = screen.getByTestId('confirm-join-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('join-success-state')).toBeInTheDocument();
      const breakdownEl = screen.getByTestId('join-charge-breakdown');
      expect(breakdownEl.textContent).toContain('Cashback: Rs1.00');
      expect(breakdownEl.textContent).toContain('Add Money: Rs19.00');
    });
  });

  it('Requirement 2: does not render extra charge breakdown if API returns no breakdown', async () => {
    vi.spyOn(matchesApi, 'joinMatchSolo').mockResolvedValueOnce({
      message: 'Joined match successfully',
      matchId: mockMatch.id,
      joinedAt: '2026-10-11T12:00:00Z',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SoloJoinDialog
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const confirmBtn = screen.getByTestId('confirm-join-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('join-success-state')).toBeInTheDocument();
      expect(screen.queryByTestId('join-charge-breakdown')).toBeNull();
    });
  });

  it('Requirement 2: double-tap guard prevents duplicate join requests', async () => {
    let resolveJoin: any;
    const joinPromise = new Promise<{ message: string; matchId: string; joinedAt: string }>((res) => {
      resolveJoin = res;
    });
    const joinSpy = vi.spyOn(matchesApi, 'joinMatchSolo').mockReturnValueOnce(joinPromise);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SoloJoinDialog
            match={mockMatch}
            isOpen={true}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const confirmBtn = screen.getByTestId('confirm-join-btn');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn); // rapid second tap

    expect(joinSpy).toHaveBeenCalledTimes(1);
    resolveJoin({ message: 'Joined', matchId: '1', joinedAt: '2026-10-11T12:00:00Z' });
  });
});
