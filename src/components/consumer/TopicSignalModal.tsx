import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { TopicSignalExplanation } from '@/lib/topicPreferences';

interface TopicSignalModalProps {
  topic: string | null;
  explanation: TopicSignalExplanation | null;
  onClose: () => void;
  onResetToNormal: (topic: string) => void;
  onTurnOffCompletely: (topic: string) => void;
}

export function TopicSignalModal({
  topic,
  explanation,
  onClose,
  onResetToNormal,
  onTurnOffCompletely,
}: TopicSignalModalProps) {
  const { height: windowHeight } = useWindowDimensions();

  if (!topic || !explanation) return null;

  const minModalHeight = Math.min(280, Math.round(windowHeight * 0.45));

  return (
    <Modal
      visible={Boolean(topic)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(10, 12, 18, 0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            width: '100%',
            maxWidth: 340,
            minHeight: minModalHeight,
            maxHeight: '85%',
            borderRadius: 22,
            backgroundColor: '#1E2430',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            paddingHorizontal: 22,
            paddingVertical: 24,
            gap: 16,
            ...(Platform.OS === 'web'
              ? ({
                  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
                } as Record<string, unknown>)
              : {}),
          }}
        >
          {/* Top bar with topic title and top-right close cross */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '700',
                lineHeight: 24,
                color: '#FAF9F6',
              }}
            >
              {topic} News
            </Text>

            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={10}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: 'rgba(250, 249, 246, 0.78)',
                  lineHeight: 16,
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Vertically centered body copy and left-aligned auto-width actions */}
          <ScrollView
            style={{ flexGrow: 1, flexShrink: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              gap: 18,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  lineHeight: 22,
                  color: '#FAF9F6',
                }}
              >
                {explanation.headline}
              </Text>

              <Text
                style={{
                  fontSize: 14.5,
                  lineHeight: 21,
                  color: 'rgba(250, 249, 246, 0.78)',
                }}
              >
                {explanation.description}
              </Text>
            </View>

            {/* Actions */}
            <View style={{ gap: 10, alignItems: 'flex-start' }}>
              {explanation.canReset ? (
                <Pressable
                  onPress={() => {
                    onResetToNormal(topic);
                    onClose();
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    backgroundColor: '#FAF9F6',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '700',
                      color: '#141821',
                      textAlign: 'center',
                    }}
                  >
                    Reset to normal
                  </Text>
                </Pressable>
              ) : null}

              {!explanation.isMuted ? (
                <Pressable
                  onPress={() => {
                    onTurnOffCompletely(topic);
                    onClose();
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    backgroundColor: 'rgba(248, 113, 113, 0.14)',
                    borderWidth: 1,
                    borderColor: 'rgba(248, 113, 113, 0.35)',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: '600',
                      color: '#FCA5A5',
                      textAlign: 'center',
                    }}
                  >
                    Hide all {topic} News
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
