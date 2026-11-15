import { useMemo } from 'react';
import { View } from 'react-native';
import {
  DSBadge,
  DSSectionHeader,
  DSStatTile,
  DSTable,
  DSTableHeader,
  DSTableRow,
  DSText,
  useDSTheme,
} from '@/design-system';
import type { Article } from '@/types/article';

interface AnalyticsPaneProps {
  articles: Article[];
}

interface VersionStats {
  version: string;
  total: number;
  published: number;
  rejected: number;
  pending: number;
  editedCount: number;
  regeneratedCount: number;
  avgAccuracy: number;
  avgSafety: number;
  approvalRate: number | null;
}

export function AnalyticsPane({ articles }: AnalyticsPaneProps) {
  const { theme } = useDSTheme();

  const stats = useMemo<VersionStats[]>(() => {
    const groups = new Map<string, Article[]>();
    for (const article of articles) {
      const ver =
        article.prompt_version ||
        article.instructions_snapshot?.prompt_version ||
        'unversioned';
      const list = groups.get(ver) ?? [];
      list.push(article);
      groups.set(ver, list);
    }

    return Array.from(groups.entries())
      .map(([version, items]) => {
        let published = 0;
        let rejected = 0;
        let pending = 0;
        let editedCount = 0;
        let regeneratedCount = 0;
        let accSum = 0;
        let safSum = 0;

        for (const a of items) {
          if (a.status === 'published') published += 1;
          else if (a.status === 'rejected') rejected += 1;
          else pending += 1;

          const history = a.decision_history ?? [];
          if (a.edited_at || history.some((h) => h.action === 'edited')) {
            editedCount += 1;
          }
          if (history.some((h) => h.action === 'regenerated')) {
            regeneratedCount += 1;
          }

          accSum += a.scores?.accuracy ?? a.confidence_score;
          safSum += a.scores?.safety ?? a.confidence_score;
        }

        const decided = published + rejected;
        const approvalRate =
          decided > 0 ? Math.round((published / decided) * 100) : null;

        return {
          version,
          total: items.length,
          published,
          rejected,
          pending,
          editedCount,
          regeneratedCount,
          avgAccuracy: Math.round(accSum / items.length),
          avgSafety: Math.round(safSum / items.length),
          approvalRate,
        };
      })
      .sort((a, b) => {
        if (a.version === 'unversioned') return 1;
        if (b.version === 'unversioned') return -1;
        return b.version.localeCompare(a.version);
      });
  }, [articles]);

  const totals = useMemo(() => {
    const pub = articles.filter((a) => a.status === 'published').length;
    const rej = articles.filter((a) => a.status === 'rejected').length;
    const decided = pub + rej;
    return {
      total: articles.length,
      published: pub,
      rejected: rej,
      pending: articles.length - decided,
      overallRate: decided > 0 ? Math.round((pub / decided) * 100) : null,
    };
  }, [articles]);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <DSSectionHeader
        title="Approval Rate by Prompt Version"
        subtitle="Human editor decisions become evaluation metrics for each policy version."
      />
      {/* Top KPI Tiles */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>
        <DSStatTile
          label="Overall Approval Rate"
          value={totals.overallRate !== null ? `${totals.overallRate}%` : '—'}
          hint="Across decided stories"
        />
        <DSStatTile
          label="Published"
          value={totals.published}
          right={<DSBadge label="Approved" tone="success" />}
        />
        <DSStatTile
          label="Pending"
          value={totals.pending}
          right={<DSBadge label="In Review" tone="warning" />}
        />
        <DSStatTile
          label="Rejected"
          value={totals.rejected}
          right={<DSBadge label="Rejected" tone="danger" />}
        />
        <DSStatTile
          label="Total Audited"
          value={totals.total}
          hint="All prompt versions"
        />
      </View>

      {/* Version Breakdown Table */}
      <DSTable>
        <DSTableHeader>
          <View style={{ flex: 1.4, minWidth: 160 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Policy Version
            </DSText>
          </View>
          <View style={{ flex: 2, minWidth: 200 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Approval Distribution
            </DSText>
          </View>
          <View style={{ width: 96 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Avg Accuracy
            </DSText>
          </View>
          <View style={{ width: 96 }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Avg Safety
            </DSText>
          </View>
          <View style={{ width: 120, alignItems: 'flex-end' }}>
            <DSText variant="micro" weight="semibold" tone="tertiary">
              Edited / Regen
            </DSText>
          </View>
        </DSTableHeader>

        {stats.length === 0 ? (
          <View style={{ padding: theme.spacing.xxl, alignItems: 'center' }}>
            <DSText variant="caption" tone="tertiary">
              No articles available yet to compute approval rates.
            </DSText>
          </View>
        ) : (
          stats.map((row, idx) => {
            const rate = row.approvalRate ?? 0;
            return (
              <DSTableRow key={row.version} isLast={idx === stats.length - 1}>
                <View style={{ flex: 1.4, minWidth: 160, gap: theme.spacing.xxs }}>
                  <DSText variant="body" weight="semibold" tone="primary">
                    {row.version}
                  </DSText>
                  <DSText variant="caption" tone="tertiary" tabularNums>
                    {row.total} total · {row.published} approved · {row.rejected} rejected · {row.pending} pending
                  </DSText>
                </View>

                <View style={{ flex: 2, minWidth: 200, gap: theme.spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: theme.radii.pill,
                        backgroundColor: theme.colors.surfaceMuted,
                        overflow: 'hidden',
                        marginRight: theme.spacing.md,
                      }}
                    >
                      <View
                        style={{
                          width: `${rate}%`,
                          height: '100%',
                          backgroundColor: theme.colors.accent,
                        }}
                      />
                    </View>
                    <DSText
                      variant="caption"
                      weight="semibold"
                      tone={row.approvalRate !== null ? 'primary' : 'tertiary'}
                      tabularNums
                    >
                      {row.approvalRate !== null ? `${row.approvalRate}%` : '—'}
                    </DSText>
                  </View>
                </View>

                <View style={{ width: 96 }}>
                  <DSText variant="body" weight="semibold" tone="primary" tabularNums>
                    {row.avgAccuracy}/100
                  </DSText>
                </View>

                <View style={{ width: 96 }}>
                  <DSText variant="body" weight="semibold" tone="primary" tabularNums>
                    {row.avgSafety}/100
                  </DSText>
                </View>

                <View style={{ width: 120, alignItems: 'flex-end' }}>
                  <DSText variant="caption" tone="secondary" tabularNums>
                    {row.editedCount} / {row.regeneratedCount}
                  </DSText>
                </View>
              </DSTableRow>
            );
          })
        )}
      </DSTable>
    </View>
  );
}
