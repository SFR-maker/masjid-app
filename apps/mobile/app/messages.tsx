import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { formatDistanceToNow } from 'date-fns'
import { Audio } from 'expo-av'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Image } from 'expo-image'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '@clerk/clerk-expo'

export default function MessagesScreen() {
  const { colors } = useTheme()
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  const { tab: tabParam, groupId: groupIdParam } = useLocalSearchParams<{ tab?: string; groupId?: string }>()

  const [tab, setTab] = useState<'direct' | 'groups'>('direct')

  // Direct messages state
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const scrollRef = useRef<ScrollView>(null)

  // Group chat state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupText, setGroupText] = useState('')
  const groupScrollRef = useRef<ScrollView>(null)

  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaUploading, setMediaUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-messages'],
    queryFn: () => api.get('/users/me/messages'),
    staleTime: 30_000,
  })

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => api.get('/users/me/groups'),
    staleTime: 30_000,
  })

  const messages: any[] = data?.data?.items ?? []
  const groups: any[] = groupsData?.data?.items ?? []
  const selectedThread = selectedThreadId ? messages.find((m) => m.id === selectedThreadId) ?? null : null
  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) ?? null : null

  // Fetch full message history for the selected group
  const { data: groupHistoryData, isLoading: groupHistoryLoading } = useQuery({
    queryKey: ['group-messages', selectedGroupId],
    queryFn: () => api.get(`/mosques/${selectedGroup?.mosque?.id}/groups/${selectedGroupId}/messages`),
    enabled: !!selectedGroupId && !!selectedGroup?.mosque?.id,
    staleTime: 0,
  })

  const replyMutation = useMutation({
    mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
      api.post(`/mosques/${selectedThread?.mosque?.id}/messages/${messageId}/user-reply`, { body }),
    onSuccess: () => {
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['my-messages'] })
    },
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Could not send message. Try again.'),
  })

  const groupReplyMutation = useMutation({
    mutationFn: ({ groupId, mosqueId, body, mediaUrl, mediaType }: { groupId: string; mosqueId: string; body: string; mediaUrl?: string; mediaType?: string }) =>
      api.post(`/mosques/${mosqueId}/groups/${groupId}/user-message`, { body, mediaUrl, mediaType }),
    onSuccess: (_, { groupId }) => {
      setGroupText('')
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] })
    },
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Could not send message.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/users/me/messages/${messageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-messages'] }),
    onError: () => Alert.alert('Error', 'Could not delete conversation.'),
  })

  const leaveGroupMutation = useMutation({
    mutationFn: (groupId: string) => api.delete(`/users/me/groups/${groupId}`),
    onSuccess: () => {
      setSelectedGroupId(null)
      queryClient.invalidateQueries({ queryKey: ['my-groups'] })
    },
    onError: () => Alert.alert('Error', 'Could not leave group. Try again.'),
  })

  const deleteGroupMessageMutation = useMutation({
    mutationFn: ({ groupId, mosqueId, messageId }: { groupId: string; mosqueId: string; messageId: string }) =>
      api.delete(`/mosques/${mosqueId}/groups/${groupId}/messages/${messageId}`),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] })
    },
    onError: () => Alert.alert('Error', 'Could not delete message.'),
  })

  async function uploadMediaToCloudinary(
    fileUri: string,
    mimeType: string,
    mediaType: 'audio' | 'image' | 'pdf' | 'gif',
    mosqueId: string,
    groupId: string
  ): Promise<{ mediaUrl: string; mediaType: string } | null> {
    try {
      setMediaUploading(true)
      // Get signed upload params
      const res = await api.post<any>(`/mosques/${mosqueId}/groups/${groupId}/media-upload-url`, { mediaType })
      const { signature, timestamp, cloudName, apiKey, folder, resourceType } = res.data

      const formData = new FormData()
      formData.append('file', { uri: fileUri, type: mimeType, name: `media.${mimeType.split('/')[1] ?? 'bin'}` } as any)
      formData.append('signature', signature)
      formData.append('timestamp', String(timestamp))
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType === 'raw' ? 'raw' : 'image'}/upload`,
        { method: 'POST', body: formData as any }
      )
      const uploadData = await uploadRes.json() as any
      if (!uploadData.secure_url) throw new Error('Upload failed')
      return { mediaUrl: uploadData.secure_url as string, mediaType }
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload media. Try again.')
      return null
    } finally {
      setMediaUploading(false)
    }
  }

  async function handleAttachImage() {
    if (!selectedGroup) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo access to attach images.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const isGif = asset.uri.toLowerCase().includes('.gif') || asset.mimeType === 'image/gif'
    const media = await uploadMediaToCloudinary(asset.uri, asset.mimeType ?? 'image/jpeg', isGif ? 'gif' : 'image', selectedGroup.mosque?.id, selectedGroup.id)
    if (media) {
      groupReplyMutation.mutate({ groupId: selectedGroup.id, mosqueId: selectedGroup.mosque?.id, body: '', mediaUrl: media.mediaUrl, mediaType: media.mediaType })
    }
  }

  async function handleAttachPdf() {
    if (!selectedGroup) return
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const media = await uploadMediaToCloudinary(asset.uri, 'application/pdf', 'pdf', selectedGroup.mosque?.id, selectedGroup.id)
    if (media) {
      groupReplyMutation.mutate({ groupId: selectedGroup.id, mosqueId: selectedGroup.mosque?.id, body: '', mediaUrl: media.mediaUrl, mediaType: media.mediaType })
    }
  }

  async function handleStartRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (!perm.granted) { Alert.alert('Permission required', 'Allow microphone access to record voice messages.'); return }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(rec)
      setIsRecording(true)
    } catch { Alert.alert('Error', 'Could not start recording.') }
  }

  async function handleStopRecording() {
    if (!recording || !selectedGroup) return
    try {
      setIsRecording(false)
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)
      if (!uri) return
      const media = await uploadMediaToCloudinary(uri, 'audio/m4a', 'audio', selectedGroup.mosque?.id, selectedGroup.id)
      if (media) {
        groupReplyMutation.mutate({ groupId: selectedGroup.id, mosqueId: selectedGroup.mosque?.id, body: '🎤 Voice message', mediaUrl: media.mediaUrl, mediaType: 'audio' })
      }
    } catch { Alert.alert('Error', 'Could not process recording.') }
  }

  function handleSendReply() {
    if (!replyText.trim() || !selectedThread) return
    replyMutation.mutate({ messageId: selectedThread.id, body: replyText.trim() })
  }

  function handleSendGroupMessage() {
    if (!groupText.trim() || !selectedGroup) return
    groupReplyMutation.mutate({ groupId: selectedGroup.id, mosqueId: selectedGroup.mosque?.id, body: groupText.trim(), mediaUrl: undefined, mediaType: undefined })
  }

  function confirmDelete(messageId: string) {
    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm('Delete this conversation?')) deleteMutation.mutate(messageId)
    } else {
      Alert.alert('Delete conversation', 'This will permanently delete this conversation.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(messageId) },
      ])
    }
  }

  function confirmLeaveGroup(groupId: string, groupName: string) {
    Alert.alert(
      'Leave group?',
      `You will be removed from "${groupName}" and will no longer receive messages from this group. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Group', style: 'destructive', onPress: () => leaveGroupMutation.mutate(groupId) },
      ]
    )
  }

  // Navigate to group from push notification deep link
  useEffect(() => {
    if (tabParam === 'groups') {
      setTab('groups')
      if (groupIdParam) setSelectedGroupId(groupIdParam)
    }
  }, [tabParam, groupIdParam])

  // Scroll to bottom on new replies
  useEffect(() => {
    if (selectedThread) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [selectedThread?.replies?.length])

  useEffect(() => {
    if (selectedGroup) setTimeout(() => groupScrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [groupHistoryData?.data?.items?.length, selectedGroup?.messages?.length])

  // Thread view for a selected conversation
  if (selectedThread) {
    const threadEvents: { id: string; body: string; fromAdmin: boolean; subject?: string; createdAt: string }[] = [
      { id: selectedThread.id + '_orig', body: selectedThread.body, fromAdmin: false, subject: selectedThread.subject, createdAt: selectedThread.createdAt },
    ]
    for (const r of selectedThread.replies ?? []) {
      threadEvents.push({ id: r.id, body: r.body, fromAdmin: r.fromAdmin, createdAt: r.createdAt })
    }
    threadEvents.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const hasReply = (selectedThread.replies?.length ?? 0) > 0

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setSelectedThreadId(null)} style={{ marginRight: 12, padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => selectedThread.mosque?.id && router.push(`/mosque/${selectedThread.mosque.id}` as any)} disabled={!selectedThread.mosque?.id} style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                {selectedThread.mosque?.name ?? 'Mosque'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>Tap to view mosque</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(selectedThread.id)}
              style={{ padding: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {threadEvents.map((event) => {
              const isUser = !event.fromAdmin
              return (
                <View key={event.id} style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  {isUser ? (
                    <View style={{ maxWidth: '80%' }}>
                      {event.subject && (
                        <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginBottom: 3, marginRight: 4, textAlign: 'right', letterSpacing: 0.3 }}>
                          {event.subject.toUpperCase()}
                        </Text>
                      )}
                      <View style={{ backgroundColor: colors.primary, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
                        <Text style={{ color: colors.primaryContrast, fontSize: 14, lineHeight: 20 }}>{event.body}</Text>
                      </View>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4, marginRight: 4, textAlign: 'right' }}>
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '80%' }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                        <Text style={{ fontSize: 13 }}>🕌</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginBottom: 3, letterSpacing: 0.3 }}>
                          {selectedThread.mosque?.name?.toUpperCase()}
                        </Text>
                        <View style={{ backgroundColor: colors.surface, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{event.body}</Text>
                        </View>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}

            {!hasReply && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Awaiting reply</Text>
              </View>
            )}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Reply input */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={hasReply ? 'Reply…' : 'Write a message…'}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                backgroundColor: colors.inputBackground,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                color: colors.text,
                maxHeight: 100,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <TouchableOpacity
              onPress={handleSendReply}
              disabled={!replyText.trim() || replyMutation.isPending}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: replyText.trim() ? colors.primary : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {replyMutation.isPending
                ? <ActivityIndicator size="small" color={colors.primaryContrast} />
                : <Ionicons name="arrow-up" size={18} color={replyText.trim() ? colors.primaryContrast : colors.textTertiary} />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // Group chat thread view
  if (selectedGroup) {
    const groupMessages: any[] = groupHistoryData?.data?.items ?? selectedGroup.messages ?? []

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setSelectedGroupId(null)} style={{ marginRight: 12, padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                {selectedGroup.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                {selectedGroup.mosque?.name} · {selectedGroup._count?.members ?? 0} members
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => confirmLeaveGroup(selectedGroup.id, selectedGroup.name)}
              disabled={leaveGroupMutation.isPending}
              style={{ padding: 8 }}
            >
              {leaveGroupMutation.isPending
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Ionicons name="trash-outline" size={18} color="#EF4444" />
              }
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView ref={groupScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
            {groupHistoryLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            {!groupHistoryLoading && groupMessages.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No messages yet</Text>
              </View>
            )}
            {groupMessages.map((msg: any) => {
              const isMe = !msg.fromAdmin && msg.fromUserId === userId
              const isAdmin = msg.fromAdmin
              const isRight = isMe || isAdmin
              const isDeleted = msg.isDeleted
              return (
                <TouchableOpacity
                  key={msg.id}
                  activeOpacity={0.85}
                  onLongPress={() => {
                    if (!isMe || isDeleted) return
                    Alert.alert('Delete message', 'Remove this message?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteGroupMessageMutation.mutate({ groupId: selectedGroup!.id, mosqueId: selectedGroup!.mosque?.id, messageId: msg.id }) },
                    ])
                  }}
                  style={{ alignItems: isRight ? 'flex-end' : 'flex-start' }}
                >
                  {!isRight && (
                    <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginBottom: 2, marginLeft: 4 }}>
                      {msg.fromUser?.name ?? 'Member'}
                    </Text>
                  )}
                  <View style={{
                    maxWidth: '80%',
                    backgroundColor: isDeleted ? colors.surfaceSecondary : (isRight ? colors.primary : colors.surface),
                    borderRadius: 18,
                    borderBottomRightRadius: isRight ? 4 : 18,
                    borderBottomLeftRadius: isRight ? 18 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: isRight && !isDeleted ? 0 : 1,
                    borderColor: colors.border,
                  }}>
                    {isDeleted ? (
                      <Text style={{ color: colors.textTertiary, fontSize: 13, fontStyle: 'italic' }}>Message deleted</Text>
                    ) : msg.mediaType === 'audio' ? (
                      <TouchableOpacity onPress={() => msg.mediaUrl && Linking.openURL(msg.mediaUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="mic" size={18} color={isRight ? colors.primaryContrast : colors.primary} />
                        <Text style={{ color: isRight ? colors.primaryContrast : colors.text, fontSize: 14 }}>Voice message</Text>
                        <Ionicons name="play-circle" size={20} color={isRight ? colors.primaryContrast : colors.primary} />
                      </TouchableOpacity>
                    ) : msg.mediaType === 'pdf' ? (
                      <TouchableOpacity onPress={() => msg.mediaUrl && Linking.openURL(msg.mediaUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="document-text" size={18} color={isRight ? colors.primaryContrast : colors.primary} />
                        <Text style={{ color: isRight ? colors.primaryContrast : colors.text, fontSize: 14 }}>PDF document</Text>
                      </TouchableOpacity>
                    ) : msg.mediaType === 'image' || msg.mediaType === 'gif' ? (
                      <View>
                        <Image source={{ uri: msg.mediaUrl }} style={{ width: 200, height: 150, borderRadius: 10 }} contentFit="cover" />
                        {msg.body ? <Text style={{ color: isRight ? colors.primaryContrast : colors.text, fontSize: 14, marginTop: 6 }}>{msg.body}</Text> : null}
                      </View>
                    ) : (
                      <Text style={{ color: isRight ? colors.primaryContrast : colors.text, fontSize: 14, lineHeight: 20 }}>
                        {msg.body}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 3, marginHorizontal: 4, textAlign: isRight ? 'right' : 'left' }}>
                    {isAdmin ? 'Mosque' : (isMe ? 'You' : msg.fromUser?.name ?? 'Member')} · {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </Text>
                </TouchableOpacity>
              )
            })}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Input */}
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
            {mediaUploading && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Uploading media…</Text>
              </View>
            )}
            {/* Attach buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TouchableOpacity onPress={handleAttachImage} disabled={mediaUploading} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAttachPdf} disabled={mediaUploading} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                disabled={mediaUploading}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isRecording ? '#FEE2E2' : colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={18} color={isRecording ? '#EF4444' : colors.textSecondary} />
              </TouchableOpacity>
              {isRecording && <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600' }}>Recording…</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                value={groupText}
                onChangeText={setGroupText}
                placeholder="Message the group…"
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={1000}
                style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, color: colors.text, maxHeight: 100, borderWidth: 1, borderColor: colors.border }}
              />
              <TouchableOpacity
                onPress={handleSendGroupMessage}
                disabled={!groupText.trim() || groupReplyMutation.isPending}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: groupText.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                {groupReplyMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.primaryContrast} />
                  : <Ionicons name="arrow-up" size={18} color={groupText.trim() ? colors.primaryContrast : colors.textTertiary} />
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // Inbox: list of mosque conversations (newest activity first)
  const sortedMessages = [...messages].sort((a: any, b: any) => {
    const aTime = a.replies?.[a.replies.length - 1]?.createdAt ?? a.createdAt
    const bTime = b.replies?.[b.replies.length - 1]?.createdAt ?? b.createdAt
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  const totalLoading = isLoading || groupsLoading

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>Messages</Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
        {(['direct', 'groups'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: tab === t ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: tab === t ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: tab === t ? colors.primaryContrast : colors.textSecondary }}>
              {t === 'direct' ? '✉️ Direct' : '💬 Groups'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {totalLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'groups' ? (
        groups.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>💬</Text>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No group chats</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
              Your mosque admins can add you to group chats.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {groups.map((group: any) => {
              const latestMsg = group.messages?.[0]
              return (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => setSelectedGroupId(group.id)}
                  activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                    <Text style={{ fontSize: 20 }}>💬</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{group.name}</Text>
                      {latestMsg && (
                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                          {formatDistanceToNow(new Date(latestMsg.createdAt), { addSuffix: true })}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 2 }}>{group.mosque?.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }} numberOfLines={1}>
                      {latestMsg ? latestMsg.body : `${group._count?.members ?? 0} members`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )
      ) : sortedMessages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32 }}>✉️</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No messages yet</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
            Visit a mosque profile and tap "Message" to start a conversation.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {sortedMessages.map((msg: any) => {
            const latestReply = msg.replies?.[msg.replies.length - 1]
            const hasReply = (msg.replies?.length ?? 0) > 0
            const preview = latestReply ? latestReply.body : msg.body
            const latestTime = latestReply ? latestReply.createdAt : msg.createdAt

            return (
              <TouchableOpacity
                key={msg.id}
                onPress={() => setSelectedThreadId(msg.id)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: hasReply ? (colors.isDark ? '#166534' : '#BBF7D0') : colors.border,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.04,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 8,
                  elevation: 1,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <Text style={{ fontSize: 20 }}>🕌</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                      {msg.mosque?.name ?? 'Mosque'}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                      {formatDistanceToNow(new Date(latestTime), { addSuffix: true })}
                    </Text>
                  </View>
                  {msg.subject && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 1 }} numberOfLines={1}>{msg.subject}</Text>
                  )}
                  <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }} numberOfLines={1}>
                    {preview}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    {hasReply ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.isDark ? '#052e16' : '#D1FAE5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Ionicons name="checkmark-circle" size={11} color={colors.isDark ? '#4ade80' : '#059669'} />
                        <Text style={{ fontSize: 10, color: colors.isDark ? '#4ade80' : '#059669', fontWeight: '700' }}>{msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
                        <Text style={{ fontSize: 10, color: colors.textTertiary }}>Awaiting reply</Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => confirmDelete(msg.id)}
                  style={{ padding: 8, marginLeft: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
