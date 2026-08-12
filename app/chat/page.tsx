'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SuzyChatWindow from '../../components/chat/SuzyChatWindow';
import HomeScreenGuide from '../../components/home-screen/HomeScreenGuide';

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has seen onboarding
    const onboardingComplete = localStorage.getItem('coachcass_onboarding_complete');
    if (!onboardingComplete) {
      router.push('/onboarding');
    }
  }, [router]);

  return (
    <>
      <HomeScreenGuide />
      <SuzyChatWindow />
    </>
  );
}
