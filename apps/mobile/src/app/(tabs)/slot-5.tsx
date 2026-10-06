import { SlotScreen } from '@/lib/navigation/SlotScreen';

/** A slot of the system's tab bar (ADR 0081); `lib/navigation/SlotScreen.tsx` says what it draws. */
export default function Slot() {
  return <SlotScreen route="slot-5" />;
}
