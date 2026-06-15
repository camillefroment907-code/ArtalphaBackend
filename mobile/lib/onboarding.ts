// lib/onboarding.ts — Onboarding state persistence

import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPLETE_KEY = 'nautilus_onboarding_complete';
const DATA_KEY     = 'nautilus_onboarding_data';

export interface OnboardingData {
  profileType: 'collector' | 'advisor' | 'gallery' | 'investor' | '';
  goals:       string[];
  budget:      string;
  artists:     string[];
  categories:  string[];
  frequency:   string;
  completedAt: string;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(COMPLETE_KEY);
  return v === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(COMPLETE_KEY, 'true');
}

export async function saveOnboardingData(data: Partial<OnboardingData>): Promise<void> {
  const existing = await getOnboardingData();
  const merged = { ...existing, ...data };
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(merged));
}

export async function getOnboardingData(): Promise<Partial<OnboardingData>> {
  const raw = await AsyncStorage.getItem(DATA_KEY);
  return raw ? (JSON.parse(raw) as Partial<OnboardingData>) : {};
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.multiRemove([COMPLETE_KEY, DATA_KEY]);
}
