import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { ContentColumn } from './ContentColumn';
import { SafeAreaView } from './SafeAreaView';

export type ScreenProps = {
  children: ReactNode;
  /** Scrolling content (the default), or a fixed screen. */
  scroll?: boolean;
  /** Drop the default horizontal padding (px-m) — for edge-to-edge lists and heroes. */
  noPadding?: boolean;
  className?: string;
};

/** The screen scaffold: page surface, top safe area, optionally scrolling. */
export function Screen({ children, scroll = true, noPadding = false, className }: ScreenProps) {
  const pad = noPadding ? '' : 'px-m';
  if (scroll) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
        <ScrollView
          className="flex-1"
          contentContainerClassName={[pad, 'pt-m pb-2xl', className ?? ''].join(' ')}
          showsVerticalScrollIndicator={false}
        >
          <ContentColumn>{children}</ContentColumn>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <ContentColumn className={['flex-1', pad, className ?? ''].join(' ')}>
        {children}
      </ContentColumn>
    </SafeAreaView>
  );
}
