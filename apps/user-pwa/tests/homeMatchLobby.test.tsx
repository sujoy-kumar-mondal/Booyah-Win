import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { Home } from '../src/pages/Home.js';
import * as authModule from '../src/context/AuthContext.js';
import * as matchesApi from '../src/api/matches.js';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

describe('Home Screen - Custom Match Lobby & Ongoing Matches', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Sujoy Kumar Mondal',
        mobile: '9876543210',
        email: 'user@example.com',
        ffId: '1457625118',
        ffName: 'Kingrohitt',
        upiId: 'user@okhdfcbank',
        dob: '2000-01-01',
        is18Plus: true,
        referralCode: 'BOOYAH123',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
      },
      wallets: {
        addMoney: '140.50',
        cashback: '4.50',
        winning: '0.00',
        total: '145.00',
      },
      token: 'mock-jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      isLoading: false,
    } as any);
  });

  it('renders live Custom Match Lobby and does NOT display the milestone 9b preview text', async () => {
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
      expect(screen.getByText('Custom Match Lobby')).toBeInTheDocument();
      expect(screen.getByTestId('enter-matches-btn')).toBeInTheDocument();
    });

    // Outdated milestone text must be completely absent
    expect(
      screen.queryByText(/Battle Royale and Clash Squad rooms are unlocking in Milestone 9b/i)
    ).not.toBeInTheDocument();

    // Clicking "Enter Match Lobby" navigates to /matches
    fireEvent.click(screen.getByTestId('enter-matches-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/matches');
  });

  it('displays ongoing matches and View All button when matches are available', async () => {
    vi.spyOn(matchesApi, 'fetchMatches').mockResolvedValue([
      {
        id: 'match-101',
        gameMode: 'Battle Royale',
        teamMode: 'Solo',
        map: 'Bermuda',
        scheduledAt: '2026-10-15T18:00:00Z',
        entryFee: '20.00',
        status: 'open',
        maxPlayers: 48,
        registeredCount: 12,
        hasJoined: true,
        prizes: {
          positions: { '1': '400.00' },
          perKill: '15.00',
        },
      } as any,
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('home-match-card-match-101')).toBeInTheDocument();
      expect(screen.getByText('Battle Royale')).toBeInTheDocument();
      expect(screen.getByText('Bermuda')).toBeInTheDocument();
      expect(screen.getByText('Joined')).toBeInTheDocument();
      expect(screen.getByText('Rs20.00')).toBeInTheDocument();
    });

    // Clicking View All navigates to /matches
    fireEvent.click(screen.getByTestId('home-view-all-matches'));
    expect(mockNavigate).toHaveBeenCalledWith('/matches');
  });
});
