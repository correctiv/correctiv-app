import { defineMessages, useIntl } from 'react-intl';
import { ScrollView, View } from 'react-native';

import { Badge, ScreenHeader, Typo } from '@/components/ui';
import { quarterlyReport } from '@correctiv/app-core/data/quartalsbericht';

/**
 * The screen's one word, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/backstage.ts` (ADR 0026 §6). The badge says `Club`,
 * which is a mark and carries no id. Everything else on the page is the report.
 */
const COPY = defineMessages({
  screenTitle: { id: 'backstage.reportTitle', defaultMessage: 'Quarterly report' },
});

/**
 * The quarterly report — transparency as club content, but without a barrier:
 * whoever opens the page sees it. The figures are sample data drawn from real
 * CORRECTIV transparency material (see data/quartalsbericht.ts).
 */
export default function BerichtScreen() {
  const intl = useIntl();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Badge label="Club" tone="club" />
        <Typo variant="headline-xl" className="mt-s">
          {quarterlyReport.quarter}
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
          {quarterlyReport.intro}
        </Typo>

        {quarterlyReport.sections.map((section) => (
          <View key={section.heading} className="mt-l">
            <Typo variant="headline-m">{section.heading}</Typo>
            <Typo variant="text-m" className="mt-2xs">
              {section.text}
            </Typo>
            {(section.figures ?? []).map((figure) => (
              <View key={figure.label} className="mt-s flex-row items-baseline">
                <Typo variant="headline-s" color="accent" style={{ minWidth: 64 }}>
                  {figure.value}
                </Typo>
                <Typo variant="text-s" color="on-canvas-muted" className="flex-1">
                  {figure.label}
                </Typo>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
