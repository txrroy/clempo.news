import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { getApiBaseUrl } from '@/config/appConfig';
import {
  V3Badge,
  V3Button,
  V3Card,
  V3Input,
  V3Rule,
  V3Tabs,
  V3Text,
} from './primitives';
import { V3_COLORS, V3_SPACE } from './tokens';

interface NewsCollectorDrawerV3Props {
  visible: boolean;
  getIdToken: () => Promise<string>;
  onClose: () => void;
  onOpenArticle: (id: string) => void;
}

type CollectorMode = 'single-url' | 'edition';

interface ClaimEvent {
  claim: string;
  evidence: string;
  supported: boolean;
  isRetry?: boolean;
}

interface StageState {
  status: 'idle' | 'running' | 'retry' | 'done' | 'error';
  message: string;
}

export function NewsCollectorDrawerV3({
  visible,
  getIdToken,
  onClose,
  onOpenArticle,
}: NewsCollectorDrawerV3Props) {
  const [mode, setMode] = useState<CollectorMode>('edition');
  const [urlInput, setUrlInput] = useState('');
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [agent1, setAgent1] = useState<StageState>({
    status: 'idle',
    message: 'Waiting to scan feeds or URL...',
  });
  const [agent2, setAgent2] = useState<StageState>({
    status: 'idle',
    message: 'Waiting for Agent 1 handoff...',
  });
  const [agent3, setAgent3] = useState<StageState>({
    status: 'idle',
    message: 'Waiting for Agent 2 draft...',
  });

  const [draftPreview, setDraftPreview] = useState<{
    headline: string;
    summary: string;
  } | null>(null);
  const [claims, setClaims] = useState<ClaimEvent[]>([]);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [finalScores, setFinalScores] = useState<{
    pass: boolean;
    accuracy: number;
    neutrality: number;
    safety: number;
    readability: number;
  } | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  if (!visible) return null;

  const handleClose = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  };

  const resetState = () => {
    setErrorMsg(null);
    setDraftPreview(null);
    setClaims([]);
    setRetryNote(null);
    setFinalScores(null);
    setSavedIds([]);
    setAgent1({ status: 'idle', message: 'Initializing...' });
    setAgent2({ status: 'idle', message: 'Waiting for Agent 1 handoff...' });
    setAgent3({ status: 'idle', message: 'Waiting for Agent 2 draft...' });
  };

  const handleRun = async () => {
    if (mode === 'single-url' && !urlInput.trim()) {
      setErrorMsg('Please enter an article URL to collect.');
      return;
    }

    resetState();
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getIdToken();
      const response = await fetch(`${getApiBaseUrl()}/api/pipeline-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode,
          url: mode === 'single-url' ? urlInput.trim() : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `Collection failed (${response.status})`);
      }

      if (typeof response.body.getReader !== 'function') {
        throw new Error('Streaming is not supported in this runtime.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const chunk of lines) {
          const dataLine = chunk
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (evt.type === 'agent1_start' || evt.type === 'agent1_progress') {
            setAgent1({
              status: 'running',
              message: String(evt.message || 'Scanning...'),
            });
          } else if (evt.type === 'agent1_done') {
            const stories = (evt.stories as { title: string }[]) || [];
            setAgent1({
              status: 'done',
              message: `Picked ${evt.count} story/stories: ${stories.map((s) => s.title).join(' · ')}`,
            });
          } else if (evt.type === 'agent2_start') {
            setAgent2({
              status: 'running',
              message: String(evt.message || 'Drafting summary...'),
            });
          } else if (evt.type === 'agent2_done') {
            setAgent2({
              status: 'done',
              message: evt.isRetry
                ? 'Self-corrected draft generated from Judge critique.'
                : 'Drafted Grade-6 summary.',
            });
            setDraftPreview({
              headline: String(evt.headline || ''),
              summary: String(evt.summary || ''),
            });
          } else if (evt.type === 'agent3_start') {
            setAgent3({
              status: 'running',
              message: String(evt.message || 'Auditing claims...'),
            });
          } else if (evt.type === 'agent3_claim') {
            setClaims((prev) => [
              ...prev,
              {
                claim: String(evt.claim || ''),
                evidence: String(evt.evidence || ''),
                supported: Boolean(evt.supported),
                isRetry: Boolean(evt.isRetry),
              },
            ]);
          } else if (evt.type === 'agent3_retry') {
            setAgent3({
              status: 'retry',
              message: String(evt.message || 'Sending critique back to Agent 2...'),
            });
            setAgent2({
              status: 'running',
              message: 'Re-drafting based on Judge critique...',
            });
            setRetryNote(String(evt.reason || ''));
          } else if (evt.type === 'agent3_done') {
            const scores = evt.scores as {
              accuracy: number;
              neutrality: number;
              safety: number;
              readability: number;
            };
            setAgent3({
              status: 'done',
              message: String(evt.reasoning || 'Verification complete.'),
            });
            setFinalScores({
              pass: Boolean(evt.pass),
              ...scores,
            });
          } else if (evt.type === 'complete') {
            setSavedIds((evt.savedIds as string[]) || []);
          } else if (evt.type === 'error') {
            setErrorMsg(String(evt.message || 'Collection error'));
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to stream collection'
        );
      }
    } finally {
      setRunning(false);
    }
  };

  const getStageBadge = (status: StageState['status']) => {
    if (status === 'running') return { label: 'RUNNING', tone: 'pending' as const };
    if (status === 'retry') return { label: 'SELF-CORRECTING', tone: 'pending' as const };
    if (status === 'done') return { label: 'COMPLETE', tone: 'approved' as const };
    if (status === 'error') return { label: 'ERROR', tone: 'rejected' as const };
    return { label: 'IDLE', tone: 'neutral' as const };
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        backgroundColor: V3_COLORS.canvas,
        flexDirection: 'column',
      }}
    >
      {/* Top Bar */}
      <View
        style={{
          backgroundColor: V3_COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: V3_COLORS.border,
          paddingHorizontal: V3_SPACE.xxl,
          paddingVertical: V3_SPACE.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: V3_SPACE.md,
        }}
      >
        <View style={{ gap: 2 }}>
          <V3Text role="kicker" tone="green">
            NEWS COLLECTION
          </V3Text>
          <V3Text role="section">Live Multi-Agent Collection</V3Text>
        </View>
        <V3Button
          label="Close"
          variant="outline"
          size="sm"
          onPress={handleClose}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          maxWidth: 1080,
          width: '100%',
          alignSelf: 'center',
          padding: V3_SPACE.xxl,
          gap: V3_SPACE.xl,
        }}
      >
        {/* Mode & Launch Controls */}
        <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <V3Tabs
              options={[
                { id: 'edition', label: "Today's Edition" },
                { id: 'single-url', label: 'Single URL' },
              ]}
              value={mode}
              onChange={setMode}
            />

            <V3Button
              label={running ? 'Collecting...' : 'Start Collecting'}
              variant="primary"
              disabled={running}
              onPress={() => void handleRun()}
            />
          </View>

          {mode === 'single-url' ? (
            <V3Input
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://www.reuters.com/world/..."
              autoCapitalize="none"
            />
          ) : null}

          {errorMsg ? (
            <V3Text role="body" tone="red">
              {errorMsg}
            </V3Text>
          ) : null}
        </V3Card>

        {/* Agent 1 */}
        <V3Card variant="outlined" style={{ gap: V3_SPACE.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.sm,
            }}
          >
            <V3Text role="headline">Agent 1 · Collector &amp; Selector</V3Text>
            <V3Badge {...getStageBadge(agent1.status)} />
          </View>
          <V3Text role="body" tone="muted">
            {agent1.message}
          </V3Text>
        </V3Card>

        {/* Agent 2 */}
        <V3Card variant="outlined" style={{ gap: V3_SPACE.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.sm,
            }}
          >
            <V3Text role="headline">Agent 2 · Editorial Summarizer</V3Text>
            <V3Badge {...getStageBadge(agent2.status)} />
          </View>
          <V3Text role="body" tone="muted">
            {agent2.message}
          </V3Text>

          {draftPreview ? (
            <View style={{ gap: V3_SPACE.xs, paddingTop: V3_SPACE.xs }}>
              <V3Rule />
              <V3Text role="headline">{draftPreview.headline}</V3Text>
              <V3Text role="body">{draftPreview.summary}</V3Text>
            </View>
          ) : null}
        </V3Card>

        {retryNote ? (
          <V3Card
            variant="filled"
            style={{ backgroundColor: V3_COLORS.orangeSoft, gap: V3_SPACE.xs }}
          >
            <V3Badge label="AUTO-CORRECTION" tone="pending" />
            <V3Text role="body">{retryNote}</V3Text>
          </V3Card>
        ) : null}

        {/* Agent 3 */}
        <V3Card variant="outlined" style={{ gap: V3_SPACE.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.sm,
            }}
          >
            <V3Text role="headline">Agent 3 · Quality Judge</V3Text>
            <V3Badge {...getStageBadge(agent3.status)} />
          </View>
          <V3Text role="body" tone="muted">
            {agent3.message}
          </V3Text>

          {claims.length > 0 ? (
            <View style={{ gap: V3_SPACE.xs, paddingTop: V3_SPACE.xs }}>
              <V3Rule />
              {claims.map((c, idx) => (
                <View
                  key={`${idx}-${c.claim.slice(0, 12)}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: V3_SPACE.sm,
                    paddingVertical: V3_SPACE.xs,
                  }}
                >
                  <V3Text role="body" style={{ flex: 1 }}>
                    {c.claim}
                  </V3Text>
                  <V3Badge
                    label={c.supported ? 'GROUNDED' : 'UNSUPPORTED'}
                    tone={c.supported ? 'approved' : 'rejected'}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {finalScores ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: V3_SPACE.sm,
                paddingTop: V3_SPACE.xs,
              }}
            >
              <V3Badge
                label={finalScores.pass ? 'AUTO-PASS' : 'NEEDS CHECK'}
                tone={finalScores.pass ? 'approved' : 'pending'}
              />
              <V3Badge label={`ACC ${finalScores.accuracy}`} tone="neutral" />
              <V3Badge label={`SAF ${finalScores.safety}`} tone="neutral" />
              <V3Badge label={`READ ${finalScores.readability}`} tone="neutral" />
            </View>
          ) : null}
        </V3Card>

        {savedIds.length > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <V3Button
              label="Open Saved Story"
              variant="primary"
              onPress={() => {
                handleClose();
                onOpenArticle(savedIds[0]);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

