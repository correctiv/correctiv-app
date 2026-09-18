import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { ScrollView, View } from 'react-native';

import { Button, Hairline, ScreenHeader, Typo } from '@/components/ui';
import { atlasStats, demolitionEntries } from '@correctiv/app-core/data/abriss-atlas';
import { openExternal } from '@/lib/openExternal';
import { useColors } from '@/lib/theme';

/**
 * Everything a person reads on this screen, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/atlas.ts`.
 *
 * The screen's own name is not among them, and it is written out twice below
 * rather than lifted: Abriss-Atlas is the project's name, the same word in every
 * language, so it is a mark and not a message — the exception
 * `gate/LoginGate.tsx` makes for the wordmark.
 *
 * `stats` counts two things at once, so it nests two ICU plurals: a single city or
 * a single report is reachable data and would otherwise read as a plural.
 */
const COPY = defineMessages({
  mapPlaceholder: { id: 'atlas.mapPlaceholder', defaultMessage: 'Map detail (static)' },
  stats: {
    id: 'atlas.stats',
    defaultMessage:
      '{reports, plural, one {One reported demolition} other {# reported demolitions}} in {cities, plural, one {one city} other {# cities}} (DE/CH)',
    description:
      'The figure line UNDER the map on the Abriss-Atlas screen. {reports} counts reported demolitions, {cities} the cities they come from. DE/CH is Germany and Switzerland and stays as it is.',
  },
  recentHeading: { id: 'atlas.recentHeading', defaultMessage: 'Most recently reported' },
  report: { id: 'atlas.report', defaultMessage: 'Report a demolition on abriss-atlas.de' },
});

/**
 * The demolition atlas — deliberately no more than a gesture in the concept: no
 * API, no map, a static crop plus the latest reports. Reporting happens on
 * abriss-atlas.de, and the button says so.
 */
export default function AtlasScreen() {
  const intl = useIntl();
  const colors = useColors();
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Abriss-Atlas" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">Abriss-Atlas</Typo>

        {/* A placeholder rather than a map. A real one would be another native
            module for a feature the concept does not ask for. */}
        <View
          className="mt-s items-center justify-center rounded-md bg-surface"
          style={{ height: 130 }}
        >
          <Ionicons name="location-outline" size={28} color={colors['grey-500']} />
          <Typo variant="text-s" color="grey-500" className="mt-2xs">
            {intl.formatMessage(COPY.mapPlaceholder)}
          </Typo>
        </View>

        <Typo variant="text-m" className="mt-s">
          {intl.formatMessage(COPY.stats, {
            reports: atlasStats.totalReports,
            cities: atlasStats.citiesCovered,
          })}
        </Typo>

        <Typo variant="headline-xs" className="mt-m">
          {intl.formatMessage(COPY.recentHeading)}
        </Typo>
        <View className="mt-2xs">
          {demolitionEntries.map((entry) => (
            <View key={entry.id}>
              <View className="flex-row items-center py-s">
                <Ionicons name="location-outline" size={18} color={colors['grey-500']} />
                <View className="ml-s flex-1">
                  <Typo variant="text-m">{entry.building}</Typo>
                  <Typo variant="text-s" color="grey-500" className="mt-4xs">
                    {entry.place} · {entry.year}
                  </Typo>
                </View>
                <Typo variant="text-s" color="grey-500">
                  {entry.status}
                </Typo>
              </View>
              <Hairline />
            </View>
          ))}
        </View>

        <Button
          title={intl.formatMessage(COPY.report)}
          className="mt-m"
          fullWidth
          onPress={() => openExternal(atlasStats.url)}
        />
      </ScrollView>
    </View>
  );
}
