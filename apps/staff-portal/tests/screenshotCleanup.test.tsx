import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffAuthProvider } from '../src/context/StaffAuthContext.js';
import { AddResult } from '../src/pages/AddResult.js';
import * as matchesApi from '../src/api/matches.js';
import * as staffApi from '../src/api/staff.js';
import { STAFF_TOKEN_STORAGE_KEY } from '../src/api/client.js';
import { staffMeGuard, matchDetailResponseGuard } from '../src/api/guards.js';
import { loadContractFixture } from './contractFixtures.js';

describe('Phase 5 Proof: Screenshot File Cleanup and Object URL Revocation on Unmount', () => {
  let queryClient: QueryClient;
  let createObjectURLSpy: any;
  let revokeObjectURLSpy: any;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, 'valid-token');
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    createObjectURLSpy = vi.fn().mockImplementation((file: File) => `blob:http://localhost/${file.name}`);
    revokeObjectURLSpy = vi.fn().mockImplementation(() => {});

    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    vi.spyOn(staffApi, 'getStaffMe').mockResolvedValue(
      loadContractFixture('GET_staff_me.json', staffMeGuard, 'GET /staff/me')
    );

    vi.spyOn(matchesApi, 'getStaffMatchDetail').mockResolvedValue(
      loadContractFixture('GET_staff_matches_id__solo.json', matchDetailResponseGuard, 'GET /staff/matches/:id', (d) => {
        d.match.id = 'match-res-1';
        d.match.status = 'live';
      })
    );
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('revokes previous object URL when a new file is uploaded and on component unmount', async () => {
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/matches/match-res-1/result']}>
          <StaffAuthProvider>
            <Routes>
              <Route path="/matches/:id/result" element={<AddResult />} />
            </Routes>
          </StaffAuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for form to load
    await screen.findByText(/Official Scoreboard Screenshot/i);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file1 = new File(['dummy content 1'], 'screenshot1.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file1] } });

    expect(createObjectURLSpy).toHaveBeenCalledWith(file1);
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();

    // Select a second file
    const file2 = new File(['dummy content 2'], 'screenshot2.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file2] } });

    expect(createObjectURLSpy).toHaveBeenCalledWith(file2);
    // Previous blob URL should be revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/screenshot1.png');

    // Unmount component
    unmount();

    // The active blob URL should be revoked on unmount
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/screenshot2.png');
  });
});
