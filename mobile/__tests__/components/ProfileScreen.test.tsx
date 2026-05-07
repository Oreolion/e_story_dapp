// Component tests for ProfileScreen
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

// Mock hooks
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

import { useAuthStore } from '../../stores/authStore';
import ProfileScreen from '../../app/(tabs)/profile';

const mockUseAuthStore = useAuthStore as jest.Mock;

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows sign-in prompt when not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    expect(screen.getByText('Sign in to view profile')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('shows user name and info when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: 'alice',
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: 'Storyteller and poet',
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    // Name is rendered via GradientText which contains Text
    expect(screen.getByText('Alice Writer')).toBeTruthy();
    expect(screen.getByText('@alice')).toBeTruthy();
    expect(screen.getByText('Storyteller and poet')).toBeTruthy();
  });

  it('shows subscription section with free plan', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    expect(screen.getByText('Subscription')).toBeTruthy();
    // Free plan shows "Free Plan" (capitalized)
    expect(screen.getByText('Free Plan')).toBeTruthy();
    expect(screen.getByText('Upgrade for premium features')).toBeTruthy();
  });

  it('shows Crown badge and active plan when subscribed', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'creator',
        subscription_expires_at: '2026-12-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'creator', active: true, expires_at: '2026-12-01T00:00:00Z' },
    });

    render(<ProfileScreen />);

    // Crown badge and subscription section both show "creator Plan"
    expect(screen.getAllByText(/creator Plan/i).length).toBeGreaterThanOrEqual(2);
  });

  it('navigates to pricing when subscription row pressed', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    // Find the subscription row and press it
    const subscriptionRow = screen.getByText('Free Plan');
    fireEvent.press(subscriptionRow);

    expect(router.push).toHaveBeenCalledWith('/pricing');
  });

  it('calls logout and navigates home on sign out', async () => {
    const mockLogout = jest.fn(() => Promise.resolve());

    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: mockLogout,
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    const signOutButton = screen.getByText('Sign Out');
    fireEvent.press(signOutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('shows delete account button', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  it('shows connected accounts section with wallet and email', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-123',
        name: 'Alice Writer',
        username: null,
        avatar: null,
        wallet_address: null,
        email: 'alice@example.com',
        bio: null,
        badges: null,
        google_id: null,
        subscription_plan: 'free',
        subscription_expires_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      logout: jest.fn(),
      deleteAccount: jest.fn(),
      updateProfile: jest.fn(),
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<ProfileScreen />);

    expect(screen.getByText('Connected Accounts')).toBeTruthy();
    expect(screen.getByText('Wallet')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  });
});
