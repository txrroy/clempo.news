import { ScrollView, View } from 'react-native';
import type { ActivePolicyDoc } from '@/types/article';
import { V2Button, V2Divider, V2Text } from './primitives';
import { V2_COLORS, V2_SPACE } from './tokens';

interface HowItWorksV2Props {
  activePolicy: ActivePolicyDoc;
  enabledSourcesCount: number;
  onOpenSettings: () => void;
}

const STAGES = [
  {
    stage: '1. Scan and merge',
    owner: 'Feed collector',
    description:
      'Reads enabled RSS feeds, normalizes headlines, and merges duplicate coverage of the same event.',
  },
  {
    stage: '2. Filter and rank',
    owner: 'Story selector',
    description:
      'Drops previously covered URLs, enforces topic and region caps, and selects stories for the edition.',
  },
  {
    stage: '3. Scrape and draft',
    owner: 'Draft writer',
    description:
      'Extracts article text (falling back to the RSS snippet when blocked) and writes a child-safe summary.',
  },
  {
    stage: '4. Check facts',
    owner: 'Fact checker',
    description:
      'Verifies every claim against the source text, checks G-rated safety rules, and assigns Ready, Check, or Unverified.',
  },
  {
    stage: '5. Editor sign-off',
    owner: 'Human editor',
    description:
      'Editors review flagged or unverified drafts before publishing, or allow Ready stories to auto-publish.',
  },
] as const;

export function HowItWorksV2({
  activePolicy,
  enabledSourcesCount,
  onOpenSettings,
}: HowItWorksV2Props) {
  const { settings } = activePolicy;
  const autoPublishLabel = settings.auto_publish_ready ? 'On' : 'Off';

  return (
    <View style={{ gap: V2_SPACE.sectionGap }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: V2_SPACE.gapMd,
        }}
      >
        <View style={{ gap: 4 }}>
          <V2Text variant="pageTitle">How it works</V2Text>
          <V2Text variant="meta">
            Daily editorial pipeline from RSS ingestion to published edition.
          </V2Text>
        </View>

        <V2Button
          variant="primary"
          label="Edit policy settings"
          onPress={onOpenSettings}
        />
      </View>

      {/* 5-stage table */}
      <View>
        <V2Text
          variant="sectionTitle"
          style={{ paddingBottom: V2_SPACE.gapMd }}
        >
          Pipeline stages
        </V2Text>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ minWidth: 680, width: '100%' }}>
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: V2_SPACE.tableRowPadY,
                gap: V2_SPACE.gapLg,
                borderBottomWidth: 1,
                borderBottomColor: V2_COLORS.lineStrong,
              }}
            >
              <V2Text variant="meta" style={{ width: 180 }}>
                Stage
              </V2Text>
              <V2Text variant="meta" style={{ width: 150 }}>
                Role
              </V2Text>
              <V2Text variant="meta" style={{ flex: 1, minWidth: 300 }}>
                Behavior
              </V2Text>
            </View>

            {STAGES.map((item) => (
              <View key={item.stage}>
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: V2_SPACE.tableRowPadY,
                    gap: V2_SPACE.gapLg,
                  }}
                >
                  <V2Text
                    variant="body"
                    weight="500"
                    style={{ width: 180 }}
                  >
                    {item.stage}
                  </V2Text>
                  <V2Text
                    variant="body"
                    tone="muted"
                    style={{ width: 150 }}
                  >
                    {item.owner}
                  </V2Text>
                  <V2Text
                    variant="body"
                    style={{ flex: 1, minWidth: 300 }}
                  >
                    {item.description}
                  </V2Text>
                </View>
                <V2Divider />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Active policy summary */}
      <View>
        <V2Text
          variant="sectionTitle"
          style={{ paddingBottom: V2_SPACE.gapMd }}
        >
          Active editorial rules ({activePolicy.active_version})
        </V2Text>
        <V2Divider />
        {[
          ['Enabled RSS feeds', `${enabledSourcesCount} feeds`],
          ['Reading level', settings.reading_level],
          [
            'Target length',
            `${settings.target_headline_words} headline words, ${settings.target_summary_words} summary words`,
          ],
          ['Tone', settings.tone.replace(/_/g, ' ')],
          [
            'Edition caps',
            `${settings.max_per_topic} per topic, ${settings.max_per_region} per region, ${settings.max_market_stories} market`,
          ],
          ['Auto-publish Ready stories', autoPublishLabel],
        ].map(([label, value]) => (
          <View key={label}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                paddingVertical: V2_SPACE.listRowPadY,
                gap: V2_SPACE.gapMd,
              }}
            >
              <V2Text variant="body" tone="muted">
                {label}
              </V2Text>
              <V2Text variant="body" weight="500" tabular>
                {value}
              </V2Text>
            </View>
            <V2Divider />
          </View>
        ))}
      </View>
    </View>
  );
}
