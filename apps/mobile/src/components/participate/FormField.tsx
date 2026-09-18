import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, TextInput, View } from 'react-native';

import { Typo } from '@/components/ui';
import type { CalloutComponent } from '@correctiv/app-core/data/callouts';
import { typography, useColors } from '@/lib/theme';

/**
 * The three words a field says for itself, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/form.ts`. Everything else on a field — its label, its
 * description, its options — comes from the callout's schema and is content.
 */
const COPY = defineMessages({
  answerPlaceholder: { id: 'form.answerPlaceholder', defaultMessage: 'Your answer …' },
  fileAttached: {
    id: 'form.fileAttached',
    defaultMessage: '{file} attached ✓',
    description:
      "The file picker's own label in the participation form once something is attached, replacing `form.filePick` in the same control. {file} is the file's name. The tick is part of the message.",
  },
  filePick: { id: 'form.filePick', defaultMessage: 'Choose a photo or document (simulated)' },
});

/**
 * The file the dummy picker pretends to have taken. Data, not vocabulary: it is a
 * filename, the same in every language, and only the word around it is a message.
 */
const FAKE_FILE = 'foto_2026-06-12.jpg';

/**
 * One field of a callout form. The schema arrives from the core in Beabee/Formio
 * shape (`slides[].components[]`), so that a later phase only has to swap the data
 * layer — this component is the translation of one `component` into controls.
 *
 * `file` is a deliberate dummy. The app uploads nothing and does not pretend to. A
 * real picker (expo-image-picker) would be another native module for a flow that goes
 * nowhere without a backend.
 */
export function FormField({
  component,
  choice,
  text,
  fileAttached,
  onSelect,
  onText,
  onToggleFile,
}: {
  component: CalloutComponent;
  choice: string[];
  text: string;
  fileAttached: boolean;
  onSelect: (value: string) => void;
  onText: (value: string) => void;
  onToggleFile: () => void;
}) {
  const intl = useIntl();
  const colors = useColors();
  return (
    <View className="mt-m">
      <Typo variant="headline-xs">{component.label}</Typo>
      {component.description ? (
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {component.description}
        </Typo>
      ) : null}

      {(component.type === 'radio' || component.type === 'selectboxes') && (
        <View className="mt-s">
          {(component.values ?? []).map((value) => {
            const selected = choice.includes(value.value);
            return (
              <Pressable
                key={value.value}
                accessibilityRole={component.type === 'radio' ? 'radio' : 'checkbox'}
                accessibilityState={{ checked: selected }}
                accessibilityLabel={value.label}
                onPress={() => onSelect(value.value)}
                className={[
                  'mb-2xs flex-row items-center rounded-md border px-s py-s active:opacity-80',
                  selected ? 'border-accent bg-surface' : 'border-stroke bg-canvas',
                ].join(' ')}
              >
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selected ? colors.accent : colors['stroke']}
                />
                <Typo variant="text-m" className="ml-s flex-1">
                  {value.label}
                </Typo>
              </Pressable>
            );
          })}
        </View>
      )}

      {(component.type === 'textarea' || component.type === 'textfield') && (
        <TextInput
          value={text}
          onChangeText={onText}
          placeholder={component.placeholder ?? intl.formatMessage(COPY.answerPlaceholder)}
          placeholderTextColor={colors['grey-500']}
          accessibilityLabel={component.label}
          multiline={component.type === 'textarea'}
          className="mt-s rounded-md border border-stroke bg-canvas px-s py-s"
          style={[
            typography['text-m'],
            {
              color: colors['on-canvas'],
              minHeight: component.type === 'textarea' ? 96 : undefined,
              textAlignVertical: component.type === 'textarea' ? 'top' : 'center',
            },
          ]}
        />
      )}

      {component.type === 'file' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={component.label}
          onPress={onToggleFile}
          className="mt-s flex-row items-center rounded-md border border-stroke bg-surface px-s py-s active:opacity-80"
        >
          <Ionicons name="camera-outline" size={20} color={colors['on-canvas-muted']} />
          <Typo variant="text-s" color="on-canvas-muted" className="ml-s flex-1">
            {fileAttached
              ? intl.formatMessage(COPY.fileAttached, { file: FAKE_FILE })
              : intl.formatMessage(COPY.filePick)}
          </Typo>
        </Pressable>
      )}
    </View>
  );
}
