// Component tests for PricingScreen
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

// Mock hooks
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: jest.fn(),
}));

import { useAuthStore } from '../../stores/authStore';
import { useSubscription } from '../../hooks/useSubscription';
import PricingScreen from '../../app/pricing/index';

const mockUseAuthStore = useAuthStore as jest.Mock;
const mockUseSubscription = useSubscription as jest.Mock;

describe('PricingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    mockUseSubscription.mockReturnValue({
      status: { plan: 'free', active: false, expires_at: null },
      paymentInfo: null,
      creatingPlan: null,
      verifying: false,
      subscribe: jest.fn(),
      verifyPayment: jest.fn(),
      clearPaymentInfo: jest.fn(),
      refreshStatus: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders header and plan cards', () => {
    render(<PricingScreen />);

    expect(screen.getByText('Choose Your Plan')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('Storyteller')).toBeTruthy();
    expect(screen.getByText('Creator')).toBeTruthy();
  });

  it('shows current plan badge when subscription is active', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'storyteller', active: true, expires_at: '2026-12-01T00:00:00Z' },
    });

    render(<PricingScreen />);

    expect(screen.getByText(/Your plan:/)).toBeTruthy();
    // The badge shows capitalized plan name — use getAllByText since it also appears in the plan card
    expect(screen.getAllByText('Storyteller').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to login when CTA pressed while not authenticated', () => {
    render(<PricingScreen />);

    // Default selected plan is Storyteller, so CTA says "Subscribe Now"
    const ctaButton = screen.getByText('Subscribe Now');
    fireEvent.press(ctaButton);

    expect(router.push).toHaveBeenCalledWith('/auth/login');
  });

  it('shows Subscribe Now for paid plan when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<PricingScreen />);

    expect(screen.getByText('Subscribe Now')).toBeTruthy();
  });

  it('shows Current Plan when on active paid plan', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'storyteller', active: true, expires_at: null },
    });

    render(<PricingScreen />);

    expect(screen.getByText('Current Plan')).toBeTruthy();
  });

  it('opens payment modal and calls subscribe for paid plan', async () => {
    const mockSubscribe = jest.fn(() => Promise.resolve());

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    mockUseSubscription.mockReturnValue({
      status: { plan: 'free', active: false, expires_at: null },
      paymentInfo: null,
      creatingPlan: null,
      verifying: false,
      subscribe: mockSubscribe,
      verifyPayment: jest.fn(),
      clearPaymentInfo: jest.fn(),
      refreshStatus: jest.fn(),
    });

    render(<PricingScreen />);

    const ctaButton = screen.getByText('Subscribe Now');
    fireEvent.press(ctaButton);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith('storyteller');
    });
  });

  it('shows payment info in modal after subscribing', async () => {
    const mockSubscribe = jest.fn(() => Promise.resolve());

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    mockUseSubscription.mockReturnValue({
      status: { plan: 'free', active: false, expires_at: null },
      paymentInfo: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: 2.99,
        currency: 'USDC',
        plan: 'storyteller',
        network: 'Base',
        note: 'Send exactly 2.99 USDC on Base',
      },
      creatingPlan: null,
      verifying: false,
      subscribe: mockSubscribe,
      verifyPayment: jest.fn(),
      clearPaymentInfo: jest.fn(),
      refreshStatus: jest.fn(),
    });

    render(<PricingScreen />);

    // Press CTA to open modal
    const ctaButton = screen.getByText('Subscribe Now');
    fireEvent.press(ctaButton);

    await waitFor(() => {
      expect(screen.getByText('Send exactly')).toBeTruthy();
      expect(screen.getByText('Complete Payment')).toBeTruthy();
      expect(screen.getByText('Payment Address')).toBeTruthy();
    });
  });

  it('copies address to clipboard when copy button pressed', async () => {
    const mockSubscribe = jest.fn(() => Promise.resolve());

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    mockUseSubscription.mockReturnValue({
      status: { plan: 'free', active: false, expires_at: null },
      paymentInfo: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: 2.99,
        currency: 'USDC',
        plan: 'storyteller',
        network: 'Base',
        note: 'Send exactly 2.99 USDC on Base',
      },
      creatingPlan: null,
      verifying: false,
      subscribe: mockSubscribe,
      verifyPayment: jest.fn(),
      clearPaymentInfo: jest.fn(),
      refreshStatus: jest.fn(),
    });

    render(<PricingScreen />);

    // Press CTA to open modal
    const ctaButton = screen.getByText('Subscribe Now');
    fireEvent.press(ctaButton);

    await waitFor(() => {
      const copyButton = screen.getByText('Copy Address');
      fireEvent.press(copyButton);
    });

    // Fast-forward the setTimeout in handleCopyAddress
    jest.advanceTimersByTime(2500);

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    });
  });

  it('calls verifyPayment when verify button pressed', async () => {
    const mockSubscribe = jest.fn(() => Promise.resolve());
    const mockVerify = jest.fn(() => Promise.resolve({ verified: true, message: 'Payment confirmed!' }));

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    mockUseSubscription.mockReturnValue({
      status: { plan: 'free', active: false, expires_at: null },
      paymentInfo: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: 2.99,
        currency: 'USDC',
        plan: 'storyteller',
        network: 'Base',
        note: 'Send exactly 2.99 USDC on Base',
      },
      creatingPlan: null,
      verifying: false,
      subscribe: mockSubscribe,
      verifyPayment: mockVerify,
      clearPaymentInfo: jest.fn(),
      refreshStatus: jest.fn(),
    });

    render(<PricingScreen />);

    // Press CTA to open modal
    const ctaButton = screen.getByText('Subscribe Now');
    fireEvent.press(ctaButton);

    await waitFor(() => {
      const verifyButton = screen.getByText("I've Sent the Payment");
      fireEvent.press(verifyButton);
    });

    // Fast-forward any timers from handleVerify
    jest.advanceTimersByTime(100);

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalled();
    });
  });

  it('routes to /record for free plan CTA', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      subscription: { plan: 'free', active: false, expires_at: null },
    });

    render(<PricingScreen />);

    // Select free plan (index 0)
    const freePlan = screen.getByText('Free');
    fireEvent.press(freePlan);

    const ctaButton = screen.getByText('Get Started Free');
    fireEvent.press(ctaButton);

    expect(router.push).toHaveBeenCalledWith('/record');
  });
});
