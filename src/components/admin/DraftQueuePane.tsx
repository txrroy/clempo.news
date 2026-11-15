import { ScrollView, View } from 'react-native';
import {
  DSBadge,
  DSCard,
  DSTable,
  DSTableHeader,
  DSTableRow,
  DSText,
  useDSTheme,
  type DSTone,
} from '@/design-system';
import type { Article } from '@/types/article';

interface DraftQueuePaneProps {
  drafts: Article[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface AccuracyGroup {
  label: string;
  items: Article[];
}

function getAccuracy(article: Article): number {
  return article.scores?.accuracy ?? article.confidence_score;
}

function groupByAccuracy(drafts: Article[]): AccuracyGroup[] {
  const low = drafts.filter((d) => getAccuracy(d) < 65);
  const medium = drafts.filter(
    (d) => getAccuracy(d) >= 65 && getAccuracy(d) < 85
  );
  const high = drafts.filter((d) => getAccuracy(d) >= 85);

  return [
    { label: 'Needs Review (Accuracy < 65)', items: low },
    { label: 'Medium Accuracy (65–84)', items: medium },
    { label: 'High Accuracy (85–100)', items: high },
  ].filter((group) => group.items.length > 0);
}

function getScoreTone(score: number): DSTone {
  if (score >= 85) return 'success';
  if (score >= 65) return 'warning';
  return 'danger';
}

export function DraftQueuePane({
  drafts,
  selectedId,
  onSelect,
}: DraftQueuePaneProps) {
  const { theme } = useDSTheme();
  const groups = groupByAccuracy(drafts);

  return (
    <DSCard
      headerTitle="Draft Queue"
      headerRight={<DSBadge label={`${drafts.length} pending`} tone="neutral" />}
      padding="md"
      className="w-full md:w-96"
      style={{ alignSelf: 'stretch' }}
    >
      <ScrollView className="max-h-72 md:max-h-none md:flex-1">
        {groups.length === 0 ? (
          <View style={{ padding: theme.spacing.xxl, alignItems: 'center' }}>
            <DSText variant="body" tone="secondary" center>
              No pending drafts in the queue.
            </DSText>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            {groups.map((group) => (
              <DSTable key={group.label}>
                <DSTableHeader>
                  <DSText variant="micro" weight="semibold" tone="tertiary">
                    {group.label}
                  </DSText>
                </DSTableHeader>
                {group.items.map((item, idx) => {
                  const isSelected = item.id === selectedId;
                  const accuracy = getAccuracy(item);
                  const scores = item.scores;
                  const flags = item.flags ?? [];

                  return (
                    <DSTableRow
                      key={item.id}
                      selected={isSelected}
                      isLast={idx === group.items.length - 1}
                      onPress={() => onSelect(item.id)}
                      style={{ flexDirection: 'column', alignItems: 'stretch', gap: theme.spacing.xs }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <DSText variant="caption" tone="tertiary" tabularNums>
                          {item.date}
                          {item.source_count ? ` · ${item.source_count} outlets` : ''}
                        </DSText>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.spacing.xs,
                          }}
                        >
                          {item.judge_pass !== undefined ? (
                            <DSBadge
                              label={item.judge_pass ? 'Pass' : 'Review'}
                              tone={item.judge_pass ? 'success' : 'warning'}
                            />
                          ) : null}
                          <DSBadge label={`Acc ${accuracy}`} tone={getScoreTone(accuracy)} />
                        </View>
                      </View>

                      <DSText variant="body" weight="semibold" tone="primary" numberOfLines={2}>
                        {item.ai_headline}
                      </DSText>

                      {scores ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: theme.spacing.xs,
                          }}
                        >
                          <DSBadge label={`Acc ${scores.accuracy}`} tone="neutral" />
                          <DSBadge label={`Neu ${scores.neutrality}`} tone="neutral" />
                          <DSBadge label={`Saf ${scores.safety}`} tone="neutral" />
                          <DSBadge label={`Read ${scores.readability}`} tone="neutral" />
                        </View>
                      ) : null}

                      {flags.length > 0 ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: theme.spacing.xs,
                          }}
                        >
                          {flags.map((flag) => (
                            <DSBadge key={flag} label={flag} tone="danger" />
                          ))}
                        </View>
                      ) : null}
                    </DSTableRow>
                  );
                })}
              </DSTable>
            ))}
          </View>
        )}
      </ScrollView>
    </DSCard>
  );
}
