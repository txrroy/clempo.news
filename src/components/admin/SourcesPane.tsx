import { useState } from 'react';
import { Switch, View } from 'react-native';
import {
  DSBadge,
  DSButton,
  DSCard,
  DSInput,
  DSSectionHeader,
  DSTable,
  DSTableHeader,
  DSTableRow,
  DSText,
  useDSTheme,
} from '@/design-system';
import type { RssSourceConfig } from '@/types/article';

interface SourcesPaneProps {
  sources: RssSourceConfig[];
  userEmail: string;
  onToggleSource: (name: string, userEmail: string) => Promise<void>;
  onAddSource: (name: string, url: string, userEmail: string) => Promise<void>;
  onRemoveSource: (name: string, userEmail: string) => Promise<void>;
  onResetDefaults: (userEmail: string) => Promise<void>;
}

export function SourcesPane({
  sources,
  userEmail,
  onToggleSource,
  onAddSource,
  onRemoveSource,
  onResetDefaults,
}: SourcesPaneProps) {
  const { theme } = useDSTheme();
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enabledCount = sources.filter((s) => s.enabled).length;

  const handleAdd = async () => {
    setError(null);
    try {
      await onAddSource(newName, newUrl, userEmail);
      setNewName('');
      setNewUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    }
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <DSSectionHeader
        title="Source Management"
        subtitle={`${enabledCount} of ${sources.length} RSS feeds enabled · Changes apply on the next agent run.`}
        right={
          <DSButton
            label="Reset to Defaults"
            variant="secondary"
            size="sm"
            onPress={() => onResetDefaults(userEmail)}
          />
        }
      />
      {/* Add Custom Source */}
      <DSCard headerTitle="Add RSS Feed" padding="lg">
        <View
          style={{ gap: theme.spacing.sm }}
          className="flex-col md:flex-row"
        >
          <DSInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Source name (e.g. PBS NewsHour)"
            compact
            className="md:w-56"
          />
          <DSInput
            value={newUrl}
            onChangeText={setNewUrl}
            placeholder="https://example.com/rss.xml"
            autoCapitalize="none"
            compact
            style={{ flex: 1 }}
          />
          <DSButton
            label="Add Feed"
            variant="charcoal"
            size="md"
            onPress={handleAdd}
          />
        </View>
        {error ? (
          <DSText
            variant="caption"
            tone="danger"
            weight="medium"
            style={{ marginTop: theme.spacing.sm }}
          >
            {error}
          </DSText>
        ) : null}
      </DSCard>

      {/* Configured Feeds Table */}
      <DSTable>
        <DSTableHeader>
          <View style={{ flex: 1, minWidth: 0 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Configured Feeds ({enabledCount} active)
            </DSText>
          </View>
          <View style={{ width: 96 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Status
            </DSText>
          </View>
          <View style={{ width: 132, alignItems: 'flex-end' }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Controls
            </DSText>
          </View>
        </DSTableHeader>
        {sources.map((source, idx) => (
          <DSTableRow key={source.name} isLast={idx === sources.length - 1}>
            <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
              <DSText variant="body" weight="semibold" tone="primary">
                {source.name}
              </DSText>
              <DSText variant="caption" tone="tertiary" numberOfLines={1}>
                {source.url}
              </DSText>
            </View>

            <View style={{ width: 96 }}>
              <DSBadge
                label={source.enabled ? 'Enabled' : 'Paused'}
                tone={source.enabled ? 'success' : 'neutral'}
              />
            </View>

            <View
              style={{
                width: 132,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: theme.spacing.sm,
              }}
            >
              <Switch
                value={source.enabled}
                onValueChange={() => onToggleSource(source.name, userEmail)}
                trackColor={{
                  false: theme.colors.borderDefault,
                  true: theme.colors.accent,
                }}
              />
              <DSButton
                label="Remove"
                variant="ghost"
                size="sm"
                onPress={() => onRemoveSource(source.name, userEmail)}
              />
            </View>
          </DSTableRow>
        ))}
      </DSTable>
    </View>
  );
}
