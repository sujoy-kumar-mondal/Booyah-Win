import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { SessionReplacedModal } from '../src/components/common/SessionReplacedModal.js';

// Component inside #root to test background interactivity
const DummyAppBackground: React.FC = () => {
  const { handleSessionTerminated } = useAuth();
  return (
    <div data-testid="background-container">
      <button
        type="button"
        data-testid="bg-button"
        onClick={() => {}}
      >
        Background Action
      </button>
      <button
        type="button"
        data-testid="trigger-session-ended-btn"
        onClick={() => handleSessionTerminated('Session ended test', 'Replaced')}
      >
        Trigger Session Expired
      </button>
    </div>
  );
};

describe('Requirement 4: Session Dialog Portal Container & Inert Background', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = `
      <div id="root"></div>
      <div id="modal-root"></div>
    `;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders modal in #modal-root sibling, applies inert to #root, keeps modal button clickable', async () => {
    const rootEl = document.getElementById('root')!;
    const modalRootEl = document.getElementById('modal-root')!;

    expect(rootEl.hasAttribute('inert')).toBe(false);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <SessionReplacedModal />
            <DummyAppBackground />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
      { container: rootEl }
    );

    // Initial state: not open, root is NOT inert
    expect(rootEl.hasAttribute('inert')).toBe(false);

    // Trigger session termination
    const triggerBtn = screen.getByTestId('trigger-session-ended-btn');
    act(() => {
      fireEvent.click(triggerBtn);
    });

    // 1. Root element MUST now have inert attribute
    expect(rootEl.hasAttribute('inert')).toBe(true);

    // 2. Modal content MUST be rendered inside modalRootEl (#modal-root), NOT rootEl (#root)
    const modal = screen.getByTestId('session-replaced-modal');
    expect(modalRootEl.contains(modal)).toBe(true);
    expect(rootEl.contains(modal)).toBe(false);

    // 3. Modal's dismiss button is NOT inert and is clickable
    const dismissBtn = screen.getByTestId('session-dialog-dismiss-btn');
    expect(dismissBtn).toBeInTheDocument();
    expect(dismissBtn.closest('[inert]')).toBeNull();

    // Click dismiss button
    act(() => {
      fireEvent.click(dismissBtn);
    });

    // 4. Modal is closed, inert is removed from #root
    expect(rootEl.hasAttribute('inert')).toBe(false);
    expect(screen.queryByTestId('session-replaced-modal')).not.toBeInTheDocument();
  });
});
