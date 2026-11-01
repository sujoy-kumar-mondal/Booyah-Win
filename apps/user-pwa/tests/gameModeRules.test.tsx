import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchDetailModal } from '../src/components/matches/MatchDetailModal.js';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as rulesApi from '../src/api/rules.js';

describe('Game Mode Rules: Battle Royale vs Clash Squad', () => {
  let queryClient: QueryClient;

  const mockBaseMatch: any = {
    id: '100',
    gameMode: 'battle_royale',
    teamMode: 'solo',
    mapName: 'Bermuda',
    status: 'upcoming',
    startTime: new Date(Date.now() + 3600000).toISOString(),
    entryFee: '10.00',
    seatsTaken: 0,
    joinedPlayers: 0,
    maxPlayers: 48,
    minPlayers: 24,
    hasJoined: false,
    prizes: {
      killPrice: '5.00',
      positions: { '1': '50.00', '2': '40.00', '3': '30.00' },
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any,
      wallets: { total: '100.00' } as any,
      refreshProfile: vi.fn(),
    });
  });

  it('fetches and displays Clash Squad rules when match gameMode is clash_squad', async () => {
    const fetchRulesSpy = vi.spyOn(rulesApi, 'fetchMatchRules').mockResolvedValue({
      imageUrl: '',
      rulesEn: 'Clash Squad Rules:\nRoom Structure:\nRounds : 7\nDefault Coins : 9950\nAll guns are Allowed Except Double Vector',
      rulesBn: 'ক্ল্যাশ স্কোয়াড নিয়মাবলী:\nরুমের কাঠামো:\nরাউন্ড : ৭\nডিফল্ট কয়েন : ৯৯৫০',
    });

    const csMatch = {
      ...mockBaseMatch,
      gameMode: 'clash_squad',
      teamMode: 'squad',
      maxPlayers: 8,
      minPlayers: 8,
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={csMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify fetchMatchRules was called with 'clash_squad'
    await waitFor(() => {
      expect(fetchRulesSpy).toHaveBeenCalledWith('clash_squad');
    });

    // Check English Clash Squad rules content
    expect(screen.getByText(/Clash Squad Rules:/i)).toBeInTheDocument();
    expect(screen.getByText(/Default Coins : 9950/i)).toBeInTheDocument();

    // Switch to Bangla
    const bnBtn = screen.getByRole('button', { name: /বাংলা|BANGLA/i });
    fireEvent.click(bnBtn);

    // Check Bangla Clash Squad rules content
    await waitFor(() => {
      expect(screen.getByText(/ক্ল্যাশ স্কোয়াড নিয়মাবলী:/i)).toBeInTheDocument();
      expect(screen.getByText(/ডিফল্ট কয়েন : ৯৯৫০/i)).toBeInTheDocument();
    });
  });

  it('fetches and displays Battle Royale rules when match gameMode is battle_royale', async () => {
    const fetchRulesSpy = vi.spyOn(rulesApi, 'fetchMatchRules').mockResolvedValue({
      imageUrl: '',
      rulesEn: 'Battle Royale Rules:\nHorse [GHODA] is banned\nSnipers banned in Survival',
      rulesBn: 'ব্যাটেল রয়্যাল নিয়মাবলী:\nঘোড়া ব্যবহার নিষিদ্ধ',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={mockBaseMatch}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(fetchRulesSpy).toHaveBeenCalledWith('battle_royale');
    });

    expect(screen.getByText(/Battle Royale Rules:/i)).toBeInTheDocument();
    expect(screen.getByText(/Horse \[GHODA\] is banned/i)).toBeInTheDocument();
  });

  it('displays dynamic minimum kills for reward in Prize Pool tab', async () => {
    vi.spyOn(rulesApi, 'fetchMatchRules').mockResolvedValue({
      imageUrl: '',
      rulesEn: '',
      rulesBn: '',
    });

    const matchWith1KillReward = {
      ...mockBaseMatch,
      prizes: {
        ...mockBaseMatch.prizes,
        minKillsForReward: 1,
      },
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MatchDetailModal
            match={matchWith1KillReward}
            isOpen={true}
            onClose={() => {}}
            onRefreshMatch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const prizeTab = screen.getByText(/PRIZE POOL/i);
    fireEvent.click(prizeTab);

    const note = screen.getByTestId('br-kill-rule-note');
    expect(note).toHaveTextContent('Minimum 1 kills to earn kill rewards');
  });
});
