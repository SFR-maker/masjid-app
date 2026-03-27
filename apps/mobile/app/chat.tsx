import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

const DISCLAIMER = 'Educational purposes only. For religious rulings, consult your local imam.'

const QUICK_PROMPTS = [
  'What is Zakat?',
  'How do I perform Wudu?',
  'What breaks a fast?',
  'What are the pillars of Islam?',
]

export default function ChatScreen() {
  const { colors } = useTheme()
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const listRef = useRef<FlatList>(null)
  const queryClient = useQueryClient()
  // Optimistic message shown while awaiting AI response
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const { data: conversation } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => api.get<any>(`/chat/conversations/${conversationId}`),
    enabled: !!conversationId,
    staleTime: 0,
  })

  const serverMessages: any[] = conversation?.data?.messages ?? []
  // Show pending user message optimistically while waiting for AI
  const messages = pendingMessage
    ? [...serverMessages, { id: '__pending__', role: 'USER', content: pendingMessage }]
    : serverMessages

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      let convId = convIdRef.current
      if (!convId) {
        const res = await api.post<any>('/chat/conversations', {})
        convId = res.data.id
        convIdRef.current = convId
        setConversationId(convId)
      }
      return api.post<any>(`/chat/conversations/${convId}/messages`, { content })
    },
    onSuccess: () => {
      setPendingMessage(null)
      queryClient.invalidateQueries({ queryKey: ['chat-messages', convIdRef.current] })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200)
    },
    onError: (err: Error) => {
      setPendingMessage(null)
      Alert.alert('Error', err.message ?? 'Failed to send message. Please try again.')
    },
  })

  function handleSend(text?: string) {
    const content = (text ?? input).trim()
    if (!content || sendMutation.isPending) return
    setInput('')
    setPendingMessage(content)
    sendMutation.mutate(content)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Islamic AI Assistant',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Disclaimer */}
        <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.isDark ? '#422006' : '#FFFBEB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.isDark ? '#854d0e' : '#FDE68A' }}>
          <Text style={{ color: colors.isDark ? '#fde68a' : '#92400E', fontSize: 11, textAlign: 'center' }}>{DISCLAIMER}</Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🕌</Text>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 18, marginBottom: 4 }}>Assalamu Alaikum!</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginBottom: 24 }}>
                Ask me anything about Islam, prayer times, or how to use this app.
              </Text>
              <View style={{ width: '100%', gap: 8 }}>
                {QUICK_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => handleSend(p)}
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}
                  >
                    <Text style={{ color: colors.text, fontSize: 14 }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={{ marginBottom: 12, alignSelf: item.role === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: item.role === 'USER' ? colors.primary : colors.surface, borderWidth: item.role === 'ASSISTANT' ? 1 : 0, borderColor: colors.border }}>
                <Text style={{ color: item.role === 'USER' ? colors.primaryContrast : colors.text, fontSize: 14, lineHeight: 20 }}>
                  {item.content}
                </Text>
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4, paddingHorizontal: 4 }}>
                {item.role === 'ASSISTANT' ? 'Masjid AI' : 'You'}
              </Text>
            </View>
          )}
        />

        {sendMutation.isPending && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
          <TextInput
            style={{ flex: 1, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text, maxHeight: 100 }}
            placeholder="Ask about Islam..."
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim() || sendMutation.isPending}
            style={{ backgroundColor: input.trim() ? colors.primary : colors.border, borderRadius: 20, padding: 12 }}
          >
            <Ionicons name="send" size={18} color={input.trim() ? colors.primaryContrast : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
