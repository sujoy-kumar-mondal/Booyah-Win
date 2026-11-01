import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../src/context/AuthContext.js';
import * as UserApiModule from '../src/api/user.js';
import {
  CommunityDailyPopup,
  getTodayDateKey,
} from '../src/components/common/CommunityDailyPopup.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Daily Community Popup for Logged-In Users', () => {
  const mockUser = {
    id: 'BW-USR-100',
    name: 'Pro Player',
    username: 'proplayer',
    email: 'player@example.com',
    mobile: '9876543210',
    dateOfBirth: '2000-01-01',
    hasUpi: true,
    hasFreeFire: true,
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockNavigate.mockClear();

    vi.spyOn(UserApiModule, 'fetchCommunityLinks').mockResolvedValue({
      whatsapp: 'https://chat.whatsapp.com/test-community',
      instagram: 'https://instagram.com/test-booyahwin',
      telegram: 'https://t.me/test-booyahwin',
      youtube: 'https://youtube.com/@test-booyahwin',
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does NOT open popup when user is unauthenticated (guest)', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('community-daily-popup')).not.toBeInTheDocument();
  });

  it('opens popup when logged-in user visits for the first time today and stores date in localStorage', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    const popup = await screen.findByTestId('community-daily-popup');
    expect(popup).toBeInTheDocument();

    // Verify localStorage has today's date key
    const todayKey = getTodayDateKey();
    expect(localStorage.getItem(`bw_community_popup_${mockUser.id}`)).toBe(todayKey);

    // Verify social channel options are rendered
    expect(screen.getByTestId('popup-channel-whatsapp')).toBeInTheDocument();
    expect(screen.getByTestId('popup-channel-telegram')).toBeInTheDocument();
    expect(screen.getByTestId('popup-channel-instagram')).toBeInTheDocument();
    expect(screen.getByTestId('popup-channel-youtube')).toBeInTheDocument();
  });

  it('does NOT open popup if user has already seen it today', () => {
    const todayKey = getTodayDateKey();
    localStorage.setItem(`bw_community_popup_${mockUser.id}`, todayKey);

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('community-daily-popup')).not.toBeInTheDocument();
  });

  it('allows user to close the popup via close X button', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    const popup = await screen.findByTestId('community-daily-popup');
    expect(popup).toBeInTheDocument();

    const closeBtn = screen.getByTestId('community-popup-close-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('community-daily-popup')).not.toBeInTheDocument();
  });

  it('allows user to close the popup via dismiss "Maybe Later" button', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    const popup = await screen.findByTestId('community-daily-popup');
    expect(popup).toBeInTheDocument();

    const dismissBtn = screen.getByTestId('popup-dismiss-btn');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('community-daily-popup')).not.toBeInTheDocument();
  });

  it('navigates to /community when clicking "View Community Page" button and closes popup', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    const popup = await screen.findByTestId('community-daily-popup');
    expect(popup).toBeInTheDocument();

    const viewCommunityBtn = screen.getByTestId('popup-view-community-page-btn');
    fireEvent.click(viewCommunityBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/community');
    expect(screen.queryByTestId('community-daily-popup')).not.toBeInTheDocument();
  });

  it('opens social channel link in new tab when clicking join/follow button', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
    } as any);

    render(
      <MemoryRouter>
        <CommunityDailyPopup />
      </MemoryRouter>
    );

    await screen.findByTestId('community-daily-popup');

    const whatsappBtn = await screen.findByTestId('popup-join-whatsapp-btn');
    fireEvent.click(whatsappBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://chat.whatsapp.com/test-community',
      '_blank',
      'noopener,noreferrer'
    );

    const telegramBtn = screen.getByTestId('popup-join-telegram-btn');
    fireEvent.click(telegramBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://t.me/test-booyahwin',
      '_blank',
      'noopener,noreferrer'
    );

    const instagramBtn = screen.getByTestId('popup-join-instagram-btn');
    fireEvent.click(instagramBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://instagram.com/test-booyahwin',
      '_blank',
      'noopener,noreferrer'
    );

    const youtubeBtn = screen.getByTestId('popup-join-youtube-btn');
    fireEvent.click(youtubeBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://youtube.com/@test-booyahwin',
      '_blank',
      'noopener,noreferrer'
    );
  });
});

